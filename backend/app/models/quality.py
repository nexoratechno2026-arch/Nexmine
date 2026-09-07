"""
DataQualityReport model
=======================
Stores the computed data quality results for a dataset.
One report per dataset (upsert on re-run).
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, JSON, Text
from sqlalchemy import Column, String, Integer, DateTime, Float, ForeignKey, JSON, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class DataQualityReport(Base):
    __tablename__ = "data_quality_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(
        UUID(as_uuid=True),
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )

    # ── Summary counts ────────────────────────────────────────────────────────
    total_rows            = Column(Integer, nullable=False)
    valid_rows            = Column(Integer, nullable=False)
    duplicate_rows        = Column(Integer, nullable=False, default=0)
    missing_values_count  = Column(Integer, nullable=False, default=0)  # total cells
    invalid_date_count    = Column(Integer, nullable=False, default=0)
    invalid_quantity_count = Column(Integer, nullable=False, default=0)
    invalid_price_count   = Column(Integer, nullable=False, default=0)
    outlier_count         = Column(Integer, nullable=False, default=0)
    missing_customer_id   = Column(Integer, nullable=False, default=0)  # rows where mapped col is null
    missing_product       = Column(Integer, nullable=False, default=0)

    # ── Scores ────────────────────────────────────────────────────────────────
    # Quality Score 0-100. Formula documented in quality_engine.py.
    quality_score         = Column(Float, nullable=False)

    # ── Per-column breakdown ──────────────────────────────────────────────────
    # JSON: {column_name: {missing: N, pct_missing: 0.05, type_issues: N}}
    column_stats          = Column(JSON, nullable=True)

    # ── Cleaning log ──────────────────────────────────────────────────────────
    # JSON list of {action, description, rows_affected, severity: auto|attention}
    cleaning_log          = Column(JSON, nullable=True)

    # ── Issues requiring user attention ──────────────────────────────────────
    # JSON list of {issue, count, recommendation}
    user_attention_items  = Column(JSON, nullable=True)

    # ── Timestamps ────────────────────────────────────────────────────────────
    computed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<DataQualityReport dataset={self.dataset_id} score={self.quality_score:.1f}>"
