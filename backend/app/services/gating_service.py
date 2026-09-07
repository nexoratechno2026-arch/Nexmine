"""
Analysis Gating Service
=======================
The single source of truth for which analyses are possible given a confirmed
ColumnMapping. Every downstream module (mining, AI, what-if) must consult
this service instead of doing ad-hoc checks.

Design contract:
- Takes a ColumnMapping (or a mapping dict) as input.
- Returns an AnalysisGate object listing which analyses are enabled and,
  critically, why any disabled analysis is disabled — in plain English.

Guardrail: disabled analyses must NEVER be silently skipped.
Every caller must surface the reason to the user.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class AnalysisStatus:
    enabled: bool
    reason: Optional[str] = None   # Plain-English reason if disabled; None if enabled


@dataclass
class AnalysisGate:
    """
    Computed once per dataset from the confirmed ColumnMapping.
    Tells callers which analyses can run and why others can't.
    """
    rfm:              AnalysisStatus = field(default_factory=lambda: AnalysisStatus(False))
    clustering:       AnalysisStatus = field(default_factory=lambda: AnalysisStatus(False))
    association_rules:AnalysisStatus = field(default_factory=lambda: AnalysisStatus(False))
    sales_patterns:   AnalysisStatus = field(default_factory=lambda: AnalysisStatus(False))
    anomaly_detection:AnalysisStatus = field(default_factory=lambda: AnalysisStatus(False))
    what_if:          AnalysisStatus = field(default_factory=lambda: AnalysisStatus(False))

    def to_dict(self) -> dict:
        return {
            name: {"enabled": status.enabled, "reason": status.reason}
            for name, status in {
                "rfm":               self.rfm,
                "clustering":        self.clustering,
                "association_rules": self.association_rules,
                "sales_patterns":    self.sales_patterns,
                "anomaly_detection": self.anomaly_detection,
                "what_if":           self.what_if,
            }.items()
        }

    def any_enabled(self) -> bool:
        return any([
            self.rfm.enabled, self.clustering.enabled,
            self.association_rules.enabled, self.sales_patterns.enabled,
            self.anomaly_detection.enabled,
        ])


def compute_gate(mapping: dict) -> AnalysisGate:
    """
    mapping: dict of {nexmine_field: raw_column_name} for confirmed fields.
    Returns a fully-populated AnalysisGate.

    Requirements per analysis:
    ┌────────────────────┬──────────────────────────────────────────────────────┐
    │ Analysis           │ Required fields                                      │
    ├────────────────────┼──────────────────────────────────────────────────────┤
    │ RFM                │ customer_id + date + (total_amount OR (quantity AND  │
    │                    │ unit_price))                                          │
    │ Clustering         │ customer_id + date + (total_amount OR unit_price)    │
    │ Association Rules  │ transaction_id + product                             │
    │ Sales Patterns     │ date + (total_amount OR (quantity AND unit_price))   │
    │ Anomaly Detection  │ date + (total_amount OR quantity)                    │
    │ What-If            │ date + product + (total_amount OR unit_price OR qty) │
    └────────────────────┴──────────────────────────────────────────────────────┘
    """

    has = lambda f: f in mapping  # noqa: E731

    # Derived convenience flags
    has_revenue  = has("total_amount") or (has("quantity") and has("unit_price"))
    has_value    = has("total_amount") or has("unit_price")

    gate = AnalysisGate()

    # ── RFM ──────────────────────────────────────────────────────────────────
    if not has("customer_id"):
        gate.rfm = AnalysisStatus(False,
            "RFM Analysis requires a Customer ID column to identify individual customers. "
            "Your dataset does not have one mapped.")
    elif not has("date"):
        gate.rfm = AnalysisStatus(False,
            "RFM Analysis requires a Date column to compute Recency. "
            "Your dataset does not have one mapped.")
    elif not has_revenue:
        gate.rfm = AnalysisStatus(False,
            "RFM Analysis requires either a Total Amount column or both Quantity and "
            "Unit Price columns to compute Monetary value. None are mapped.")
    else:
        gate.rfm = AnalysisStatus(True)

    # ── Clustering ───────────────────────────────────────────────────────────
    if not has("customer_id"):
        gate.clustering = AnalysisStatus(False,
            "Customer Clustering requires a Customer ID column to group individual "
            "customers. Your dataset does not have one mapped.")
    elif not has("date"):
        gate.clustering = AnalysisStatus(False,
            "Customer Clustering requires a Date column to compute recency and "
            "purchase frequency. Your dataset does not have one mapped.")
    elif not has_value:
        gate.clustering = AnalysisStatus(False,
            "Customer Clustering requires either a Total Amount or Unit Price column "
            "to measure spending behaviour. Neither is mapped.")
    else:
        gate.clustering = AnalysisStatus(True)

    # ── Association Rules ─────────────────────────────────────────────────────
    if not has("transaction_id"):
        gate.association_rules = AnalysisStatus(False,
            "Association Rule Mining requires a Transaction ID column to group "
            "items purchased together. Your dataset does not have one mapped.")
    elif not has("product"):
        gate.association_rules = AnalysisStatus(False,
            "Association Rule Mining requires a Product column to identify which "
            "items appear in each transaction. Your dataset does not have one mapped.")
    else:
        gate.association_rules = AnalysisStatus(True)

    # ── Sales Patterns ────────────────────────────────────────────────────────
    if not has("date"):
        gate.sales_patterns = AnalysisStatus(False,
            "Sales Pattern Mining requires a Date column to analyse trends over time. "
            "Your dataset does not have one mapped.")
    elif not has_revenue:
        gate.sales_patterns = AnalysisStatus(False,
            "Sales Pattern Mining requires either a Total Amount column or both "
            "Quantity and Unit Price columns to compute revenue over time. "
            "None are mapped.")
    else:
        gate.sales_patterns = AnalysisStatus(True)

    # ── Anomaly Detection ─────────────────────────────────────────────────────
    if not has("date"):
        gate.anomaly_detection = AnalysisStatus(False,
            "Anomaly Detection requires a Date column to identify unusual patterns "
            "over time. Your dataset does not have one mapped.")
    elif not (has("total_amount") or has("quantity")):
        gate.anomaly_detection = AnalysisStatus(False,
            "Anomaly Detection requires either a Total Amount or Quantity column "
            "to measure deviations. Neither is mapped.")
    else:
        gate.anomaly_detection = AnalysisStatus(True)

    # ── What-If Analysis ──────────────────────────────────────────────────────
    if not has("date"):
        gate.what_if = AnalysisStatus(False,
            "What-If Analysis requires a Date column to build historical baselines. "
            "Your dataset does not have one mapped.")
    elif not has("product"):
        gate.what_if = AnalysisStatus(False,
            "What-If Analysis requires a Product column to estimate product-level impact. "
            "Your dataset does not have one mapped.")
    elif not (has("total_amount") or has("unit_price") or has("quantity")):
        gate.what_if = AnalysisStatus(False,
            "What-If Analysis requires Total Amount, Unit Price, or Quantity to model "
            "revenue or demand impact. None are mapped.")
    else:
        gate.what_if = AnalysisStatus(True)

    return gate
