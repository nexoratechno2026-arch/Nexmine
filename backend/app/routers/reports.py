"""
Executive Reporting & Export Router
===================================
Generates aggregated executive reports and downloadable CSV exports
for marketing, merchandising, and leadership teams.
"""

import io
import csv
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.dataset import Dataset
from app.models.mining import MiningResult
from app.models.user import User
from app.services.auth_service import decode_access_token
from app.services.insights_service import generate_insights

router = APIRouter(prefix="/reports", tags=["Reports"])
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


def _get_mining_result(dataset_id: str, current_user: User, db: Session) -> tuple[Dataset, MiningResult]:
    dataset = db.query(Dataset).filter(
        Dataset.id == _to_uuid(dataset_id),
        Dataset.user_id == current_user.id
    ).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    result = db.query(MiningResult).filter(MiningResult.dataset_id == dataset.id).first()
    if not result:
        # Check if saved file exists to compute fallback
        from pathlib import Path
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

                result = MiningResult(
                    dataset_id=dataset.id,
                    rfm_segments=run_rfm(df, m) if gate.rfm.enabled else [],
                    customer_clusters=run_clustering(df, m) if gate.clustering.enabled else {},
                    association_rules=run_association_rules(df, m) if gate.association_rules.enabled else [],
                    sales_patterns=run_sales_patterns(df, m) if gate.sales_patterns.enabled else [],
                    anomalies=run_anomaly_detection(df, m) if gate.anomaly_detection.enabled else [],
                )
                db.add(result)
                db.commit()
                db.refresh(result)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to auto-compute mining results: {str(e)}")
        else:
            raise HTTPException(status_code=400, detail="Data mining has not been run for this dataset yet.")

    return dataset, result


@router.get("/{dataset_id}/summary")
def get_executive_report_summary(
    dataset_id: str,
    current_user: User = Depends(_get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Returns the comprehensive executive summary report payload for printing and presentation.
    """
    dataset, result = _get_mining_result(dataset_id, current_user, db)

    rfm = result.rfm_segments or []
    clusters = (result.customer_clusters or {}).get("clusters") or []
    rules = result.association_rules or []
    patterns = result.sales_patterns or []
    anomalies = result.anomalies or []

    # KPIs
    total_revenue = sum(p.get("revenue", 0.0) for p in patterns)
    if total_revenue <= 0 and rfm:
        total_revenue = sum(float(r.get("Monetary", 0.0)) for r in rfm)

    total_customers = len(rfm) if rfm else (result.customer_clusters or {}).get("total_customers", 0)
    avg_order_val = round(total_revenue / max(len(patterns), 1), 2)

    at_risk_count = sum(1 for r in rfm if r.get("Segment") in ["At Risk", "Lost"])
    churn_risk_pct = round((at_risk_count / max(total_customers, 1)) * 100, 1)

    # Get or generate insights
    insights_data = result.insights
    if not insights_data:
        mining_data = {
            "rfm_segments": rfm,
            "customer_clusters": result.customer_clusters or {},
            "association_rules": rules,
            "sales_patterns": patterns,
            "anomalies": anomalies,
        }
        insights_data = generate_insights(mining_data)
        result.insights = insights_data
        db.commit()

    return {
        "report_id": str(uuid.uuid4())[:8],
        "generated_at": datetime.utcnow().strftime("%B %d, %Y - %H:%M UTC"),
        "dataset_meta": {
            "id": str(dataset.id),
            "filename": dataset.original_filename,
            "total_transactions": dataset.row_count,
            "recorded_days": len(patterns)
        },
        "kpis": {
            "total_revenue": round(total_revenue, 2),
            "total_customers": total_customers,
            "avg_daily_revenue": avg_order_val,
            "churn_risk_pct": churn_risk_pct,
            "anomalies_count": len(anomalies)
        },
        "executive_summary": insights_data.get("executive_summary", {}),
        "rfm_segments": rfm[:10], # Top preview
        "rfm_counts": {
            "Champions": sum(1 for r in rfm if r.get("Segment") == "Champions"),
            "Loyal": sum(1 for r in rfm if r.get("Segment") == "Loyal"),
            "At Risk": sum(1 for r in rfm if r.get("Segment") == "At Risk"),
            "Lost": sum(1 for r in rfm if r.get("Segment") == "Lost"),
        },
        "personas": clusters,
        "association_rules": rules[:5],
        "anomalies": anomalies[:5],
        "recommendations": insights_data.get("recommendations", [])
    }


@router.get("/{dataset_id}/export/at-risk-customers")
def export_at_risk_customers_csv(
    dataset_id: str,
    current_user: User = Depends(_get_current_user),
    db: Session = Depends(get_db),
):
    """
    Streams a CSV file of at-risk and lost customers for marketing re-engagement.
    """
    dataset, result = _get_mining_result(dataset_id, current_user, db)
    rfm = result.rfm_segments or []

    # Filter at risk / lost
    at_risk_customers = [r for r in rfm if r.get("Segment") in ["At Risk", "Lost"]]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Customer_ID", "Segment", "Recency_Days", "Purchase_Frequency", "Total_Spend_INR"])

    for c in at_risk_customers:
        writer.writerow([
            c.get("Customer_ID", "Unknown"),
            c.get("Segment", "At Risk"),
            c.get("Recency", 0),
            c.get("Frequency", 0),
            round(float(c.get("Monetary", 0.0)), 2)
        ])

    csv_data = output.getvalue()
    filename = f"nexmine_at_risk_{dataset.id}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/{dataset_id}/export/association-rules")
def export_association_rules_csv(
    dataset_id: str,
    current_user: User = Depends(_get_current_user),
    db: Session = Depends(get_db),
):
    """
    Streams a CSV file of mined product association rules for e-commerce bundling.
    """
    dataset, result = _get_mining_result(dataset_id, current_user, db)
    rules = result.association_rules or []

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Primary_Product", "Bundled_Product", "Support_Pct", "Confidence_Pct", "Lift_Multiplier"])

    for r in rules:
        writer.writerow([
            r.get("antecedent", ""),
            r.get("consequent", ""),
            f"{round(r.get('support', 0) * 100, 2)}%",
            f"{round(r.get('confidence', 0) * 100, 2)}%",
            r.get("lift", 1.0)
        ])

    csv_data = output.getvalue()
    filename = f"nexmine_product_bundles_{dataset.id}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
