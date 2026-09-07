"""
Column Detection Service
========================
Given the raw column headers from an uploaded file, heuristically propose
a mapping to NexMine's 11 canonical fields.

Design principles:
- Conservative: only propose a mapping when confidence is reasonably high.
- Transparent: every proposed mapping has a confidence score (0-1) so the UI
  can colour-code uncertain suggestions.
- Never silently fails: unmapped columns are returned as-is for the user
  to manually assign.
- No data is read beyond headers at this stage.
"""

import re
from typing import Optional

# ─── Keyword dictionaries ─────────────────────────────────────────────────────
# Each list contains lowercase substrings or patterns that strongly suggest
# the corresponding NexMine field. Order: higher specificity first.

_FIELD_PATTERNS: dict[str, list[tuple[str, float]]] = {
    # (pattern, confidence)
    "transaction_id": [
        ("transaction_id", 0.98), ("trans_id", 0.95), ("order_id", 0.92),
        ("invoice_id", 0.90), ("receipt_id", 0.88), ("sale_id", 0.85),
        ("txn_id", 0.90), ("transaction", 0.75), ("order", 0.65),
        ("invoice", 0.65), ("receipt", 0.65),
    ],
    "date": [
        ("date", 0.95), ("order_date", 0.97), ("transaction_date", 0.97),
        ("sale_date", 0.95), ("purchase_date", 0.95), ("invoice_date", 0.92),
        ("timestamp", 0.85), ("time", 0.60), ("dt", 0.60),
    ],
    "customer_id": [
        ("customer_id", 0.98), ("cust_id", 0.96), ("client_id", 0.95),
        ("buyer_id", 0.93), ("member_id", 0.88), ("user_id", 0.80),
        ("customer", 0.70), ("client", 0.68),
    ],
    "product": [
        ("product_name", 0.97), ("item_name", 0.95), ("product", 0.90),
        ("item", 0.82), ("sku_name", 0.85), ("description", 0.65),
        ("goods", 0.60), ("merchandise", 0.60),
    ],
    "category": [
        ("category", 0.97), ("product_category", 0.99), ("item_category", 0.97),
        ("dept", 0.70), ("department", 0.75), ("type", 0.60), ("group", 0.58),
        ("segment", 0.62),
    ],
    "quantity": [
        ("quantity", 0.98), ("qty", 0.97), ("units", 0.90), ("count", 0.75),
        ("amount_sold", 0.70), ("volume", 0.65), ("num_items", 0.85),
        ("number_of_items", 0.90),
    ],
    "unit_price": [
        ("unit_price", 0.99), ("price_per_unit", 0.97), ("item_price", 0.95),
        ("unit_cost", 0.80), ("price", 0.78), ("rate", 0.60),
        ("selling_price", 0.90), ("mrp", 0.70),
    ],
    "total_amount": [
        ("total_amount", 0.99), ("total_revenue", 0.97), ("revenue", 0.85),
        ("total_sales", 0.95), ("sales_amount", 0.93), ("total", 0.80),
        ("amount", 0.72), ("line_total", 0.90), ("net_amount", 0.85),
        ("gross_amount", 0.83), ("subtotal", 0.80), ("value", 0.60),
    ],
    "discount": [
        ("discount", 0.98), ("disc", 0.90), ("promo", 0.70),
        ("coupon", 0.72), ("markdown", 0.75), ("reduction", 0.65),
    ],
    "location": [
        ("location", 0.97), ("store", 0.88), ("branch", 0.88),
        ("region", 0.85), ("city", 0.80), ("state", 0.75),
        ("country", 0.75), ("area", 0.65), ("zone", 0.65),
        ("outlet", 0.80), ("shop", 0.72),
    ],
    "payment_method": [
        ("payment_method", 0.99), ("pay_method", 0.97), ("payment_type", 0.97),
        ("payment", 0.85), ("pay_type", 0.90), ("mode_of_payment", 0.92),
        ("tender", 0.75), ("pay_mode", 0.88),
    ],
}


def _normalise(col: str) -> str:
    """Lowercase, strip, replace common separators with underscore."""
    return re.sub(r"[\s\-\.]+", "_", col.strip().lower())


def _score_column(col_norm: str) -> tuple[Optional[str], float]:
    """
    Returns (best_nexmine_field, confidence) or (None, 0) if no match.
    """
    best_field, best_conf = None, 0.0
    for field, patterns in _FIELD_PATTERNS.items():
        for pattern, conf in patterns:
            if pattern in col_norm or col_norm in pattern:
                if conf > best_conf:
                    best_field, best_conf = field, conf
    return best_field, best_conf


def propose_mapping(raw_columns: list[str]) -> list[dict]:
    """
    Given a list of raw column names (as read from the file headers), returns
    a proposal list:

    [
      {
        "raw_column":   "Order ID",        # original header
        "proposed_field": "transaction_id", # or None
        "confidence":   0.92,              # 0–1; None if no proposal
      },
      ...
    ]

    A NexMine field can only be assigned to ONE column. If two columns score
    the same field, the higher-confidence one wins and the other gets None.
    """
    scored: list[dict] = []
    for col in raw_columns:
        norm = _normalise(col)
        field, conf = _score_column(norm)
        scored.append({
            "raw_column":     col,
            "proposed_field": field,
            "confidence":     round(conf, 3),
        })

    # Resolve conflicts: keep highest-confidence winner per field
    field_winners: dict[str, tuple[int, float]] = {}  # field -> (index, conf)
    for i, item in enumerate(scored):
        f = item["proposed_field"]
        if f is None:
            continue
        if f not in field_winners or item["confidence"] > field_winners[f][1]:
            field_winners[f] = (i, item["confidence"])

    # Blank out losers
    for i, item in enumerate(scored):
        f = item["proposed_field"]
        if f is not None and field_winners.get(f, (i,))[0] != i:
            scored[i]["proposed_field"] = None
            scored[i]["confidence"] = 0.0

    return scored
