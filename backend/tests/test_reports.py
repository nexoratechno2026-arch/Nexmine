import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.dataset import Dataset
from app.models.mining import MiningResult
from app.services.auth_service import hash_password, create_access_token

client = TestClient(app)


@pytest.fixture
def test_setup():
    db = SessionLocal()
    # Create test user
    test_email = f"reports_test_{uuid.uuid4().hex[:8]}@example.com"
    user = User(
        email=test_email,
        hashed_password=hash_password("Password123!"),
        full_name="Report Tester",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create test dataset
    dataset = Dataset(
        user_id=user.id,
        original_filename="test_sales.csv",
        file_type="csv",
        row_count=100,
        column_count=5,
        status="mapped"
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    # Create mining result
    result = MiningResult(
        dataset_id=dataset.id,
        rfm_segments=[
            {"Customer_ID": "CUST_1", "Segment": "Champions", "Recency": 2, "Frequency": 10, "Monetary": 50000.0},
            {"Customer_ID": "CUST_2", "Segment": "At Risk", "Recency": 65, "Frequency": 2, "Monetary": 25000.0},
            {"Customer_ID": "CUST_3", "Segment": "Lost", "Recency": 120, "Frequency": 1, "Monetary": 12000.0},
        ],
        customer_clusters={
            "total_customers": 3,
            "clusters": [
                {"name": "VIP Cohort", "size": 1, "avg_spend": 50000.0, "avg_purchases": 10, "description": "Top VIP"}
            ]
        },
        association_rules=[
            {"antecedent": "Product A", "consequent": "Product B", "support": 0.2, "confidence": 0.8, "lift": 2.5}
        ],
        sales_patterns=[
            {"date": "2025-01-01", "revenue": 40000.0},
            {"date": "2025-01-02", "revenue": 47000.0}
        ],
        anomalies=[
            {"date": "2025-01-02", "value": 47000.0, "reason": "Spike"}
        ]
    )
    db.add(result)
    db.commit()

    token = create_access_token({"sub": str(user.id)})
    dataset_id = str(dataset.id)

    db.close()
    return {"token": token, "dataset_id": dataset_id}


def test_get_executive_report_summary(test_setup):
    headers = {"Authorization": f"Bearer {test_setup['token']}"}
    ds_id = test_setup["dataset_id"]

    res = client.get(f"/reports/{ds_id}/summary", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()

    assert "report_id" in data
    assert "kpis" in data
    assert data["kpis"]["total_revenue"] == 87000.0
    assert data["kpis"]["total_customers"] == 3
    assert len(data["personas"]) == 1
    assert len(data["association_rules"]) == 1
    assert len(data["anomalies"]) == 1


def test_export_at_risk_customers_csv(test_setup):
    headers = {"Authorization": f"Bearer {test_setup['token']}"}
    ds_id = test_setup["dataset_id"]

    res = client.get(f"/reports/{ds_id}/export/at-risk-customers", headers=headers)
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "attachment; filename=" in res.headers["content-disposition"]

    content = res.text
    assert "Customer_ID,Segment,Recency_Days,Purchase_Frequency,Total_Spend_INR" in content
    assert "CUST_2" in content
    assert "CUST_3" in content
    assert "CUST_1" not in content  # Champions shouldn't be in at-risk export


def test_export_association_rules_csv(test_setup):
    headers = {"Authorization": f"Bearer {test_setup['token']}"}
    ds_id = test_setup["dataset_id"]

    res = client.get(f"/reports/{ds_id}/export/association-rules", headers=headers)
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "attachment; filename=" in res.headers["content-disposition"]

    content = res.text
    assert "Primary_Product,Bundled_Product,Support_Pct,Confidence_Pct,Lift_Multiplier" in content
    assert "Product A" in content
    assert "Product B" in content
    assert "2.5" in content
