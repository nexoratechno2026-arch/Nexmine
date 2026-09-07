"""
AI Insights Router
==================
Endpoints to fetch and generate AI executive summaries, recommendations, and warnings.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.database import get_db
from app.models.dataset import Dataset
from app.models.mining import MiningResult
from app.models.user import User
from app.services.auth_service import decode_access_token
from app.services.insights_service import generate_insights

router = APIRouter(prefix="/insights", tags=["AI Insights"])
bearer_scheme = HTTPBearer()


import uuid

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


@router.get("/{dataset_id}")
def get_insights(
    dataset_id: str,
    refresh: bool = False,
    current_user: User = Depends(_get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns AI insights for the dataset. If cached in MiningResult.insights and refresh=False,
    returns cached insights instantly. Otherwise generates fresh insights and saves them.
    """
    from pathlib import Path
    dataset = db.query(Dataset).filter(Dataset.id == _to_uuid(dataset_id), Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found. Please upload a dataset in Data Upload first.")

    result = db.query(MiningResult).filter(MiningResult.dataset_id == dataset.id).first()
    if not result:
        file_path = Path("uploads") / f"{dataset.id}.{dataset.file_type}"
        if file_path.exists() and dataset.column_mapping:
            try:
                from app.routers.datasets import _read_dataframe
                from app.services.gating_service import compute_gate
                from app.services.mining_service import (
                    run_rfm, run_clustering, run_association_rules,
                    run_sales_patterns, run_anomaly_detection
                )
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
                    anomalies=run_anomaly_detection(df, mapping) if gate.anomaly_detection.enabled else None
                )
                db.add(result)
                db.commit()
                db.refresh(result)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Could not run data mining: {e}")
        else:
            raise HTTPException(status_code=400, detail="Data mining has not been run for this dataset yet. Please confirm column mapping in Data Upload first.")

    # Check cached insights
    if result.insights and not refresh:
        return result.insights

    mining_data = {
        "rfm_segments": result.rfm_segments,
        "customer_clusters": result.customer_clusters,
        "association_rules": result.association_rules,
        "sales_patterns": result.sales_patterns,
        "anomalies": result.anomalies
    }

    insights_data = generate_insights(mining_data)

    # Persist in DB
    result.insights = insights_data
    db.commit()

    return insights_data
