"""Add archived_at column to subjects table

Revision ID: a6q0b2d4h6i8
Revises: z5p9a1c3g5h7
Create Date: 2026-10-22 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a6q0b2d4h6i8'
down_revision: Union[str, None] = 'z5p9a1c3g5h7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('subjects', sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('ix_subjects_archived_at', 'subjects', ['archived_at'])


def downgrade() -> None:
    op.drop_index('ix_subjects_archived_at', table_name='subjects')
    op.drop_column('subjects', 'archived_at')
