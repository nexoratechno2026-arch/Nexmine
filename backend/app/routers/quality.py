"""
Data Quality Router
===================
POST /quality/{dataset_id}/run  — compute (or recompute) quality report
GET  /quality/{dataset_id}      — retrieve cached report
"""
import io
import pandas as pd
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.dataset import Dataset, DatasetStatus
from app.models.quality import DataQualityReport
from app.models.user import User
from app.schemas.quality import QualityReportResponse, ColumnStatSchema, CleaningEntrySchema
from app.services.auth_service import decode_access_token
from app.services.quality_engine import run_quality_engine, ColumnStat, CleaningEntry

router = APIRouter(prefix="/quality", tags=["Data Quality"])
bearer_scheme = HTTPBearer()


from pathlib import Path
import uuid

def _to_uuid(val):
    if isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except (ValueError, TypeError):
        return val


# ─── Auth dependency ──────────────────────────────────────────────────────────
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


def _load_dataset_df(dataset: Dataset) -> pd.DataFrame:
    """
    In Phase 3 we re-read the file from the stored path.
    For now we use a simple approach: store raw file content in the DB
    is out of scope (that's object storage territory), so this endpoint
    requires the user to re-upload OR we can cache in-memory per session.

    Pragmatic Phase 3 solution:
    We store nothing on disk. The quality run is triggered right after upload
    (while the file is fresh in memory on the client side).

    The router accepts the raw file again (multipart) — OR we can run quality
    immediately on upload and cache the result. We do the latter: the quality
    is computed as part of the upload pipeline when the user triggers it.

    This router therefore READS from the cached DataQualityReport, not from disk.
    The `/run` endpoint will accept the file content as an optional multipart upload.
    """
    pass  # Not used directly; file is received in the POST body below


# ─── POST /quality/{dataset_id}/run ──────────────────────────────────────────

from fastapi import File, UploadFile
from typing import Optional


@router.post("/{dataset_id}/run", response_model=QualityReportResponse, status_code=201)
async def run_quality(
    dataset_id: str,
    file: Optional[UploadFile] = File(None, description="Optional file; if omitted, uses saved file"),
    current_user: User = Depends(_get_current_user),
    db: Session = Depends(get_db),
):
    """
    Compute the data quality report for a dataset.
    Uses uploaded file if provided, otherwise reads saved file from server.
    """
    dataset = db.query(Dataset).filter(
        Dataset.id == _to_uuid(dataset_id),
        Dataset.user_id == current_user.id,
    ).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if not dataset.column_mapping:
        raise HTTPException(status_code=400, detail="Dataset column mapping has not been confirmed yet.")

    mapping = dataset.column_mapping.as_dict()

    # Read file
    if file:
        content = await file.read()
    else:
        file_path = Path("uploads") / f"{dataset.id}.{dataset.file_type}"
        if not file_path.exists():
            raise HTTPException(status_code=400, detail="No file found on server. Please upload your file.")
        with open(file_path, "rb") as f:
            content = f.read()

    file_type = dataset.file_type
    try:
        buf = io.BytesIO(content)
        if file_type == "csv":
            for enc in ("utf-8", "latin-1", "cp1252"):
                try:
                    buf.seek(0)
                    df = pd.read_csv(buf, encoding=enc, low_memory=False)
                    break
                except UnicodeDecodeError:
                    continue
        elif file_type == "xlsx":
            df = pd.read_excel(buf, engine="openpyxl")
        elif file_type == "xls":
            df = pd.read_excel(buf, engine="xlrd")
        else:
            raise HTTPException(status_code=415, detail="Unsupported file type")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not read file: {e}")

    # Run quality engine
    result = run_quality_engine(df, mapping)

    # Persist / upsert report
    existing = db.query(DataQualityReport).filter(
        DataQualityReport.dataset_id == dataset.id
    ).first()
    if existing:
        db.delete(existing)
        db.flush()

    report = DataQualityReport(
        dataset_id=dataset.id,
        total_rows=result.total_rows,
        valid_rows=result.valid_rows,
        duplicate_rows=result.duplicate_rows,
        missing_values_count=result.missing_values_count,
        invalid_date_count=result.invalid_date_count,
        invalid_quantity_count=result.invalid_quantity_count,
        invalid_price_count=result.invalid_price_count,
        outlier_count=result.outlier_count,
        missing_customer_id=result.missing_customer_id_count,
        missing_product=result.missing_product_count,
        quality_score=result.quality_score,
        column_stats=[
            {
                "column": cs.column, "nexmine_field": cs.nexmine_field,
                "total": cs.total, "missing": cs.missing,
                "pct_missing": cs.pct_missing, "type_issues": cs.type_issues,
                "unique_count": cs.unique_count, "sample_values": cs.sample_values,
            }
            for cs in result.column_stats
        ],
        cleaning_log=[
            {"action": c.action, "description": c.description,
             "rows_affected": c.rows_affected, "severity": c.severity}
            for c in result.cleaning_log
        ],
        user_attention_items=result.user_attention_items,
        computed_at=datetime.utcnow(),
    )
    db.add(report)

    # Advance dataset status to cleaned
    dataset.status = DatasetStatus.cleaned
    db.commit()
    db.refresh(report)

    return _report_to_response(dataset_id, report)


# ─── GET /quality/{dataset_id} ────────────────────────────────────────────────

@router.get("/{dataset_id}", response_model=QualityReportResponse)
def get_quality_report(
    dataset_id: str,
    current_user: User = Depends(_get_current_user),
    db: Session = Depends(get_db),
):
    dataset = db.query(Dataset).filter(
        Dataset.id == _to_uuid(dataset_id),
        Dataset.user_id == current_user.id,
    ).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    report = db.query(DataQualityReport).filter(
        DataQualityReport.dataset_id == dataset.id
    ).first()
    if not report:
        raise HTTPException(
            status_code=404,
            detail="No quality report found. Run POST /quality/{dataset_id}/run first."
        )

    return _report_to_response(dataset_id, report)


# ─── Helper ───────────────────────────────────────────────────────────────────

def _report_to_response(dataset_id: str, report: DataQualityReport) -> QualityReportResponse:
    column_stats_data = report.column_stats if isinstance(report.column_stats, list) else []
    cleaning_log_data = report.cleaning_log if isinstance(report.cleaning_log, list) else []
    attention_items_data = report.user_attention_items if isinstance(report.user_attention_items, list) else []

    return QualityReportResponse(
        dataset_id=dataset_id,
        total_rows=report.total_rows,
        valid_rows=report.valid_rows,
        duplicate_rows=report.duplicate_rows,
        missing_values_count=report.missing_values_count,
        invalid_date_count=report.invalid_date_count,
        invalid_quantity_count=report.invalid_quantity_count,
        invalid_price_count=report.invalid_price_count,
        outlier_count=report.outlier_count,
        missing_customer_id_count=report.missing_customer_id,
        missing_product_count=report.missing_product,
        quality_score=report.quality_score,
        column_stats=[ColumnStatSchema.model_validate(cs) for cs in column_stats_data],
        cleaning_log=[CleaningEntrySchema.model_validate(c) for c in cleaning_log_data],
        user_attention_items=attention_items_data,
        computed_at=report.computed_at,
    )
