"""
What-If Scenario Simulation Router
==================================
Endpoints to model business scenarios (pricing, discounts, churn retention, bundling).
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.database import get_db
from app.models.dataset import Dataset
from app.models.mining import MiningResult
from app.models.user import User
from app.services.auth_service import decode_access_token
from app.services.whatif_service import run_scenario_simulation

router = APIRouter(prefix="/whatif", tags=["What-If Simulation"])
bearer_scheme = HTTPBearer()


class ScenarioRequest(BaseModel):
    type: str = "price_change"
    price_change_pct: Optional[float] = 5.0
    elasticity: Optional[float] = -1.2
    discount_pct: Optional[float] = 10.0
    volume_boost_pct: Optional[float] = 15.0
    churn_recovery_pct: Optional[float] = 20.0
    bundle_discount_pct: Optional[float] = 8.0
    bundle_uptake_pct: Optional[float] = 15.0


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


@router.post("/{dataset_id}/simulate")
def simulate_scenario(
    dataset_id: str,
    request: ScenarioRequest,
    current_user: User = Depends(_get_current_user),
    db: Session = Depends(get_db),
):
    """
    Executes a scenario simulation against the dataset's computed baseline.
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

    mining_data = {
        "rfm_segments": result.rfm_segments,
        "customer_clusters": result.customer_clusters,
        "association_rules": result.association_rules,
        "sales_patterns": result.sales_patterns,
        "anomalies": result.anomalies
    }

    simulation_result = run_scenario_simulation(mining_data, request.model_dump())
    return simulation_result
