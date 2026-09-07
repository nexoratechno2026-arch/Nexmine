"""
Mining Router
=============
Handles the execution and retrieval of mining results.
"""
import io
import uuid
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app.models.dataset import Dataset, DatasetStatus
from app.models.mining import MiningResult
from app.models.user import User
from app.services.auth_service import decode_access_token
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.services.gating_service import compute_gate
from app.services.mining_service import (
    run_rfm, run_clustering, run_association_rules, 
    run_sales_patterns, run_anomaly_detection, run_product_performance
)

from pathlib import Path
from typing import Optional

router = APIRouter(prefix="/mining", tags=["Mining"])
bearer_scheme = HTTPBearer()

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
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == _to_uuid(payload.get("sub")), User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.post("/{dataset_id}/run")
async def run_mining(
    dataset_id: str,
    file: Optional[UploadFile] = File(None, description="Optional re-upload; if omitted, uses saved file"),
    current_user: User = Depends(_get_current_user),
    db: Session = Depends(get_db),
):
    """
    Run all permitted mining algorithms on the dataset.
    Uses uploaded file if provided, otherwise reads from server storage.
    """
    dataset = db.query(Dataset).filter(Dataset.id == _to_uuid(dataset_id), Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if not dataset.column_mapping:
        raise HTTPException(status_code=400, detail="Mapping not confirmed")

    mapping = dataset.column_mapping.as_dict()
    gate = compute_gate(mapping)

    if not gate.any_enabled():
        raise HTTPException(status_code=400, detail="No analyses can be run on this dataset based on mapped columns.")

    # Read the file
    if file:
        content = await file.read()
    else:
        file_path = Path("uploads") / f"{dataset.id}.{dataset.file_type}"
        if not file_path.exists():
            raise HTTPException(status_code=400, detail="No file found on server. Please upload your file.")
        with open(file_path, "rb") as f:
            content = f.read()

    try:
        buf = io.BytesIO(content)
        if dataset.file_type == "csv":
            df = pd.read_csv(buf, low_memory=False)
        else:
            df = pd.read_excel(buf)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {e}")

    # Run enabled analyses
    rfm_res = run_rfm(df, mapping) if gate.rfm.enabled else None
    clusters_res = run_clustering(df, mapping) if gate.clustering.enabled else None
    rules_res = run_association_rules(df, mapping) if gate.association_rules.enabled else None
    patterns_res = run_sales_patterns(df, mapping) if gate.sales_patterns.enabled else None
    anomalies_res = run_anomaly_detection(df, mapping) if gate.anomaly_detection.enabled else None
    perf_res = run_product_performance(df, mapping)

    # Upsert results
    existing = db.query(MiningResult).filter(MiningResult.dataset_id == dataset.id).first()
    if existing:
        existing.rfm_segments = rfm_res
        existing.customer_clusters = clusters_res
        existing.association_rules = rules_res
        existing.sales_patterns = patterns_res
        existing.anomalies = anomalies_res
        existing.product_performance = perf_res
        existing.updated_at = datetime.utcnow()
        result_obj = existing
    else:
        result_obj = MiningResult(
            dataset_id=dataset.id,
            rfm_segments=rfm_res,
            customer_clusters=clusters_res,
            association_rules=rules_res,
            sales_patterns=patterns_res,
            anomalies=anomalies_res,
            product_performance=perf_res
        )
        db.add(result_obj)

    dataset.status = DatasetStatus.ready
    db.commit()

    return {"message": "Mining complete", "status": "ready"}


@router.get("/{dataset_id}")
def get_mining_results(
    dataset_id: str,
    current_user: User = Depends(_get_current_user),
    db: Session = Depends(get_db),
):
    """
    Fetch the cached JSON results for rendering the dashboards.
    Auto-computes mining if file is saved on disk.
    """
    dataset = db.query(Dataset).filter(Dataset.id == _to_uuid(dataset_id), Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    result = db.query(MiningResult).filter(MiningResult.dataset_id == dataset.id).first()
    if not result:
        file_path = Path("uploads") / f"{dataset.id}.{dataset.file_type}"
        if file_path.exists() and dataset.column_mapping:
            try:
                from app.routers.datasets import _read_dataframe
                with open(file_path, "rb") as f:
                    df = _read_dataframe(f.read(), dataset.file_type)
                mapping = dataset.column_mapping.as_dict()
                gate = compute_gate(mapping)
                result = MiningResult(
                    dataset_id=dataset.id,
                    rfm_segments=run_rfm(df, mapping) if gate.rfm.enabled else None,
                    customer_clusters=run_clustering(df, mapping) if gate.clustering.enabled else None,
                    association_rules=run_association_rules(df, mapping) if gate.association_rules.enabled else None,
                    sales_patterns=run_sales_patterns(df, mapping) if gate.sales_patterns.enabled else None,
                    anomalies=run_anomaly_detection(df, mapping) if gate.anomaly_detection.enabled else None,
                    product_performance=run_product_performance(df, mapping)
                )
                db.add(result)
                dataset.status = DatasetStatus.ready
                db.commit()
                db.refresh(result)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Auto-mining error: {e}")
        else:
            raise HTTPException(status_code=404, detail="No mining results found. Please confirm column mapping in Data Upload first.")

    return {
        "rfm_segments": result.rfm_segments,
        "customer_clusters": result.customer_clusters,
        "association_rules": result.association_rules,
        "sales_patterns": result.sales_patterns,
        "anomalies": result.anomalies,
        "product_performance": result.product_performance
    }
