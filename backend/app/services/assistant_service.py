"""
Conversational Assistant Service ("Ask Nex Mine")
=================================================
Processes natural language questions from business owners and returns data-backed
answers grounded in computed mining findings, formatted in Indian Rupees (₹).

Dual-Mode Architecture:
1. Anthropic Claude 3.5 Sonnet (when API key is available).
2. Deterministic Semantic Intent Synthesizer (offline, guaranteed zero-hallucination).
"""

import json
import logging
from typing import Dict, Any, List, Optional
from app.config import settings

logger = logging.getLogger(__name__)


def generate_suggested_questions(mining_data: Dict[str, Any]) -> List[str]:
    """
    Generates dynamic prompt starter chips tailored to the computed data.
    """
    questions = []
    rules = mining_data.get("association_rules") or []
    rfm = mining_data.get("rfm_segments") or []
    anomalies = mining_data.get("anomalies") or []

    if rules:
        questions.append("What products are most frequently bought together?")
    if rfm:
        questions.append("How many customers are at risk of churning?")
        questions.append("What are our highest-spending customer personas?")
    if anomalies:
        questions.append(f"Why was there an anomaly on {anomalies[0].get('date')}?")
    else:
        questions.append("What is our overall sales trend and daily average?")

    questions.append("What strategic actions will drive the most revenue?")
    return questions[:4]


def _classify_query_intent(query: str) -> str:
    """Classifies user intent for the deterministic engine."""
    q = query.lower()

    if any(k in q for k in ["bundle", "together", "pair", "cross-sell", "bought with", "affinity", "market basket"]):
        return "bundles"
    if any(k in q for k in ["churn", "at risk", "at-risk", "lost", "dormant", "inactive", "leave", "defact"]):
        return "churn"
    if any(k in q for k in ["persona", "cluster", "vip", "high roller", "champion", "segment", "buyer type"]):
        return "personas"
    if any(k in q for k in ["anomaly", "outlier", "spike", "drop", "dip", "unusual", "irregular"]):
        return "anomalies"
    if any(k in q for k in ["what if", "price change", "discount", "simulate", "elasticity"]):
        return "whatif"
    if any(k in q for k in ["revenue", "sales", "total", "earned", "daily", "trend", "money", "how much"]):
        return "revenue"
    return "general"


