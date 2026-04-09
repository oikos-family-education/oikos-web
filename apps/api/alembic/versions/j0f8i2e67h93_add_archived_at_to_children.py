"""Add archived_at column to children table

Revision ID: j0f8i2e67h93
Revises: i9e7h1d56g82
Create Date: 2026-04-09 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'j0f8i2e67h93'
down_revision: Union[str, None] = 'i9e7h1d56g82'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('children', sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('children', 'archived_at')
