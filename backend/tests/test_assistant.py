import pytest
from app.services.assistant_service import (
    generate_deterministic_answer,
    generate_suggested_questions,
    _classify_query_intent
)


@pytest.fixture
def mock_mining_data():
    return {
        "rfm_segments": [
            {"Segment": "Champions", "Monetary": 150000.0, "Customer_ID": "CUST_001"},
            {"Segment": "Champions", "Monetary": 120000.0, "Customer_ID": "CUST_002"},
            {"Segment": "At Risk", "Monetary": 80000.0, "Customer_ID": "CUST_003"},
            {"Segment": "Lost", "Monetary": 40000.0, "Customer_ID": "CUST_004"},
        ],
        "customer_clusters": {
            "total_customers": 4,
            "clusters": [
                {
                    "name": "High-Value Loyalists",
                    "size": 2,
                    "avg_spend": 135000.0,
                    "avg_purchases": 5.0,
                    "description": "Top repeat customers."
                },
                {
                    "name": "At-Risk Spenders",
                    "size": 2,
                    "avg_spend": 60000.0,
                    "avg_purchases": 1.5,
                    "description": "Dormant accounts."
                }
            ]
        },
        "association_rules": [
            {
                "antecedent": "MacBook Pro M3",
                "consequent": "Magic Mouse",
                "support": 0.25,
                "confidence": 0.78,
                "lift": 2.45
            }
        ],
        "sales_patterns": [
            {"date": "2025-01-01", "revenue": 100000.0},
            {"date": "2025-01-02", "revenue": 140000.0},
            {"date": "2025-01-03", "revenue": 150000.0}
        ],
        "anomalies": [
            {"date": "2025-01-03", "value": 150000.0, "reason": "Festive surge"}
        ]
    }


def test_classify_intent():
    assert _classify_query_intent("What items should I bundle?") == "bundles"
    assert _classify_query_intent("How many customers are at risk of churning?") == "churn"
    assert _classify_query_intent("What are our customer personas?") == "personas"
    assert _classify_query_intent("Why was there an anomaly?") == "anomalies"
    assert _classify_query_intent("What was our total revenue?") == "revenue"


def test_suggested_questions(mock_mining_data):
    qs = generate_suggested_questions(mock_mining_data)
    assert len(qs) >= 3
    assert any("bought together" in q for q in qs)
    assert any("churning" in q for q in qs)


def test_bundles_answer(mock_mining_data):
    res = generate_deterministic_answer("Which products sell together?", mock_mining_data)
    assert "Top Product Cross-Sell" in res["answer"]
    assert "MacBook Pro M3" in res["answer"]
    assert "Magic Mouse" in res["answer"]
    assert len(res["evidence"]) > 0
    assert res["related_module"]["url"] == "/app/products"


def test_churn_answer(mock_mining_data):
    res = generate_deterministic_answer("Who is at risk of churning?", mock_mining_data)
    assert "Customer Churn" in res["answer"]
    assert "₹" in res["answer"]
    assert len(res["evidence"]) >= 2
    assert res["related_module"]["url"] == "/app/customers"


def test_revenue_answer_inr(mock_mining_data):
    res = generate_deterministic_answer("How much revenue did we generate?", mock_mining_data)
    assert "Sales & Revenue Summary" in res["answer"]
    assert "₹" in res["answer"]
    assert res["related_module"]["url"] == "/app/patterns"


def test_general_fallback_answer(mock_mining_data):
    res = generate_deterministic_answer("Hello! Can you summarize my store?", mock_mining_data)
    assert "Business Intelligence Briefing" in res["answer"]
    assert "₹" in res["answer"]
    assert len(res["suggested_follow_ups"]) >= 2
