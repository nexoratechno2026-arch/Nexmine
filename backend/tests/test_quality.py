import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.dataset import Dataset, DatasetStatus
from app.models.quality import DataQualityReport
from app.services.auth_service import hash_password, create_access_token

client = TestClient(app)


@pytest.fixture
def quality_setup():
    db = SessionLocal()
    user = User(
        email=f"quality_test_{uuid.uuid4().hex[:8]}@example.com",
        hashed_password=hash_password("Password123!"),
        full_name="Quality Tester",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    dataset = Dataset(
        user_id=user.id,
        original_filename="quality_test.csv",
        file_type="csv",
        row_count=50,
        column_count=4,
        status=DatasetStatus.cleaned
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    report = DataQualityReport(
        dataset_id=dataset.id,
        total_rows=50,
        valid_rows=48,
        duplicate_rows=2,
        missing_values_count=3,
        invalid_date_count=0,
        invalid_quantity_count=1,
        invalid_price_count=0,
        outlier_count=1,
        missing_customer_id=0,
        missing_product=0,
        quality_score=94.5,
        column_stats=[
            {
                "column": "amount",
                "nexmine_field": "total_amount",
                "total": 50,
                "missing": 1,
                "pct_missing": 0.02,
                "type_issues": 0,
                "unique_count": 45,
                "sample_values": ["100", "200"],
            }
        ],
        cleaning_log=[
            {
                "action": "remove_duplicates",
                "description": "Removed 2 duplicate rows",
                "rows_affected": 2,
                "severity": "auto",
            }
        ],
        user_attention_items=[],
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    token = create_access_token({"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    yield {"user": user, "dataset": dataset, "report": report, "headers": headers}

    db.close()


def test_get_quality_report(quality_setup):
    dataset_id = str(quality_setup["dataset"].id)
    headers = quality_setup["headers"]

    response = client.get(f"/quality/{dataset_id}", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["dataset_id"] == dataset_id
    assert data["total_rows"] == 50
    assert data["quality_score"] == 94.5
    assert len(data["column_stats"]) == 1
    assert data["column_stats"][0]["column"] == "amount"
    assert len(data["cleaning_log"]) == 1
    assert data["cleaning_log"][0]["action"] == "remove_duplicates"
