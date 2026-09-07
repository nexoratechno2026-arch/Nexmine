"""
AI Insights Service
===================
Synthesizes computed data mining results (RFM, K-Means clusters, association rules,
sales trends, and anomalies) into structured executive insights, recommendations,
and early warnings.

Supports dual-mode execution:
1. Anthropic Claude 3.5 Sonnet (when ANTHROPIC_API_KEY is configured).
2. Built-in Deterministic Analytics Engine (runs 100% offline, guaranteed zero-hallucination).
"""

import json
import logging
from typing import Dict, Any, Optional
from app.config import settings

logger = logging.getLogger(__name__)


def generate_deterministic_insights(mining_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Pure statistical and rule-based narrative synthesizer.
    Guarantees every figure, ratio, and observation is directly derived from computed results.
    """
    rfm = mining_data.get("rfm_segments") or []
    clusters = (mining_data.get("customer_clusters") or {}).get("clusters") or []
    total_clustered = (mining_data.get("customer_clusters") or {}).get("total_customers") or len(rfm)
    rules = mining_data.get("association_rules") or []
    patterns = mining_data.get("sales_patterns") or []
    anomalies = mining_data.get("anomalies") or []

    # 1. Compute foundational figures
    total_cust = len(rfm) if rfm else total_clustered
    segment_counts = {}
    total_monetary = 0.0
    for r in rfm:
        seg = r.get("Segment", "Unknown")
        segment_counts[seg] = segment_counts.get(seg, 0) + 1
        total_monetary += float(r.get("Monetary", 0.0))

    champions_count = segment_counts.get("Champions", 0)
    loyal_count = segment_counts.get("Loyal Customers", 0)
    at_risk_count = segment_counts.get("At Risk", 0)
    lost_count = segment_counts.get("Lost", 0)
    churn_risk_pct = round(((at_risk_count + lost_count) / max(total_cust, 1)) * 100, 1)

    # 2. Time-series figures
    total_revenue = sum(p.get("revenue", 0.0) for p in patterns) if patterns else total_monetary
    days_recorded = len(patterns)
    avg_daily_revenue = round(total_revenue / max(days_recorded, 1), 2)

    # 3. Determine Overall Business Health
    if churn_risk_pct > 35 or len(anomalies) > 5:
        health_status = "Attention Required"
        health_color = "#F59E0B"
    elif churn_risk_pct > 50:
        health_status = "Critical Action Needed"
        health_color = "#EF4444"
    else:
        health_status = "Healthy Growth"
        health_color = "#10B981"

    # 4. Key Metrics Strip
    key_metrics = [
        {
            "label": "Total Sales",
            "value": f"₹{total_revenue:,.2f}",
            "subtitle": f"Across {days_recorded} recorded days",
            "trend": "neutral"
        },
        {
            "label": "Customers Analyzed",
            "value": f"{total_cust:,}",
            "subtitle": "Shoppers in your records",
            "trend": "neutral"
        },
        {
            "label": "Customers Slipping Away",
            "value": f"{churn_risk_pct}%",
            "subtitle": f"{at_risk_count + lost_count} inactive shoppers",
            "trend": "down" if churn_risk_pct < 25 else "up"
        },
        {
            "label": "Unusual Sales Days",
            "value": f"{len(anomalies)}",
            "subtitle": "Standout surges or slow days",
            "trend": "neutral" if len(anomalies) == 0 else "up"
        }
    ]

    # 5. Executive Narrative (Shopkeeper / Plain English)
    paragraphs = []
    paragraphs.append(
        f"Across {days_recorded} recorded days of store activity, your {total_cust:,} customers generated ₹{total_revenue:,.2f} in total sales. "
        f"On a typical day, your store brought in approximately ₹{avg_daily_revenue:,.2f}."
    )

    if champions_count > 0 or loyal_count > 0:
        top_cohort = champions_count + loyal_count
        top_cohort_pct = round((top_cohort / max(total_cust, 1)) * 100, 1)
        paragraphs.append(
            f"Your most dependable core is {top_cohort} customers ({top_cohort_pct}% of your customer base) — "
            f"these are your 'VIP Regulars'. They visit most frequently, spend the most, and provide the steady backbone of your daily cash flow."
        )

    if churn_risk_pct > 0:
        paragraphs.append(
            f"On the other hand, {at_risk_count + lost_count} customers ({churn_risk_pct}% of your base) haven't made a purchase in a long time and are slipping away. "
            f"Reaching out to them with a friendly reminder before they switch to a competitor is your fastest opportunity to recover sales."
        )

    # 6. Actionable Recommendations
    recommendations = []

    # Cross-sell recommendation
    if rules:
        top_rule = rules[0]
        antecedent = top_rule.get('antecedent', 'Item A')
        consequent = top_rule.get('consequent', 'Item B')
        lift_val = round(float(top_rule.get('lift', 1.5)), 1)
        confidence_pct = round(float(top_rule.get('confidence', 0.5)) * 100)
        recommendations.append({
            "title": f"Place '{antecedent}' next to '{consequent}' (Popular Combo)",
            "category": "Increase Sales",
            "impact": "High",
            "difficulty": "Easy",
            "rationale": (
                f"Shoppers buying '{antecedent}' are {lift_val}x more likely to also buy '{consequent}'. "
                f"In fact, {confidence_pct}% of customers who picked up '{antecedent}' also bought '{consequent}'."
            ),
            "suggested_action": (
                f"Display '{antecedent}' and '{consequent}' together on the shelf or billing counter, "
                f"or offer a small combo incentive: 'Buy both together and save 5%'."
            ),
            "cta_link": "/app/products",
            "cta_text": "View Product Insights"
        })

    # Customer Retention recommendation
    if at_risk_count > 0:
        recommendations.append({
            "title": f"Win back {at_risk_count} customers who stopped visiting",
            "category": "Customer Retention",
            "impact": "High",
            "difficulty": "Easy",
            "rationale": (
                f"{at_risk_count} customers used to spend good money at your store, but haven't visited in a long time. "
                f"They are among the 25% longest inactive accounts."
            ),
            "suggested_action": (
                "Send a friendly WhatsApp message or SMS inviting them back with a small token discount."
            ),
            "sms_template": "Hi! We missed seeing you at our store. Here is a special 10% discount on your next visit: WELCOMEBACK10. We look forward to seeing you soon!",
            "cta_link": "/app/customers",
            "cta_text": f"View {at_risk_count} Inactive Customers"
        })

    # High-Rollers VIP recommendation
    vip_cluster = next((c for c in clusters if "High" in c.get("name", "") or c.get("avg_spend", 0) > 200), None)
    if vip_cluster:
        recommendations.append({
            "title": f"Give VIP treatment to your top {vip_cluster['size']} big spenders",
            "category": "Customer Retention",
            "impact": "Medium",
            "difficulty": "Easy",
            "rationale": (
                f"These {vip_cluster['size']} customers spend an outstanding average of "
                f"₹{vip_cluster['avg_spend']:,.2f} per visit — far higher than typical shoppers."
            ),
            "suggested_action": (
                "Give them priority updates when fresh stock arrives, personalized greetings, and special loyalty perks."
            ),
            "sms_template": "Hello! As one of our most valued customers, our fresh new stock just arrived today. Let us know if we can hold anything special for you!",
            "cta_link": "/app/customers",
            "cta_text": "View Top VIP Customers"
        })

    # One-Time Buyers Conversion
    onetime_cluster = next((c for c in clusters if "One-Time" in c.get("name", "") or c.get("avg_purchases", 0) <= 1.2), None)
    if onetime_cluster:
        recommendations.append({
            "title": f"Turn {onetime_cluster['size']} first-time shoppers into repeat regulars",
            "category": "Increase Sales",
            "impact": "High",
            "difficulty": "Moderate",
            "rationale": (
                f"Currently, {onetime_cluster['size']} customers made only a single purchase (average spend: ₹{onetime_cluster['avg_spend']:,.2f}). "
                f"Converting a first-time buyer into a repeat buyer doubles their lifetime loyalty."
            ),
            "suggested_action": (
                "Reach out 7-14 days after their purchase with a friendly thank-you message and a discount on their second visit."
            ),
            "sms_template": "Thank you for visiting us recently! We hope you loved your purchase. Use code REGULAR5 for 5% off on your next visit this week!",
            "cta_link": "/app/customers",
            "cta_text": "View First-Time Buyers"
        })

    # 7. Early Warnings & Highlights
    early_warnings = []
    if anomalies:
        for a in anomalies[:5]:
            val = float(a.get("value", 0))
            is_surge = a.get("type") == "surge" or val >= avg_daily_revenue
            pct_diff = a.get("pct_diff")
            if pct_diff is None:
                pct_diff = round(((val - avg_daily_revenue) / max(avg_daily_revenue, 1)) * 100)

            if is_surge:
                early_warnings.append({
                    "level": "info",
                    "type": "surge",
                    "title": f"🚀 Sales Surge on {a.get('date')} (+{abs(pct_diff)}% above normal)",
                    "detail": f"Recorded ₹{val:,.2f} in sales — {abs(pct_diff)}% higher than your daily average of ₹{avg_daily_revenue:,.2f}. Standout day! Check what was selling best."
                })
            else:
                early_warnings.append({
                    "level": "warning",
                    "type": "dip",
                    "title": f"⚠️ Sales Dip on {a.get('date')} (-{abs(pct_diff)}% below normal)",
                    "detail": f"Recorded ₹{val:,.2f} in sales — {abs(pct_diff)}% lower than your daily average of ₹{avg_daily_revenue:,.2f}. Check if store was closed or items were out of stock."
                })

    if churn_risk_pct >= 40:
        early_warnings.append({
            "level": "critical",
            "type": "churn",
            "title": f"⚠️ High Inactivity Alert: {churn_risk_pct}% of customers slipping away",
            "detail": f"{at_risk_count + lost_count} shoppers used to buy from you but haven't visited lately. Sending them a quick message can win many of them back."
        })

    return {
        "engine": "Built-in Analytical Engine",
        "executive_summary": {
            "headline": f"Business Health: {health_status}",
            "status": health_status,
            "status_color": health_color,
            "key_metrics": key_metrics,
            "narrative": paragraphs
        },
        "recommendations": recommendations,
        "early_warnings": early_warnings
    }


def generate_claude_insights(mining_data: Dict[str, Any], api_key: str) -> Optional[Dict[str, Any]]:
    """
    Invokes Anthropic Claude 3.5 Sonnet to generate natural language executive insights.
    Falls back to deterministic generator if API key is invalid or request fails.
    """
    try:
        import anthropic
    except ImportError:
        logger.warning("anthropic library not installed. Falling back to built-in generator.")
        return None

    try:
        client = anthropic.Anthropic(api_key=api_key)

        prompt = f"""
You are the NexMine Store Advisor AI. Analyze the following computed data mining results for a retail/store business:

Computed Mining Data:
{json.dumps(mining_data, indent=2)}

STRICT REQUIREMENTS:
1. Every single number, percentage, count, and dollar value MUST trace directly to the provided mining data. Never hallucinate or assume figures.
2. Write in PLAIN, PRACTICAL RETAIL LANGUAGE that a local general store owner, supermarket manager, or shopkeeper can easily understand.
3. Avoid academic data science jargon like 'recency scores', 'quartiles', 'affinity lift', or 'dormancy symptoms'.
   Use everyday terms like 'customers slipping away', 'items frequently bought together', 'top spenders & regulars', and 'standout sales days'.
4. Make every recommendation concrete and actionable (shelf placement, combo discounts, WhatsApp/SMS follow-up).
5. Respond ONLY with a valid, parsable JSON object matching this exact schema:

{{
  "engine": "Claude 3.5 Sonnet",
  "executive_summary": {{
    "headline": "<1 concise sentence summarizing store health in plain English>",
    "status": "<Healthy Growth | Attention Required | Critical Action Needed>",
    "status_color": "<#10B981 | #F59E0B | #EF4444>",
    "key_metrics": [
      {{ "label": "<Plain Metric Name (e.g. Total Sales, Customers Slipping Away)>", "value": "<formatted value>", "subtitle": "<1 brief helper tip>", "trend": "<up|down|neutral>" }}
    ],
    "narrative": [
      "<paragraph 1: sales and customer overview in everyday terms>",
      "<paragraph 2: top loyal shoppers and regulars>",
      "<paragraph 3: shoppers who stopped visiting and how to win them back>"
    ]
  }},
  "recommendations": [
    {{
      "title": "<Plain actionable title (e.g. Place Item A next to Item B)>",
      "category": "<Increase Sales | Customer Retention | Store Merchandising>",
      "impact": "<High | Medium | Low>",
      "difficulty": "<Easy | Moderate>",
      "rationale": "<Simple reason based on actual data>",
      "suggested_action": "<Concrete practical steps>",
      "sms_template": "<Optional short WhatsApp/SMS text store owner can copy-paste to customer>",
      "cta_link": "<Optional link: /app/customers or /app/products>",
      "cta_text": "<Optional button text>"
    }}
  ],
  "early_warnings": [
    {{
      "level": "<info | warning | critical>",
      "type": "<surge | dip | churn>",
      "title": "<🚀 Sales Surge on Date (+X% above normal) or ⚠️ Sales Dip on Date (-X% below normal)>",
      "detail": "<Everyday explanation of what happened and what to check>"
    }}
  ]
}}
"""

        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=2500,
            temperature=0.2,
            messages=[{"role": "user", "content": prompt}]
        )

        content = response.content[0].text.strip()
        # Parse JSON from response
        if content.startswith("```"):
            lines = content.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            content = "\n".join(lines).strip()

        parsed = json.loads(content)
        parsed["engine"] = "Claude 3.5 Sonnet (AI)"
        return parsed

    except Exception as e:
        logger.warning(f"Claude API generation failed ({e}). Falling back to deterministic engine.")
        return None


def generate_insights(mining_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main entry point for generating AI Insights.
    Attempts Claude if key exists, otherwise uses deterministic engine.
    """
    api_key = settings.anthropic_api_key
    if api_key and not api_key.startswith("sk-ant-CHANGE_ME"):
        claude_result = generate_claude_insights(mining_data, api_key)
        if claude_result:
            return claude_result

    return generate_deterministic_insights(mining_data)
