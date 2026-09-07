import io
import uuid
import logging
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.dataset import Dataset, ColumnMapping, DatasetStatus, NEXMINE_FIELDS
from app.models.user import User
from app.schemas.dataset import (
    UploadResponse, ColumnProposal,
    ConfirmMappingRequest, MappingConfirmedResponse,
    DatasetInfo,
)
from app.services.auth_service import decode_access_token
from app.services.column_detection_service import propose_mapping
from app.services.gating_service import compute_gate

router = APIRouter(prefix="/datasets", tags=["Datasets"])
bearer_scheme = HTTPBearer()

# ─── Auth dependency ──────────────────────────────────────────────────────────

def _to_uuid(val):
    if isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except (ValueError, TypeError):
        return val


def _get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == _to_uuid(payload.get("sub")), User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ─── Supported MIME types ─────────────────────────────────────────────────────
_ALLOWED_TYPES = {
    "text/csv":                                    "csv",
    "application/vnd.ms-excel":                   "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/octet-stream":                   None,  # fallback to extension
}

_MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def _detect_file_type(filename: str, content_type: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ("csv", "xlsx", "xls"):
        return ext
    mapped = _ALLOWED_TYPES.get(content_type)
    if mapped:
        return mapped
    raise HTTPException(status_code=415, detail=f"Unsupported file type: {ext or content_type}. Upload CSV, XLS, or XLSX.")


def _read_dataframe(content: bytes, file_type: str) -> pd.DataFrame:
    try:
        buf = io.BytesIO(content)
        if file_type == "csv":
            # Try common encodings
            for enc in ("utf-8", "latin-1", "cp1252"):
                try:
                    buf.seek(0)
                    return pd.read_csv(buf, encoding=enc, nrows=None, low_memory=False)
                except UnicodeDecodeError:
                    continue
            raise ValueError("Unable to decode CSV — try saving as UTF-8.")
        elif file_type == "xlsx":
            return pd.read_excel(buf, engine="openpyxl")
        elif file_type == "xls":
            return pd.read_excel(buf, engine="xlrd")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse file: {e}")


# ─── POST /datasets/upload ────────────────────────────────────────────────────

@router.post("/upload", response_model=UploadResponse, status_code=201)
async def upload_dataset(
    file: UploadFile = File(...),
    current_user: User = Depends(_get_current_user),
    db: Session = Depends(get_db),
):
    # Size check
    content = await file.read()
    if len(content) > _MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 50 MB.")

    file_type = _detect_file_type(file.filename or "upload.csv", file.content_type or "")
    df = _read_dataframe(content, file_type)

    if df.empty:
        raise HTTPException(status_code=422, detail="The uploaded file contains no data rows.")

    raw_columns = list(df.columns.astype(str))
    proposals = propose_mapping(raw_columns)

    # Persist dataset record (status = uploaded)
    dataset = Dataset(
        user_id=current_user.id,
        original_filename=file.filename or "upload",
        file_type=file_type,
        row_count=len(df),
        column_count=len(raw_columns),
        status=DatasetStatus.uploaded,
        detected_columns=raw_columns,
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    # Persist file locally for seamless mining and quality execution
    try:
        uploads_dir = Path("uploads")
        uploads_dir.mkdir(exist_ok=True)
        file_path = uploads_dir / f"{dataset.id}.{file_type}"
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        logging.getLogger(__name__).warning(f"Could not save upload file to disk: {e}")

    return UploadResponse(
        dataset_id=str(dataset.id),
        original_filename=dataset.original_filename,
        row_count=dataset.row_count,
        column_count=dataset.column_count,
        proposals=[ColumnProposal(**p) for p in proposals],
        message=(
            f"File parsed successfully. {len(df):,} rows and {len(raw_columns)} columns detected. "
            "Review the proposed column mapping below."
        ),
    )


# ─── POST /datasets/{dataset_id}/confirm-mapping ──────────────────────────────

@router.post("/{dataset_id}/confirm-mapping", response_model=MappingConfirmedResponse)
def confirm_mapping(
    dataset_id: str,
    body: ConfirmMappingRequest,
    current_user: User = Depends(_get_current_user),
    db: Session = Depends(get_db),
):
    dataset = db.query(Dataset).filter(
        Dataset.id == _to_uuid(dataset_id),
        Dataset.user_id == current_user.id,
    ).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Filter to only valid NexMine fields and non-null values
    confirmed: dict[str, str] = {
        k: v for k, v in body.mapping.items()
        if k in NEXMINE_FIELDS and v
    }

    if not confirmed:
        raise HTTPException(status_code=422, detail="At least one field must be mapped.")

    # Upsert ColumnMapping
    existing = db.query(ColumnMapping).filter(ColumnMapping.dataset_id == dataset.id).first()
    if existing:
        db.delete(existing)
        db.flush()

    cm = ColumnMapping(dataset_id=dataset.id, **{k: v for k, v in confirmed.items()})
    db.add(cm)

    # Update dataset status
    dataset.status = DatasetStatus.mapped
    db.commit()
    db.refresh(cm)

    gate = compute_gate(confirmed)

    # Auto-execute quality report and data mining in one pass if file exists on disk
    file_path = Path("uploads") / f"{dataset.id}.{dataset.file_type}"
    if file_path.exists():
        try:
            with open(file_path, "rb") as f:
                df = _read_dataframe(f.read(), dataset.file_type)

            # 1. Quality report
            from app.services.quality_engine import run_quality_engine
            from app.models.quality import DataQualityReport
            q_result = run_quality_engine(df, confirmed)
            existing_q = db.query(DataQualityReport).filter(DataQualityReport.dataset_id == dataset.id).first()
            if existing_q:
                db.delete(existing_q)
                db.flush()

            db.add(DataQualityReport(
                dataset_id=dataset.id,
                total_rows=q_result.total_rows,
                valid_rows=q_result.valid_rows,
                duplicate_rows=q_result.duplicate_rows,
                missing_values_count=q_result.missing_values_count,
                invalid_date_count=q_result.invalid_date_count,
                invalid_quantity_count=q_result.invalid_quantity_count,
                invalid_price_count=q_result.invalid_price_count,
                outlier_count=q_result.outlier_count,
                missing_customer_id=q_result.missing_customer_id_count,
                missing_product=q_result.missing_product_count,
                quality_score=q_result.quality_score,
                column_stats=[
                    {
                        "column": cs.column, "nexmine_field": cs.nexmine_field,
                        "total": cs.total, "missing": cs.missing,
                        "pct_missing": cs.pct_missing, "type_issues": cs.type_issues,
                        "unique_count": cs.unique_count, "sample_values": cs.sample_values,
                    }
                    for cs in q_result.column_stats
                ],
                cleaning_log=[
                    {"action": c.action, "description": c.description,
                     "rows_affected": c.rows_affected, "severity": c.severity}
                    for c in q_result.cleaning_log
                ],
                user_attention_items=q_result.user_attention_items,
            ))

            # 2. Mining results
            from app.services.mining_service import (
                run_rfm, run_clustering, run_association_rules,
                run_sales_patterns, run_anomaly_detection
            )
            from app.models.mining import MiningResult
            rfm_res = run_rfm(df, confirmed) if gate.rfm.enabled else None
            clusters_res = run_clustering(df, confirmed) if gate.clustering.enabled else None
            rules_res = run_association_rules(df, confirmed) if gate.association_rules.enabled else None
            patterns_res = run_sales_patterns(df, confirmed) if gate.sales_patterns.enabled else None
            anomalies_res = run_anomaly_detection(df, confirmed) if gate.anomaly_detection.enabled else None

            existing_m = db.query(MiningResult).filter(MiningResult.dataset_id == dataset.id).first()
            if existing_m:
                existing_m.rfm_segments = rfm_res
                existing_m.customer_clusters = clusters_res
                existing_m.association_rules = rules_res
                existing_m.sales_patterns = patterns_res
                existing_m.anomalies = anomalies_res
            else:
                db.add(MiningResult(
                    dataset_id=dataset.id,
                    rfm_segments=rfm_res,
                    customer_clusters=clusters_res,
                    association_rules=rules_res,
                    sales_patterns=patterns_res,
                    anomalies=anomalies_res
                ))

            dataset.status = DatasetStatus.ready
            db.commit()
        except Exception as e:
            logging.getLogger(__name__).warning(f"Auto-mining error: {e}")

    return MappingConfirmedResponse(
        dataset_id=str(dataset.id),
        mapping=confirmed,
        analyses_available=gate.to_dict(),
        message=(
            f"Mapping confirmed. {len(confirmed)} fields mapped. "
            f"{sum(1 for v in gate.to_dict().values() if v['enabled'])} of 6 analyses enabled."
        ),
    )


# ─── GET /datasets/me ─────────────────────────────────────────────────────────

@router.get("/me", response_model=list[DatasetInfo])
def list_my_datasets(
    current_user: User = Depends(_get_current_user),
    db: Session = Depends(get_db),
):
    datasets = (
        db.query(Dataset)
        .filter(Dataset.user_id == current_user.id)
        .order_by(Dataset.created_at.desc())
        .all()
    )

    result = []
    for ds in datasets:
        mapping_dict = ds.column_mapping.as_dict() if ds.column_mapping else None
        gate_dict = compute_gate(mapping_dict).to_dict() if mapping_dict else None
        result.append(DatasetInfo(
            id=str(ds.id),
            original_filename=ds.original_filename,
            file_type=ds.file_type,
            row_count=ds.row_count,
            column_count=ds.column_count,
            status=ds.status.value,
            detected_columns=ds.detected_columns,
            mapping=mapping_dict,
            analyses_available=gate_dict,
            created_at=ds.created_at,
        ))
    return result


# ─── GET /datasets/{dataset_id} ───────────────────────────────────────────────

@router.get("/{dataset_id}", response_model=DatasetInfo)
def get_dataset(
    dataset_id: str,
    current_user: User = Depends(_get_current_user),
    db: Session = Depends(get_db),
):
    ds = db.query(Dataset).filter(
        Dataset.id == _to_uuid(dataset_id),
        Dataset.user_id == current_user.id,
    ).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    mapping_dict = ds.column_mapping.as_dict() if ds.column_mapping else None
    gate_dict = compute_gate(mapping_dict).to_dict() if mapping_dict else None

    return DatasetInfo(
        id=str(ds.id),
        original_filename=ds.original_filename,
        file_type=ds.file_type,
        row_count=ds.row_count,
        column_count=ds.column_count,
        status=ds.status.value,
        detected_columns=ds.detected_columns,
        mapping=mapping_dict,
        analyses_available=gate_dict,
        created_at=ds.created_at,
    )


# ─── DELETE /datasets/{dataset_id} ───────────────────────────────────────────

@router.delete("/{dataset_id}", status_code=204)
def delete_dataset(
    dataset_id: str,
    current_user: User = Depends(_get_current_user),
    db: Session = Depends(get_db),
):
    ds = db.query(Dataset).filter(
        Dataset.id == _to_uuid(dataset_id),
        Dataset.user_id == current_user.id,
    ).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    db.delete(ds)
    db.commit()
