"""Add week planner tables

Revision ID: g7c5f9b34e60
Revises: f6b4e8a23d59
Create Date: 2026-03-25 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ARRAY


revision: str = 'g7c5f9b34e60'
down_revision: Union[str, None] = 'f6b4e8a23d59'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'week_templates',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('family_id', UUID(as_uuid=True), sa.ForeignKey('families.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        'routine_entries',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('template_id', UUID(as_uuid=True), sa.ForeignKey('week_templates.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('family_id', UUID(as_uuid=True), sa.ForeignKey('families.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('subject_id', UUID(as_uuid=True), sa.ForeignKey('subjects.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('is_free_time', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('child_ids', ARRAY(UUID(as_uuid=True)), nullable=False, server_default='{}'),
        sa.Column('day_of_week', sa.SmallInteger, nullable=False),
        sa.Column('start_minute', sa.Integer, nullable=False),
        sa.Column('duration_minutes', sa.SmallInteger, nullable=False, server_default='45'),
        sa.Column('priority', sa.String(10), nullable=False, server_default='medium'),
        sa.Column('color', sa.String(7), nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('routine_entries')
    op.drop_table('week_templates')
