import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, JSON, Text, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class MiningResult(Base):
    __tablename__ = "mining_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)

    # JSON results of algorithms
    rfm_segments = Column(JSON, nullable=True)          # List of customer RFM stats
    customer_clusters = Column(JSON, nullable=True)     # Clusters + descriptive personas
    association_rules = Column(JSON, nullable=True)     # Apriori / FP-Growth rules
    sales_patterns = Column(JSON, nullable=True)        # Timeseries aggregates
    anomalies = Column(JSON, nullable=True)             # Outlier days
    product_performance = Column(JSON, nullable=True)   # Top and bottom selling products

    # Optional plain text insights generated alongside mining
    insights = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    dataset = relationship("Dataset")

    def __repr__(self):
        return f"<MiningResult dataset_id={self.dataset_id}>"
