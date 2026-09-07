"""
Data Quality Engine
===================
Takes a cleaned DataFrame + confirmed ColumnMapping dict and produces a
structured DataQualityResult.

DATA QUALITY SCORE FORMULA (0–100, fully documented)
─────────────────────────────────────────────────────
Score = 100 × Π(penalty_i)   [multiplicative penalties, each between 0 and 1]

The multiplicative model means that severe issues compound correctly:
a dataset that's 10% missing AND has 20% duplicates scores much lower
than one with only one of those problems.

Penalties (each deducts proportionally from remaining score):
┌───────────────────────────────┬────────────┬────────────────────────────┐
│ Check                         │ Weight     │ Computation                │
├───────────────────────────────┼────────────┼────────────────────────────┤
│ Missing value rate            │ 30%        │ (1 - missing_rate)^0.3     │
│ Duplicate row rate            │ 25%        │ (1 - dup_rate)^0.25        │
│ Invalid date rate             │ 20%        │ (1 - date_inv_rate)^0.20   │
│ Invalid numeric rate          │ 15%        │ (1 - num_inv_rate)^0.15    │
│ Outlier rate                  │ 10%        │ (1 - outlier_rate)^0.10    │
└───────────────────────────────┴────────────┴────────────────────────────┘

All rates are clamped to [0, 1].
Final score is rounded to 1 decimal place.

The exponents control how aggressively each dimension penalises:
e.g. a 10% missing rate → (0.9)^0.3 ≈ 0.968 → ~3% penalty,
whereas 80% missing → (0.2)^0.3 ≈ 0.617 → ~38% penalty.

Auto-fix actions (applied to a COPY of the DataFrame before analysis):
- Strip leading/trailing whitespace from string columns
- Standardise date column to datetime64 (parse common formats)
- Drop fully duplicate rows
- Coerce numeric columns; tag non-parseable rows as invalid (not dropped)

Actions that need user attention:
- Missing values exceeding 5% of rows in any mapped column
- Invalid dates that couldn't be parsed
- Negative quantities or prices
- Extreme outliers (IQR method, k=3) in revenue/quantity columns
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional
import numpy as np
import pandas as pd


# ─── Result dataclasses ───────────────────────────────────────────────────────

@dataclass
class ColumnStat:
    column: str
    nexmine_field: Optional[str]
    total: int
    missing: int
    pct_missing: float
    type_issues: int        # unparseable dates/numerics
    unique_count: int
    sample_values: list     # up to 3 non-null samples


@dataclass
class CleaningEntry:
    action: str            # short machine-readable key
    description: str       # plain English
    rows_affected: int
    severity: str          # "auto" | "attention"


@dataclass
class QualityResult:
    # Summary
    total_rows: int
    valid_rows: int
    duplicate_rows: int
    missing_values_count: int
    invalid_date_count: int
    invalid_quantity_count: int
    invalid_price_count: int
    outlier_count: int
    missing_customer_id_count: int
    missing_product_count: int

    # Score
    quality_score: float   # 0–100

    # Detailed breakdown
    column_stats: list[ColumnStat]
    cleaning_log: list[CleaningEntry]
    user_attention_items: list[dict]

    # Cleaned DataFrame (for downstream phases)
    cleaned_df: pd.DataFrame


# ─── Engine ───────────────────────────────────────────────────────────────────

def run_quality_engine(df: pd.DataFrame, mapping: dict) -> QualityResult:
    """
    mapping: {nexmine_field: raw_column_name}  (from ColumnMapping.as_dict())
    df:      the raw DataFrame as read from the uploaded file.

    Returns QualityResult with a cleaned copy of the DataFrame.
    All modifications are on a copy; the original df is never mutated.
    """
    df = df.copy()
    total_rows = len(df)
    cleaning_log: list[CleaningEntry] = []
    user_attention: list[dict] = []

    # Reverse mapping: raw_column → nexmine_field
    col_to_field = {v: k for k, v in mapping.items()}

    # ── 1. Strip whitespace from string columns ───────────────────────────────
    str_cols = df.select_dtypes(include="object").columns.tolist()
    stripped_cells = 0
    for col in str_cols:
        before = df[col].copy()
        df[col] = df[col].str.strip()
        stripped_cells += (before != df[col]).sum()
    if stripped_cells > 0:
        cleaning_log.append(CleaningEntry(
            action="strip_whitespace",
            description=f"Stripped leading/trailing whitespace from {stripped_cells:,} cells across {len(str_cols)} text columns.",
            rows_affected=stripped_cells,
            severity="auto",
        ))

    # ── 2. Drop fully duplicate rows ──────────────────────────────────────────
    dup_mask = df.duplicated()
    duplicate_rows = int(dup_mask.sum())
    if duplicate_rows > 0:
        df = df[~dup_mask].reset_index(drop=True)
        cleaning_log.append(CleaningEntry(
            action="drop_duplicates",
            description=f"Removed {duplicate_rows:,} fully duplicate rows (identical across all columns).",
            rows_affected=duplicate_rows,
            severity="auto",
        ))

    # ── 3. Date column handling ───────────────────────────────────────────────
    invalid_date_count = 0
    date_col = mapping.get("date")
    if date_col and date_col in df.columns:
        original = df[date_col].copy()
        df[date_col] = pd.to_datetime(df[date_col], errors="coerce", infer_datetime_format=True)
        invalid_date_count = int(df[date_col].isna().sum() - original.isna().sum())
        invalid_date_count = max(0, invalid_date_count)

        parsed_ok = int((~df[date_col].isna()).sum())
        if parsed_ok > 0:
            cleaning_log.append(CleaningEntry(
                action="parse_dates",
                description=f"Standardised '{date_col}' to ISO datetime. {parsed_ok:,} dates parsed successfully.",
                rows_affected=parsed_ok,
                severity="auto",
            ))
        if invalid_date_count > 0:
            user_attention.append({
                "issue": "Unparseable dates",
                "column": date_col,
                "count": invalid_date_count,
                "recommendation": (
                    f"{invalid_date_count:,} rows in '{date_col}' could not be parsed as dates. "
                    "Ensure dates are in a consistent format (e.g. YYYY-MM-DD or DD/MM/YYYY)."
                ),
            })
            cleaning_log.append(CleaningEntry(
                action="invalid_dates_flagged",
                description=f"{invalid_date_count:,} values in '{date_col}' could not be parsed as dates and were left as NaT.",
                rows_affected=invalid_date_count,
                severity="attention",
            ))

    # ── 4. Numeric columns: quantity, unit_price, total_amount, discount ──────
    numeric_fields = ["quantity", "unit_price", "total_amount", "discount"]
    invalid_quantity_count = 0
    invalid_price_count = 0

    for field_name in numeric_fields:
        raw_col = mapping.get(field_name)
        if not raw_col or raw_col not in df.columns:
            continue
        original = df[raw_col].copy()
        df[raw_col] = pd.to_numeric(df[raw_col], errors="coerce")
        newly_invalid = int(df[raw_col].isna().sum() - original.isna().sum())
        newly_invalid = max(0, newly_invalid)

        if field_name == "quantity":
            invalid_quantity_count = newly_invalid
        elif field_name in ("unit_price", "total_amount"):
            invalid_price_count += newly_invalid

        if newly_invalid > 0:
            user_attention.append({
                "issue": f"Non-numeric values in '{raw_col}'",
                "column": raw_col,
                "count": newly_invalid,
                "recommendation": (
                    f"{newly_invalid:,} rows in '{raw_col}' contain non-numeric values and will be excluded from quantitative analyses."
                ),
            })

        # Flag negative quantities and prices (keep them but warn)
        if field_name in ("quantity", "unit_price", "total_amount"):
            neg_mask = df[raw_col] < 0
            neg_count = int(neg_mask.sum())
            if neg_count > 0:
                user_attention.append({
                    "issue": f"Negative values in '{raw_col}'",
                    "column": raw_col,
                    "count": neg_count,
                    "recommendation": (
                        f"{neg_count:,} rows have negative {field_name.replace('_', ' ')}. "
                        "These may indicate returns/refunds. Review whether they should be included in revenue calculations."
                    ),
                })

    # ── 5. Missing value analysis ─────────────────────────────────────────────
    mapped_cols = list(mapping.values())
    missing_by_col = df[mapped_cols].isna().sum() if mapped_cols else pd.Series(dtype=int)
    missing_values_count = int(missing_by_col.sum())

    for col, miss_count in missing_by_col.items():
        pct = miss_count / len(df) if len(df) > 0 else 0
        if pct > 0.05:
            field_label = col_to_field.get(col, col)
            user_attention.append({
                "issue": f"High missing rate in '{col}' ({field_label})",
                "column": col,
                "count": int(miss_count),
                "recommendation": (
                    f"{pct:.1%} of rows have no value for '{col}'. "
                    "Consider filling, removing, or sourcing this data. "
                    "Analyses dependent on this column may be unreliable."
                ),
            })

    # ── 6. Missing customer_id / product ──────────────────────────────────────
    missing_customer_id_count = 0
    missing_product_count = 0

    cust_col = mapping.get("customer_id")
    if cust_col and cust_col in df.columns:
        missing_customer_id_count = int(df[cust_col].isna().sum())

    prod_col = mapping.get("product")
    if prod_col and prod_col in df.columns:
        missing_product_count = int(df[prod_col].isna().sum())

    # ── 7. Outlier detection (IQR, k=3) on revenue/quantity ──────────────────
    outlier_count = 0
    outlier_cols = []
    for field_name in ("total_amount", "quantity", "unit_price"):
        raw_col = mapping.get(field_name)
        if not raw_col or raw_col not in df.columns:
            continue
        series = df[raw_col].dropna()
        if len(series) < 10:
            continue
        q1, q3 = series.quantile(0.25), series.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            continue
        outliers = ((series < (q1 - 3 * iqr)) | (series > (q3 + 3 * iqr))).sum()
        if outliers > 0:
            outlier_count += int(outliers)
            outlier_cols.append(f"'{raw_col}' ({outliers:,})")

    if outlier_count > 0:
        cleaning_log.append(CleaningEntry(
            action="outliers_detected",
            description=(
                f"Detected {outlier_count:,} statistical outliers (IQR method, k=3) in: "
                + ", ".join(outlier_cols) + ". These rows are kept but flagged."
            ),
            rows_affected=outlier_count,
            severity="attention",
        ))
        user_attention.append({
            "issue": "Statistical outliers detected",
            "count": outlier_count,
            "recommendation": (
                f"{outlier_count:,} extreme values detected across numeric columns (IQR×3 threshold). "
                "Anomaly Detection (Phase 4) will analyse these in detail."
            ),
        })

    # ── 8. Column statistics ──────────────────────────────────────────────────
    column_stats: list[ColumnStat] = []
    for col in df.columns:
        nexmine_field = col_to_field.get(col)
        series = df[col]
        non_null = series.dropna()
        samples = non_null.head(3).astype(str).tolist()

        type_issues = 0
        if nexmine_field == "date":
            type_issues = invalid_date_count
        elif nexmine_field in ("quantity", "unit_price", "total_amount", "discount"):
            type_issues = int(series.isna().sum())  # approximation after coerce

        column_stats.append(ColumnStat(
            column=col,
            nexmine_field=nexmine_field,
            total=len(series),
            missing=int(series.isna().sum()),
            pct_missing=round(series.isna().mean(), 4),
            type_issues=type_issues,
            unique_count=int(non_null.nunique()),
            sample_values=samples,
        ))

    # ── 9. Compute quality score ──────────────────────────────────────────────
    rows_after_dedup = len(df)
    missing_rate   = min(missing_values_count / max(rows_after_dedup * len(mapped_cols), 1), 1.0) if mapped_cols else 0
    dup_rate       = min(duplicate_rows / max(total_rows, 1), 1.0)
    date_inv_rate  = min(invalid_date_count / max(rows_after_dedup, 1), 1.0)
    num_total      = max(invalid_quantity_count + invalid_price_count, 0)
    num_inv_rate   = min(num_total / max(rows_after_dedup, 1), 1.0)
    outlier_rate   = min(outlier_count / max(rows_after_dedup, 1), 1.0)

    quality_score = 100.0 * (
        (1 - missing_rate)    ** 0.30 *
        (1 - dup_rate)        ** 0.25 *
        (1 - date_inv_rate)   ** 0.20 *
        (1 - num_inv_rate)    ** 0.15 *
        (1 - outlier_rate)    ** 0.10
    )
    quality_score = round(max(0.0, min(100.0, quality_score)), 1)

    valid_rows = rows_after_dedup - max(0, invalid_date_count + num_total)

    return QualityResult(
        total_rows=total_rows,
        valid_rows=max(0, valid_rows),
        duplicate_rows=duplicate_rows,
        missing_values_count=missing_values_count,
        invalid_date_count=invalid_date_count,
        invalid_quantity_count=invalid_quantity_count,
        invalid_price_count=invalid_price_count,
        outlier_count=outlier_count,
        missing_customer_id_count=missing_customer_id_count,
        missing_product_count=missing_product_count,
        quality_score=quality_score,
        column_stats=column_stats,
        cleaning_log=cleaning_log,
        user_attention_items=user_attention,
        cleaned_df=df,
    )
