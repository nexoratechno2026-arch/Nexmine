import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, ForeignKey, JSON, Enum
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, ForeignKey, JSON, Enum, UUID
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class DatasetStatus(str, enum.Enum):
    uploaded   = "uploaded"    # file received, not yet mapped
    mapped     = "mapped"      # column mapping confirmed
    cleaned    = "cleaned"     # data quality pass complete
    ready      = "ready"       # all enabled analyses can run


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # File info
    original_filename = Column(String(512), nullable=False)
    file_type = Column(String(10), nullable=False)   # csv | xlsx | xls
    row_count = Column(Integer, nullable=True)
    column_count = Column(Integer, nullable=True)

    # State
    status = Column(Enum(DatasetStatus), default=DatasetStatus.uploaded, nullable=False)

    # Detected columns (raw header list from file, stored as JSON array)
    detected_columns = Column(JSON, nullable=True)   # ["OrderID", "Date", "Cust", ...]

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    column_mapping = relationship("ColumnMapping", back_populates="dataset", uselist=False, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Dataset id={self.id} file={self.original_filename} status={self.status}>"


# ─── Nex Mine canonical field names ──────────────────────────────────────────
# These are the 11 possible fields. Any subset may be mapped.
NEXMINE_FIELDS = [
    "transaction_id",
    "date",
    "customer_id",
    "product",
    "category",
    "quantity",
    "unit_price",
    "total_amount",
    "discount",
    "location",
    "payment_method",
]


class ColumnMapping(Base):
    """
    Stores the confirmed mapping from user's raw column names → NexMine fields.
    Each field that is present maps to a column name in the uploaded file.
    Absent fields are NULL (analysis that depends on them will be disabled).
    """
    __tablename__ = "column_mappings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # One column per Nex Mine field — NULL if the field isn't present in this dataset
    transaction_id   = Column(String(255), nullable=True)
    date             = Column(String(255), nullable=True)
    customer_id      = Column(String(255), nullable=True)
    product          = Column(String(255), nullable=True)
    category         = Column(String(255), nullable=True)
    quantity         = Column(String(255), nullable=True)
    unit_price       = Column(String(255), nullable=True)
    total_amount     = Column(String(255), nullable=True)
    discount         = Column(String(255), nullable=True)
    location         = Column(String(255), nullable=True)
    payment_method   = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    dataset = relationship("Dataset", back_populates="column_mapping")

    def as_dict(self) -> dict:
        """Returns {nexmine_field: raw_column_name} for non-null mappings."""
        return {
            field: getattr(self, field)
            for field in NEXMINE_FIELDS
            if getattr(self, field) is not None
        }

    def __repr__(self):
        return f"<ColumnMapping dataset={self.dataset_id}>"
