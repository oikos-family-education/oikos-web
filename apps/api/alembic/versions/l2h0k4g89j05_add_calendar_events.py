"""Add calendar events table

Revision ID: l2h0k4g89j05
Revises: k1g9j3f78i04
Create Date: 2026-04-20 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = 'l2h0k4g89j05'
down_revision: Union[str, None] = 'k1g9j3f78i04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'calendar_events',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('family_id', UUID(as_uuid=True), sa.ForeignKey('families.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('event_type', sa.String(20), nullable=False, server_default='family'),
        sa.Column('all_day', sa.Boolean, nullable=False, server_default=sa.text('false')),
        sa.Column('start_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('child_ids', sa.ARRAY(UUID(as_uuid=True)), nullable=False, server_default='{}'),
        sa.Column('subject_id', UUID(as_uuid=True), sa.ForeignKey('subjects.id', ondelete='SET NULL'), nullable=True),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='SET NULL'), nullable=True),
        sa.Column('milestone_id', UUID(as_uuid=True), sa.ForeignKey('project_milestones.id', ondelete='SET NULL'), nullable=True),
        sa.Column('color', sa.String(7), nullable=True),
        sa.Column('location', sa.String(255), nullable=True),
        sa.Column('recurrence', sa.String(10), nullable=False, server_default='none'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_calendar_events_family_id', 'calendar_events', ['family_id'])
    op.create_index('ix_calendar_events_family_start', 'calendar_events', ['family_id', 'start_at'])
    op.create_index('ix_calendar_events_subject_id', 'calendar_events', ['subject_id'])
    op.create_index('ix_calendar_events_project_id', 'calendar_events', ['project_id'])


def downgrade() -> None:
    op.drop_index('ix_calendar_events_project_id', table_name='calendar_events')
    op.drop_index('ix_calendar_events_subject_id', table_name='calendar_events')
    op.drop_index('ix_calendar_events_family_start', table_name='calendar_events')
    op.drop_index('ix_calendar_events_family_id', table_name='calendar_events')
    op.drop_table('calendar_events')
