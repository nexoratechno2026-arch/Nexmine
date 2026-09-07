from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import uuid
from datetime import datetime


# ─── Upload response ──────────────────────────────────────────────────────────

class ColumnProposal(BaseModel):
    raw_column: str
    proposed_field: Optional[str] = None
    confidence: float = 0.0


class UploadResponse(BaseModel):
    dataset_id: str
    original_filename: str
    row_count: int
    column_count: int
    proposals: List[ColumnProposal]  # One per column in the file
    message: str


# ─── Mapping confirmation ─────────────────────────────────────────────────────

class ConfirmMappingRequest(BaseModel):
    """
    User's confirmed field mapping.
    Keys = NexMine field names (from NEXMINE_FIELDS list).
    Values = raw column name from the uploaded file (or null to skip).
    Any field not included is treated as unmapped.
    """
    mapping: Dict[str, Optional[str]] = Field(
        description="e.g. {\"transaction_id\": \"Order ID\", \"date\": \"Date\", ...}"
    )


class MappingConfirmedResponse(BaseModel):
    dataset_id: str
    mapping: Dict[str, str]           # Only confirmed (non-null) entries
    analyses_available: Dict[str, Any] # AnalysisGate.to_dict()
    message: str


# ─── Dataset info ─────────────────────────────────────────────────────────────

class DatasetInfo(BaseModel):
    id: str
    original_filename: str
    file_type: str
    row_count: Optional[int]
    column_count: Optional[int]
    status: str
    detected_columns: Optional[List[str]]
    mapping: Optional[Dict[str, str]]
    analyses_available: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True
