"""Add child_highlights table for the child report

Parents record social activities, books read, documentaries watched,
outdoor activities and other notable moments per child; the child report
includes those that fall within its date range. The date is optional for
things that happened many times (undated ones count from when they were
recorded).

Revision ID: c8s2d4f6j8k0
Revises: b7r1c3e5i7j9
Create Date: 2026-10-22 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'c8s2d4f6j8k0'
down_revision: Union[str, None] = 'b7r1c3e5i7j9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'child_highlights',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('family_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('families.id', ondelete='CASCADE'), nullable=False),
        sa.Column('child_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('children.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category', sa.String(20), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('occurred_on', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "category IN ('social','book','documentary','outdoor','other')",
            name='ck_child_highlights_category',
        ),
    )
    op.create_index('ix_child_highlights_family_id', 'child_highlights', ['family_id'])
    op.create_index('ix_child_highlights_child_id', 'child_highlights', ['child_id'])
    op.create_index('ix_child_highlights_occurred_on', 'child_highlights', ['occurred_on'])


def downgrade() -> None:
    op.drop_index('ix_child_highlights_occurred_on', table_name='child_highlights')
    op.drop_index('ix_child_highlights_child_id', table_name='child_highlights')
    op.drop_index('ix_child_highlights_family_id', table_name='child_highlights')
    op.drop_table('child_highlights')
