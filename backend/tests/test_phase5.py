"""
Unit tests for Phase 5: AI Insights & What-If Simulation
"""
import pytest
from app.services.insights_service import generate_deterministic_insights
from app.services.whatif_service import run_scenario_simulation


@pytest.fixture
def mock_mining_data():
    return {
        "rfm_segments": [
            {"customer_id": "C1", "Recency": 2, "Frequency": 8, "Monetary": 1200.0, "RFM_Score": 555, "Segment": "Champions"},
            {"customer_id": "C2", "Recency": 5, "Frequency": 6, "Monetary": 800.0, "RFM_Score": 444, "Segment": "Champions"},
            {"customer_id": "C3", "Recency": 15, "Frequency": 3, "Monetary": 300.0, "RFM_Score": 333, "Segment": "Loyal Customers"},
            {"customer_id": "C4", "Recency": 45, "Frequency": 1, "Monetary": 50.0, "RFM_Score": 111, "Segment": "At Risk"},
            {"customer_id": "C5", "Recency": 60, "Frequency": 1, "Monetary": 40.0, "RFM_Score": 111, "Segment": "Lost"},
        ],
        "customer_clusters": {
            "clusters": [
                {"cluster_id": 0, "name": "High Rollers", "description": "High spending cohort", "size": 2, "avg_purchases": 7.0, "avg_spend": 1000.0},
                {"cluster_id": 1, "name": "One-Time Shoppers", "description": "Low frequency cohort", "size": 2, "avg_purchases": 1.0, "avg_spend": 45.0},
                {"cluster_id": 2, "name": "Standard Customers", "description": "Average cohort", "size": 1, "avg_purchases": 3.0, "avg_spend": 300.0},
            ],
            "total_customers": 5
        },
        "association_rules": [
            {"antecedent": "Coffee Maker", "consequent": "Coffee Pods", "support": 0.15, "confidence": 0.75, "lift": 2.5},
            {"antecedent": "Desk Mat", "consequent": "Mouse", "support": 0.10, "confidence": 0.60, "lift": 1.8}
        ],
        "sales_patterns": [
            {"date": "2025-01-01", "revenue": 1000.0},
            {"date": "2025-01-02", "revenue": 1200.0},
            {"date": "2025-01-03", "revenue": 190.0}
        ],
        "anomalies": [
            {"date": "2025-01-03", "value": 190.0, "reason": "Unusual volume drop"}
        ]
    }


def test_deterministic_insights_generation(mock_mining_data):
    insights = generate_deterministic_insights(mock_mining_data)

    assert "executive_summary" in insights
    assert "recommendations" in insights
    assert "early_warnings" in insights

    summary = insights["executive_summary"]
    assert "status" in summary
    assert len(summary["narrative"]) >= 2
    assert len(summary["key_metrics"]) == 4

    # Verify recommendations contain actionable items derived from rules and churn
    recs = insights["recommendations"]
    assert len(recs) >= 2
    categories = [r["category"] for r in recs]
    assert "Revenue Growth" in categories or "Customer Retention" in categories

    # Verify early warnings captured the anomaly
    warnings = insights["early_warnings"]
    assert len(warnings) >= 1
    assert any("2025-01-03" in w["title"] or "2025-01-03" in w["detail"] for w in warnings)


def test_whatif_price_change(mock_mining_data):
    scenario = {
        "type": "price_change",
        "price_change_pct": 10.0,
        "elasticity": -1.0
    }
    result = run_scenario_simulation(mock_mining_data, scenario)

    assert result["scenario_type"] == "price_change"
    assert result["baseline_revenue"] == 2390.0
    assert "projected_revenue" in result
    assert "revenue_delta" in result
    assert "confidence" in result


def test_whatif_discount_campaign(mock_mining_data):
    scenario = {
        "type": "discount_campaign",
        "discount_pct": 10.0,
        "volume_boost_pct": 20.0
    }
    result = run_scenario_simulation(mock_mining_data, scenario)

    assert result["scenario_type"] == "discount_campaign"
    assert result["baseline_revenue"] == 2390.0
    # 2390 * (1 - 0.10) * (1 + 0.20) = 2390 * 0.9 * 1.2 = 2390 * 1.08 = 2581.2
    assert result["projected_revenue"] == 2581.2
    assert result["revenue_delta"] > 0


def test_whatif_customer_retention(mock_mining_data):
    scenario = {
        "type": "customer_retention",
        "churn_recovery_pct": 50.0  # Recover 1 of the 2 at-risk/lost customers
    }
    result = run_scenario_simulation(mock_mining_data, scenario)

    assert result["scenario_type"] == "customer_retention"
    assert result["parameters"]["recovered_customers"] == 1
    assert result["revenue_delta"] > 0
    assert result["projected_revenue"] > result["baseline_revenue"]


def test_whatif_bundle_offer(mock_mining_data):
    scenario = {
        "type": "bundle_offer",
        "bundle_discount_pct": 5.0,
        "bundle_uptake_pct": 10.0
    }
    result = run_scenario_simulation(mock_mining_data, scenario)

    assert result["scenario_type"] == "bundle_offer"
    assert result["parameters"]["primary_item"] == "Coffee Maker"
    assert result["parameters"]["bundled_item"] == "Coffee Pods"
    assert result["projected_revenue"] > result["baseline_revenue"]
