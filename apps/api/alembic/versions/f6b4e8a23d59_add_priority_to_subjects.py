"""Add priority to subjects

Revision ID: f6b4e8a23d59
Revises: e5a3d7f12c48
Create Date: 2026-03-25 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f6b4e8a23d59'
down_revision: Union[str, None] = 'e5a3d7f12c48'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('subjects', sa.Column('priority', sa.SmallInteger, nullable=False, server_default='2'))


def downgrade() -> None:
    op.drop_column('subjects', 'priority')
