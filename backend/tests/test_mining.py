"""
Unit tests for Phase 4 Data Mining Engine
"""
import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

from app.services.mining_service import (
    run_rfm,
    run_clustering,
    run_association_rules,
    run_sales_patterns,
    run_anomaly_detection
)
from app.services.gating_service import compute_gate


@pytest.fixture
def sample_retail_df():
    """Generates a realistic transaction dataset for mining tests."""
    np.random.seed(42)
    base_date = datetime(2025, 1, 1)
    
    customers = [f"CUST_{i:03d}" for i in range(1, 25)]
    products = ["Laptop", "Mouse", "Keyboard", "Headphones", "USB Cable", "Monitor", "Webcam"]
    
    rows = []
    for tx_id in range(1, 120):
        cust = np.random.choice(customers)
        date = base_date + timedelta(days=int(np.random.randint(0, 60)))
        
        # Pick 1 to 3 products per transaction
        n_items = np.random.randint(1, 4)
        chosen_items = np.random.choice(products, size=n_items, replace=False)
        
        for item in chosen_items:
            qty = np.random.randint(1, 4)
            price = {
                "Laptop": 1200.0, "Mouse": 25.0, "Keyboard": 75.0,
                "Headphones": 80.0, "USB Cable": 10.0, "Monitor": 300.0, "Webcam": 50.0
            }[item]
            
            rows.append({
                "transaction_id": f"TX_{tx_id:04d}",
                "customer_id": cust,
                "date": date.strftime("%Y-%m-%d"),
                "product": item,
                "quantity": qty,
                "unit_price": price,
                "total_amount": qty * price
            })
            
    return pd.DataFrame(rows)


@pytest.fixture
def full_mapping():
    return {
        "transaction_id": "transaction_id",
        "customer_id": "customer_id",
        "date": "date",
        "product": "product",
        "quantity": "quantity",
        "unit_price": "unit_price",
        "total_amount": "total_amount"
    }


def test_gating_service_rules(full_mapping):
    gate = compute_gate(full_mapping)
    assert gate.rfm.enabled is True
    assert gate.clustering.enabled is True
    assert gate.association_rules.enabled is True
    assert gate.sales_patterns.enabled is True
    assert gate.anomaly_detection.enabled is True

    # Check that missing columns disable the respective gate with human reason
    incomplete_mapping = {"date": "date", "total_amount": "total_amount"}
    gate_inc = compute_gate(incomplete_mapping)
    assert gate_inc.rfm.enabled is False
    assert "Customer ID" in gate_inc.rfm.reason
    assert gate_inc.clustering.enabled is False
    assert gate_inc.association_rules.enabled is False
    assert gate_inc.sales_patterns.enabled is True


def test_rfm_calculation(sample_retail_df, full_mapping):
    results = run_rfm(sample_retail_df, full_mapping)
    assert len(results) > 0
    first = results[0]
    assert "customer_id" in first
    assert "Recency" in first
    assert "Frequency" in first
    assert "Monetary" in first
    assert "RFM_Score" in first
    assert "Segment" in first
    assert first["Segment"] in ["Champions", "Loyal Customers", "Potential Loyalists", "At Risk", "Lost"]


def test_clustering(sample_retail_df, full_mapping):
    results = run_clustering(sample_retail_df, full_mapping)
    assert "clusters" in results
    assert "total_customers" in results
    assert len(results["clusters"]) >= 2
    for cluster in results["clusters"]:
        assert "cluster_id" in cluster
        assert "name" in cluster
        assert "description" in cluster
        assert "size" in cluster
        assert cluster["size"] > 0
        assert "avg_spend" in cluster


def test_association_rules(sample_retail_df, full_mapping):
    results = run_association_rules(sample_retail_df, full_mapping)
    assert isinstance(results, list)
    if len(results) > 0:
        rule = results[0]
        assert "antecedent" in rule
        assert "consequent" in rule
        assert "confidence" in rule
        assert "lift" in rule
        assert rule["lift"] >= 1.0


def test_sales_patterns(sample_retail_df, full_mapping):
    results = run_sales_patterns(sample_retail_df, full_mapping)
    assert len(results) > 0
    assert "date" in results[0]
    assert "revenue" in results[0]
    assert results[0]["revenue"] > 0


def test_anomaly_detection(sample_retail_df, full_mapping):
    # Artificially inject an extreme outlier day
    outlier_df = sample_retail_df.copy()
    outlier_row = {
        "transaction_id": "TX_9999",
        "customer_id": "CUST_999",
        "date": "2025-01-15",
        "product": "Laptop",
        "quantity": 100,
        "unit_price": 1200.0,
        "total_amount": 120000.0
    }
    outlier_df = pd.concat([outlier_df, pd.DataFrame([outlier_row])], ignore_index=True)
    
    anomalies = run_anomaly_detection(outlier_df, full_mapping)
    assert isinstance(anomalies, list)
    assert len(anomalies) > 0
    # Should detect 2025-01-15 as anomaly
    anomaly_dates = [a["date"] for a in anomalies]
    assert "2025-01-15" in anomaly_dates
