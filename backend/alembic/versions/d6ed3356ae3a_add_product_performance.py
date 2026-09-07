"""Add product performance

Revision ID: d6ed3356ae3a
Revises: 3e2d31dee58c
Create Date: 2026-09-03 15:34:26.423108

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd6ed3356ae3a'
down_revision: Union[str, None] = '3e2d31dee58c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('mining_results', sa.Column('product_performance', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('mining_results', 'product_performance')