def generate_deterministic_answer(query: str, mining_data: Dict[str, Any], meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Generates accurate, empirical answers grounded in computed data metrics in INR (₹).
    """
    intent = _classify_query_intent(query)

    rfm = mining_data.get("rfm_segments") or []
    clusters = (mining_data.get("customer_clusters") or {}).get("clusters") or []
    rules = mining_data.get("association_rules") or []
    patterns = mining_data.get("sales_patterns") or []
    anomalies = mining_data.get("anomalies") or []

    total_revenue = sum(p.get("revenue", 0.0) for p in patterns)
    if total_revenue <= 0 and rfm:
        total_revenue = sum(float(r.get("Monetary", 0.0)) for r in rfm)

    total_customers = len(rfm) if rfm else (mining_data.get("customer_clusters") or {}).get("total_customers", 0)

    # 1. Product Bundles Intent
    if intent == "bundles":
        if not rules:
            return {
                "answer": (
                    "No strong market basket association rules were found in this dataset. "
                    "This typically occurs if transactions rarely contain multiple distinct items, "
                    "or if products lack unique transaction basket identifiers."
                ),
                "evidence": ["0 association rules meeting 10% support threshold"],
                "related_module": {"title": "Product Intelligence", "url": "/app/products"},
                "suggested_follow_ups": [
                    "What are our overall sales trends?",
                    "How are our customer segments distributed?"
                ]
            }

        top_rules = rules[:3]
        rule_bullets = []
        for r in top_rules:
            rule_bullets.append(
                f"- **{r['antecedent']} + {r['consequent']}**: "
                f"Shoppers who purchase *{r['antecedent']}* are **{r['lift']}x more likely** to also buy *{r['consequent']}* "
                f"({round(r['confidence'] * 100)}% confidence)."
            )

        answer = (
            f"### Top Product Cross-Sell Opportunities\n\n"
            f"Based on market basket analysis across your orders, here are your strongest product affinities:\n\n"
            + "\n".join(rule_bullets) + "\n\n"
            f"**Strategic Advice**: Create a bundled offer combining `{top_rules[0]['antecedent']}` with "
            f"`{top_rules[0]['consequent']}` at an introductory 5–10% discount on product pages to expand average order value."
        )

        return {
            "answer": answer,
            "evidence": [
                f"{len(rules)} association rules mined",
                f"Top lift: {top_rules[0]['lift']}x",
                f"Top confidence: {round(top_rules[0]['confidence'] * 100)}%"
            ],
            "related_module": {"title": "Product Intelligence", "url": "/app/products"},
            "suggested_follow_ups": [
                f"What if we offer an 8% bundle discount on {top_rules[0]['antecedent']}?",
                "Who are our top spending customers?"
            ]
        }

    # 2. Churn / Customer Risk Intent
    elif intent == "churn":
        at_risk = [r for r in rfm if r.get("Segment") == "At Risk"]
        lost = [r for r in rfm if r.get("Segment") == "Lost"]
        champions = [r for r in rfm if r.get("Segment") == "Champions"]

        at_risk_spend = sum(float(r.get("Monetary", 0.0)) for r in at_risk)
        lost_spend = sum(float(r.get("Monetary", 0.0)) for r in lost)
        total_risk_spend = at_risk_spend + lost_spend
        churn_pct = round(((len(at_risk) + len(lost)) / max(total_customers, 1)) * 100, 1)

        answer = (
            f"### Customer Churn & Retention Analysis\n\n"
            f"Currently, **{len(at_risk) + len(lost)} customers ({churn_pct}% of total base)** are classified as inactive or at-risk:\n\n"
            f"- **At Risk ({len(at_risk)} customers)**: High past spending (totaling **₹{at_risk_spend:,.2f}**), but their purchase recency has dropped into the bottom quartile.\n"
            f"- **Lost ({len(lost)} customers)**: Dormant accounts representing **₹{lost_spend:,.2f}** in historical sales.\n\n"
            f"**Potential Recovery**: Re-activating just 25% of this cohort would recover approximately "
            f"**₹{round(total_risk_spend * 0.25):,.2f}** in revenue."
        )

        return {
            "answer": answer,
            "evidence": [
                f"{len(at_risk)} At-Risk customer profiles",
                f"{len(lost)} Lost customer profiles",
                f"₹{total_risk_spend:,.2f} historical revenue at risk"
            ],
            "related_module": {"title": "Customer Intelligence", "url": "/app/customers"},
            "suggested_follow_ups": [
                "What if we launch a 25% churn recovery campaign?",
                "Tell me about our Champions group"
            ]
        }

    # 3. Customer Personas / Clusters Intent
    elif intent == "personas":
        if not clusters:
            return {
                "answer": f"We analyzed {total_customers} customer records. No multi-dimensional cluster groups were computed.",
                "evidence": [f"{total_customers} customers"],
                "related_module": {"title": "Customer Intelligence", "url": "/app/customers"},
                "suggested_follow_ups": ["What is our total revenue?"]
            }

        cluster_bullets = []
        for c in clusters:
            cluster_bullets.append(
                f"- **{c['name']}** ({c['size']} customers): "
                f"Average spend of **₹{c['avg_spend']:,.2f}** over {c['avg_purchases']} average purchases. "
                f"*{c['description']}*"
            )

        answer = (
            f"### AI Customer Personas\n\n"
            f"Using K-Means behavioral clustering on purchase volume and ticket size, your {total_customers} customers divide into {len(clusters)} distinct personas:\n\n"
            + "\n".join(cluster_bullets) + "\n\n"
            f"**Actionable Takeaway**: Focus VIP loyalty rewards on your highest-spend cohort, while deploying automated second-purchase incentives to one-time buyers."
        )

        return {
            "answer": answer,
            "evidence": [
                f"{len(clusters)} distinct behavioral personas",
                f"{total_customers} total customer profiles clustered"
            ],
            "related_module": {"title": "Customer Intelligence", "url": "/app/customers"},
            "suggested_follow_ups": [
                "How many customers are at risk of churning?",
                "What products are most frequently bought together?"
            ]
        }

    # 4. Anomalies Intent
    elif intent == "anomalies":
        if not anomalies:
            return {
                "answer": (
                    "No statistical anomalies were detected in your transaction timeline. "
                    "Daily revenue remained within normal standard deviations."
                ),
                "evidence": ["Isolation Forest model: 0 outliers detected"],
                "related_module": {"title": "Pattern Discovery", "url": "/app/patterns"},
                "suggested_follow_ups": ["What are our daily revenue trends?"]
            }

        anomaly_bullets = []
        for a in anomalies[:4]:
            anomaly_bullets.append(
                f"- **{a.get('date')}**: Recorded **₹{float(a.get('value', 0)):,.2f}** — *{a.get('reason', 'Statistically outside standard range')}*"
            )

        answer = (
            f"### Detected Outliers & Anomalies\n\n"
            f"Our machine learning model (Isolation Forest) identified **{len(anomalies)} irregular sales event(s)**:\n\n"
            + "\n".join(anomaly_bullets) + "\n\n"
            f"**Context**: Volume spikes typically correlate with promotional events, festive shopping, or large corporate orders. "
            f"Volume dips indicate potential stockouts, operational downtime, or payment gateway failures."
        )

        return {
            "answer": answer,
            "evidence": [
                f"{len(anomalies)} anomalies detected",
                f"Latest event on {anomalies[0].get('date')}"
            ],
            "related_module": {"title": "Pattern Discovery", "url": "/app/patterns"},
            "suggested_follow_ups": [
                "What is our overall sales trend?",
                "How can we prevent churn during volume dips?"
            ]
        }

    # 5. What-If Scenarios Intent
    elif intent == "whatif":
        answer = (
            f"### Scenario Modeling (What-If Engine)\n\n"
            f"You can simulate commercial changes against your baseline revenue of **₹{total_revenue:,.2f}**:\n\n"
            f"1. **Price Adjustment**: Model elasticity to see if price hikes expand or contract total margin.\n"
            f"2. **Promotional Discount**: Test whether volume growth compensates for lower unit prices.\n"
            f"3. **Customer Retention**: Calculate revenue recovered by re-engaging At-Risk accounts.\n"
            f"4. **Product Bundling**: Project revenue uplift from cross-selling affinity pairs."
        )
        return {
            "answer": answer,
            "evidence": [f"Baseline revenue: ₹{total_revenue:,.2f}"],
            "related_module": {"title": "What-If Analysis", "url": "/app/whatif"},
            "suggested_follow_ups": [
                "What happens if we increase prices by 5%?",
                "How much revenue is at risk from churn?"
            ]
        }

    # 6. Revenue / Sales Trends Intent
    elif intent == "revenue":
        days_count = len(patterns)
        avg_daily = round(total_revenue / max(days_count, 1), 2)
        peak_day = max(patterns, key=lambda x: x.get("revenue", 0)) if patterns else None

        answer = (
            f"### Sales & Revenue Summary\n\n"
            f"- **Cumulative Revenue**: **₹{total_revenue:,.2f}** across {days_count} recorded days.\n"
            f"- **Average Daily Revenue**: **₹{avg_daily:,.2f}** per active day.\n"
        )
        if peak_day:
            answer += f"- **Peak Revenue Day**: **{peak_day.get('date')}** with **₹{peak_day.get('revenue', 0):,.2f}** in sales.\n"

        if rfm:
            avg_spend = round(total_revenue / max(total_customers, 1), 2)
            answer += f"- **Average Revenue per Customer**: **₹{avg_spend:,.2f}** across {total_customers} analyzed accounts.\n"

        return {
            "answer": answer,
            "evidence": [
                f"Total: ₹{total_revenue:,.2f}",
                f"Days: {days_count}",
                f"Analyzed customers: {total_customers}"
            ],
            "related_module": {"title": "Pattern Discovery", "url": "/app/patterns"},
            "suggested_follow_ups": [
                "What are our top product bundles?",
                "How many customers are at risk of churning?"
            ]
        }

    # 7. General / Executive Briefing
    else:
        answer = (
            f"### Business Intelligence Briefing\n\n"
            f"Here is a summary of your active dataset:\n\n"
            f"- **Financial Scale**: **₹{total_revenue:,.2f}** generated across {len(patterns)} days.\n"
            f"- **Customer Health**: {total_customers} customer profiles analyzed with "
            f"{(mining_data.get('customer_clusters') or {}).get('clusters', [{}])[0].get('name', 'behavioral personas')} identified.\n"
        )
        if rules:
            answer += f"- **Top Product Cross-Sell**: `{rules[0]['antecedent']}` + `{rules[0]['consequent']}` ({rules[0]['lift']}x lift).\n"
        if anomalies:
            answer += f"- **Active Outliers**: {len(anomalies)} volume outlier(s) detected.\n"

        answer += (
            f"\n*You can ask me specific questions like:*\n"
            f"- *'What products should I bundle?'*\n"
            f"- *'How many customers are at risk?'*\n"
            f"- *'Explain our customer personas'*"
        )

        return {
            "answer": answer,
            "evidence": [
                f"₹{total_revenue:,.2f} Total Revenue",
                f"{total_customers} Customers Analyzed",
                f"{len(rules)} Association Rules Mined"
            ],
            "related_module": {"title": "AI Insights", "url": "/app/insights"},
            "suggested_follow_ups": [
                "What products are most frequently bought together?",
                "How many customers are at risk of churning?",
                "What are our highest-spending customer personas?"
            ]
        }


def generate_claude_answer(query: str, mining_data: Dict[str, Any], history: Optional[List[Dict[str, str]]] = None) -> Optional[Dict[str, Any]]:
    """
    Calls Anthropic Claude 3.5 Sonnet to provide an analytical, conversational response.
    """
    try:
        import anthropic
    except ImportError:
        return None

    api_key = settings.anthropic_api_key
    if not api_key or api_key.startswith("sk-ant-CHANGE_ME"):
        return None

    try:
        client = anthropic.Anthropic(api_key=api_key)

        prompt = f"""
You are the NexMine Intelligent Retail Data Assistant ("Ask Nex Mine").
A business owner has asked you a question about their commerce data.

User Question: "{query}"

Computed Data Facts (Ground Truth):
{json.dumps(mining_data, indent=2)}

STRICT RULES:
1. Every number, percentage, count, customer group, and product name MUST be verified against the provided facts. Never fabricate numbers.
2. Format ALL currency amounts in Indian Rupees (₹) using standard commas (e.g. ₹1,49,900 or ₹12.5 Lakh).
3. Provide a clear, executive-level markdown response.
4. Output strict JSON matching this schema:
{{
  "answer": "<detailed markdown response>",
  "evidence": ["<citation 1>", "<citation 2>"],
  "related_module": {{
    "title": "<Customer Intelligence | Product Intelligence | Pattern Discovery | What-If Analysis | AI Insights>",
    "url": "</app/customers | /app/products | /app/patterns | /app/whatif | /app/insights>"
  }},
  "suggested_follow_ups": ["<follow-up 1>", "<follow-up 2>"]
}}
"""

        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=2000,
            temperature=0.2,
            messages=[{"role": "user", "content": prompt}]
        )

        content = response.content[0].text.strip()
        if content.startswith("```"):
            lines = content.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            content = "\n".join(lines).strip()

        parsed = json.loads(content)
        return parsed

    except Exception as e:
        logger.warning(f"Claude assistant call failed: {e}. Falling back to deterministic engine.")
        return None


def ask_assistant(query: str, mining_data: Dict[str, Any], meta: Optional[Dict[str, Any]] = None, history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
    """
    Main entry point for Ask Nex Mine.
    Attempts Claude if key exists, otherwise uses deterministic semantic engine.
    """
    claude_res = generate_claude_answer(query, mining_data, history)
    if claude_res:
        return claude_res

    return generate_deterministic_answer(query, mining_data, meta)
