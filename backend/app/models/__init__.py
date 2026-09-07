# app/models/__init__.py
# Import all models here so Alembic autodiscovery works.
from app.models.user import User  # noqa: F401
from .dataset import Dataset, ColumnMapping
from .quality import DataQualityReport
from .mining import MiningResult  # noqa: F401
