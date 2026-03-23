"""Drop lifestyle_tags from families

Revision ID: d4b2c9f01e37
Revises: c3a1f8e92b01
Create Date: 2026-03-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'd4b2c9f01e37'
down_revision: Union[str, None] = 'c3a1f8e92b01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE families DROP COLUMN IF EXISTS lifestyle_tags")


def downgrade() -> None:
    op.add_column('families', sa.Column(
        'lifestyle_tags',
        postgresql.ARRAY(sa.String()),
        nullable=False,
        server_default='{}',
    ))
