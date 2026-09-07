"""
Conversational Assistant Router ("Ask Nex Mine")
================================================
Exposes endpoints for querying your dataset in natural language.
"""

import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.dataset import Dataset
from app.models.mining import MiningResult
from app.models.user import User
from app.services.auth_service import decode_access_token
from app.services.assistant_service import ask_assistant, generate_suggested_questions

router = APIRouter(prefix="/assistant", tags=["Assistant"])
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


class AskRequest(BaseModel):
    query: str
    history: Optional[List[Dict[str, str]]] = None


class RelatedModule(BaseModel):
    title: str
    url: str


class AskResponse(BaseModel):
    answer: str
    evidence: List[str]
    related_module: Optional[RelatedModule] = None
    suggested_follow_ups: List[str]


class SuggestedQuestionsResponse(BaseModel):
    questions: List[str]


@router.post("/{dataset_id}/ask", response_model=AskResponse)
def query_assistant(
    dataset_id: str,
    request: AskRequest,
    current_user: User = Depends(_get_current_user),
    db: Session = Depends(get_db),
):
    """
    Asks a natural language question over the dataset's computed findings.
    """
    from pathlib import Path
    dataset = db.query(Dataset).filter(
        Dataset.id == _to_uuid(dataset_id),
        Dataset.user_id == current_user.id
    ).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")

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
                m = dataset.column_mapping.as_dict()
                gate = compute_gate(m)

                rfm = run_rfm(df, m) if gate.rfm.enabled else []
                clusters = run_clustering(df, m) if gate.clustering.enabled else {}
                rules = run_association_rules(df, m) if gate.association_rules.enabled else []
                patterns = run_sales_patterns(df, m) if gate.sales_patterns.enabled else []
                anomalies = run_anomaly_detection(df, m) if gate.anomaly_detection.enabled else []

                result = MiningResult(
                    dataset_id=dataset.id,
                    rfm_segments=rfm,
                    customer_clusters=clusters,
                    association_rules=rules,
                    sales_patterns=patterns,
                    anomalies=anomalies,
                )
                db.add(result)
                db.commit()
                db.refresh(result)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to auto-compute mining results: {str(e)}")
        else:
            raise HTTPException(status_code=400, detail="Data mining has not been run for this dataset yet.")

    mining_data = {
        "rfm_segments": result.rfm_segments or [],
        "customer_clusters": result.customer_clusters or {},
        "association_rules": result.association_rules or [],
        "sales_patterns": result.sales_patterns or [],
        "anomalies": result.anomalies or [],
    }

    meta = {
        "row_count": dataset.row_count,
        "filename": dataset.original_filename
    }

    response_data = ask_assistant(
        query=request.query,
        mining_data=mining_data,
        meta=meta,
        history=request.history
    )

    return AskResponse(**response_data)


@router.get("/{dataset_id}/suggested-questions", response_model=SuggestedQuestionsResponse)
def get_suggested_questions(
    dataset_id: str,
    current_user: User = Depends(_get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns dynamically generated starter prompt questions based on dataset findings.
    """
    dataset = db.query(Dataset).filter(
        Dataset.id == _to_uuid(dataset_id),
        Dataset.user_id == current_user.id
    ).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    result = db.query(MiningResult).filter(MiningResult.dataset_id == dataset.id).first()
    mining_data = {
        "rfm_segments": (result.rfm_segments or []) if result else [],
        "customer_clusters": (result.customer_clusters or {}) if result else {},
        "association_rules": (result.association_rules or []) if result else [],
        "sales_patterns": (result.sales_patterns or []) if result else [],
        "anomalies": (result.anomalies or []) if result else [],
    }

    questions = generate_suggested_questions(mining_data)
    return SuggestedQuestionsResponse(questions=questions)
