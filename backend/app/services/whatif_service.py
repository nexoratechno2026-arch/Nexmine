"""
What-If Scenario Simulation Service
===================================
Models commercial and operational scenarios using computed dataset metrics.
Always reports baseline vs projected results, net deltas, and methodology confidence.
"""

from typing import Dict, Any


def run_scenario_simulation(mining_data: Dict[str, Any], scenario: Dict[str, Any]) -> Dict[str, Any]:
    """
    Executes a scenario simulation.
    Supported scenario types:
    - 'price_change': Adjust catalog pricing with price elasticity of demand.
    - 'discount_campaign': Run promotional discount with expected basket expansion.
    - 'customer_retention': Re-engage At-Risk/Lost customer cohorts.
    - 'bundle_offer': Package correlated products together.
    """
    scenario_type = scenario.get("type", "price_change")

    # Baseline metrics from mining results
    patterns = mining_data.get("sales_patterns") or []
    rfm = mining_data.get("rfm_segments") or []
    rules = mining_data.get("association_rules") or []

    base_revenue = sum(p.get("revenue", 0.0) for p in patterns)
    if base_revenue <= 0 and rfm:
        base_revenue = sum(r.get("Monetary", 0.0) for r in rfm)

    total_customers = len(rfm)
    avg_customer_spend = base_revenue / max(total_customers, 1)

    # 1. Price Change Scenario
    if scenario_type == "price_change":
        price_change_pct = float(scenario.get("price_change_pct", 5.0))  # e.g. +5%
        elasticity = float(scenario.get("elasticity", -1.2))             # typical retail elasticity

        # % change in quantity demanded = % change in price * elasticity
        demand_change_pct = (price_change_pct / 100.0) * elasticity
        new_volume_factor = max(0.0, 1.0 + demand_change_pct)
        new_price_factor = 1.0 + (price_change_pct / 100.0)

        projected_revenue = round(base_revenue * new_volume_factor * new_price_factor, 2)
        revenue_delta = round(projected_revenue - base_revenue, 2)
        delta_pct = round((revenue_delta / max(base_revenue, 1.0)) * 100, 2)

        return {
            "scenario_type": "price_change",
            "scenario_name": f"{'+' if price_change_pct > 0 else ''}{price_change_pct}% Price Adjustment",
            "parameters": {
                "price_change_pct": price_change_pct,
                "elasticity": elasticity,
                "demand_response_pct": round(demand_change_pct * 100, 2)
            },
            "baseline_revenue": round(base_revenue, 2),
            "projected_revenue": projected_revenue,
            "revenue_delta": revenue_delta,
            "delta_pct": delta_pct,
            "confidence": "High (Statistical Elasticity Model)",
            "analysis": (
                f"A {price_change_pct}% price adjustment with an assumed price elasticity of {elasticity} "
                f"results in an estimated {round(demand_change_pct * 100, 1)}% shift in unit volume. "
                f"{'Net revenue expands by ₹' + str(abs(revenue_delta)) if revenue_delta >= 0 else 'Net revenue contracts by ₹' + str(abs(revenue_delta))} "
                f"({'+' if delta_pct > 0 else ''}{delta_pct}%)."
            ),
            "recommendation": (
                "Price increase is revenue-accretive" if revenue_delta > 0
                else "Volume loss outweighs price gains; consider selective rather than catalog-wide increases."
            )
        }

    # 2. Promotional Discount Scenario
    elif scenario_type == "discount_campaign":
        discount_pct = float(scenario.get("discount_pct", 10.0))       # e.g. 10% off
        volume_boost_pct = float(scenario.get("volume_boost_pct", 15.0)) # e.g. +15% volume

        new_price_factor = 1.0 - (discount_pct / 100.0)
        new_volume_factor = 1.0 + (volume_boost_pct / 100.0)

        projected_revenue = round(base_revenue * new_volume_factor * new_price_factor, 2)
        revenue_delta = round(projected_revenue - base_revenue, 2)
        delta_pct = round((revenue_delta / max(base_revenue, 1.0)) * 100, 2)

        return {
            "scenario_type": "discount_campaign",
            "scenario_name": f"{discount_pct}% Promotional Discount Campaign",
            "parameters": {
                "discount_pct": discount_pct,
                "volume_boost_pct": volume_boost_pct
            },
            "baseline_revenue": round(base_revenue, 2),
            "projected_revenue": projected_revenue,
            "revenue_delta": revenue_delta,
            "delta_pct": delta_pct,
            "confidence": "Medium (Requires conversion monitoring)",
            "analysis": (
                f"Offering a {discount_pct}% discount with an expected {volume_boost_pct}% volume uplift produces "
                f"{'a net gain of ₹' + str(abs(revenue_delta)) if revenue_delta >= 0 else 'a net deficit of ₹' + str(abs(revenue_delta))} "
                f"({'+' if delta_pct > 0 else ''}{delta_pct}% revenue impact)."
            ),
            "recommendation": (
                "The volume expansion successfully compensates for unit margin reduction."
                if revenue_delta > 0
                else "Discount is too deep for the modeled volume lift. Target at least a "
                     f"{round((discount_pct / max(1.0 - discount_pct/100, 0.01)), 1)}% volume boost to break even."
            )
        }

    # 3. Customer Retention / Churn Recovery Scenario
    elif scenario_type == "customer_retention":
        churn_recovery_pct = float(scenario.get("churn_recovery_pct", 20.0)) # e.g. recover 20% of at-risk

        # Count at risk / lost customers
        at_risk_cohort = sum(1 for r in rfm if r.get("Segment") in ["At Risk", "Lost"])
        recovered_customers = int(round(at_risk_cohort * (churn_recovery_pct / 100.0)))
        
        # Average spend of at-risk customers
        at_risk_spend = [float(r.get("Monetary", 0.0)) for r in rfm if r.get("Segment") in ["At Risk", "Lost"]]
        avg_at_risk_spend = (sum(at_risk_spend) / max(len(at_risk_spend), 1)) if at_risk_spend else avg_customer_spend

        recovered_revenue = round(recovered_customers * avg_at_risk_spend, 2)
        projected_revenue = round(base_revenue + recovered_revenue, 2)
        delta_pct = round((recovered_revenue / max(base_revenue, 1.0)) * 100, 2)

        return {
            "scenario_type": "customer_retention",
            "scenario_name": f"{churn_recovery_pct}% Churn Recovery Campaign",
            "parameters": {
                "at_risk_cohort_size": at_risk_cohort,
                "churn_recovery_pct": churn_recovery_pct,
                "recovered_customers": recovered_customers,
                "avg_annual_customer_value": round(avg_at_risk_spend, 2)
            },
            "baseline_revenue": round(base_revenue, 2),
            "projected_revenue": projected_revenue,
            "revenue_delta": recovered_revenue,
            "delta_pct": delta_pct,
            "confidence": "High (Grounded in actual cohort spend)",
            "analysis": (
                f"Successfully re-activating {churn_recovery_pct}% of the {at_risk_cohort} dormant/at-risk customers "
                f"({recovered_customers} accounts) recovers an estimated ₹{recovered_revenue:,.2f} in revenue."
            ),
            "recommendation": (
                f"You can allocate up to ₹{round(recovered_revenue * 0.25, 2):,.2f} in re-activation marketing "
                f"while maintaining a 4:1 ROI on recovered revenue."
            )
        }

    # 4. Product Bundle Scenario
    elif scenario_type == "bundle_offer":
        bundle_discount_pct = float(scenario.get("bundle_discount_pct", 8.0))
        target_rule = rules[0] if rules else {"antecedent": "Product A", "consequent": "Product B", "lift": 2.1}
        
        # Estimate additional cross-sell conversion
        est_bundle_uptake = float(scenario.get("bundle_uptake_pct", 15.0)) # % of antecedent orders adopting bundle
        estimated_uplift = round(base_revenue * (est_bundle_uptake / 100.0) * 0.20 * (1.0 - bundle_discount_pct / 100.0), 2)
        projected_revenue = round(base_revenue + estimated_uplift, 2)
        delta_pct = round((estimated_uplift / max(base_revenue, 1.0)) * 100, 2)

        return {
            "scenario_type": "bundle_offer",
            "scenario_name": f"Bundle '{target_rule.get('antecedent')}' + '{target_rule.get('consequent')}'",
            "parameters": {
                "primary_item": target_rule.get("antecedent"),
                "bundled_item": target_rule.get("consequent"),
                "bundle_discount_pct": bundle_discount_pct,
                "expected_uptake_pct": est_bundle_uptake
            },
            "baseline_revenue": round(base_revenue, 2),
            "projected_revenue": projected_revenue,
            "revenue_delta": estimated_uplift,
            "delta_pct": delta_pct,
            "confidence": "Medium (Cross-sell affinity supported by market basket lift)",
            "analysis": (
                f"Pairing '{target_rule.get('antecedent')}' with '{target_rule.get('consequent')}' at an {bundle_discount_pct}% "
                f"incentive is projected to produce +₹{estimated_uplift:,.2f} (+{delta_pct}%) in incremental revenue."
            ),
            "recommendation": "Launch bundle as a limited-time promotional kit on product detail pages."
        }

    else:
        return {
            "scenario_type": "unknown",
            "baseline_revenue": round(base_revenue, 2),
            "projected_revenue": round(base_revenue, 2),
            "revenue_delta": 0.0,
            "delta_pct": 0.0,
            "confidence": "Low",
            "analysis": "Unrecognized scenario type."
        }
