from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class ColumnStatSchema(BaseModel):
    column: str
    nexmine_field: Optional[str]
    total: int
    missing: int
    pct_missing: float
    type_issues: int
    unique_count: int
    sample_values: List[str]


class CleaningEntrySchema(BaseModel):
    action: str
    description: str
    rows_affected: int
    severity: str   # "auto" | "attention"


class QualityReportResponse(BaseModel):
    dataset_id: str
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
    quality_score: float
    column_stats: List[ColumnStatSchema]
    cleaning_log: List[CleaningEntrySchema]
    user_attention_items: List[Any]
    computed_at: datetime
    score_formula: str = (
        "Score = 100 × (1-missing_rate)^0.30 × (1-dup_rate)^0.25 × "
        "(1-date_invalid_rate)^0.20 × (1-numeric_invalid_rate)^0.15 × "
        "(1-outlier_rate)^0.10"
    )
