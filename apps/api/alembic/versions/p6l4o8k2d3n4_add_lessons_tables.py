"""Add lessons and lesson_blocks tables

Revision ID: p6l4o8k2d3n4
Revises: o5k3n7j1c2m3
Create Date: 2026-05-08 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB


revision: str = 'p6l4o8k2d3n4'
down_revision: Union[str, None] = 'o5k3n7j1c2m3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── lessons ──
    op.create_table(
        'lessons',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('family_id', UUID(as_uuid=True), sa.ForeignKey('families.id', ondelete='CASCADE'), nullable=False),
        sa.Column('subject_id', UUID(as_uuid=True), sa.ForeignKey('subjects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_by_user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),

        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('scheduled_for', sa.Date, nullable=False),
        sa.Column('estimated_duration_minutes', sa.SmallInteger, nullable=True),

        sa.Column('status', sa.String(20), nullable=False, server_default=sa.text("'draft'")),
        sa.Column('objectives', ARRAY(sa.String), nullable=False, server_default=sa.text("ARRAY[]::varchar[]")),
        sa.Column('tags', ARRAY(sa.String), nullable=False, server_default=sa.text("ARRAY[]::varchar[]")),

        sa.Column('actual_duration_minutes', sa.SmallInteger, nullable=True),
        sa.Column('completion_notes', sa.Text, nullable=True),
        sa.Column('taught_on', sa.Date, nullable=True),

        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),

        sa.CheckConstraint(
            "status IN ('draft','scheduled','in_progress','completed','cancelled')",
            name='ck_lessons_status_valid',
        ),
        sa.CheckConstraint(
            "estimated_duration_minutes IS NULL OR (estimated_duration_minutes > 0 AND estimated_duration_minutes <= 720)",
            name='ck_lessons_estimated_duration_range',
        ),
        sa.CheckConstraint(
            "actual_duration_minutes IS NULL OR (actual_duration_minutes > 0 AND actual_duration_minutes <= 720)",
            name='ck_lessons_actual_duration_range',
        ),
    )

    op.create_index('ix_lessons_family_id', 'lessons', ['family_id'])
    op.create_index('ix_lessons_subject_id', 'lessons', ['subject_id'])
    op.create_index('ix_lessons_family_scheduled', 'lessons', ['family_id', 'scheduled_for'])
    op.create_index('ix_lessons_status', 'lessons', ['status'])

    # ── lesson_blocks ──
    op.create_table(
        'lesson_blocks',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('lesson_id', UUID(as_uuid=True), sa.ForeignKey('lessons.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sort_order', sa.SmallInteger, nullable=False, server_default=sa.text('0')),
        sa.Column('type', sa.String(30), nullable=False),
        sa.Column('content', JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),

        sa.CheckConstraint(
            "type IN ('text','heading','link','resource_ref','checklist','image_url','video_embed','divider','callout')",
            name='ck_lesson_blocks_type_valid',
        ),
    )

    op.create_index('ix_lesson_blocks_lesson_id', 'lesson_blocks', ['lesson_id'])
    op.create_index('ix_lesson_blocks_lesson_order', 'lesson_blocks', ['lesson_id', 'sort_order'])

    # ── teaching_logs.lesson_id ──
    op.add_column(
        'teaching_logs',
        sa.Column('lesson_id', UUID(as_uuid=True), sa.ForeignKey('lessons.id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index('ix_teaching_logs_lesson_id', 'teaching_logs', ['lesson_id'])


def downgrade() -> None:
    op.drop_index('ix_teaching_logs_lesson_id', table_name='teaching_logs')
    op.drop_column('teaching_logs', 'lesson_id')

    op.drop_index('ix_lesson_blocks_lesson_order', table_name='lesson_blocks')
    op.drop_index('ix_lesson_blocks_lesson_id', table_name='lesson_blocks')
    op.drop_table('lesson_blocks')

    op.drop_index('ix_lessons_status', table_name='lessons')
    op.drop_index('ix_lessons_family_scheduled', table_name='lessons')
    op.drop_index('ix_lessons_subject_id', table_name='lessons')
    op.drop_index('ix_lessons_family_id', table_name='lessons')
    op.drop_table('lessons')
