"""Add subject and curriculum tables

Revision ID: e5a3d7f12c48
Revises: d4b2c9f01e37
Create Date: 2026-03-24 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'e5a3d7f12c48'
down_revision: Union[str, None] = 'd4b2c9f01e37'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- subjects table ---
    op.create_table(
        'subjects',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('family_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('families.id', ondelete='CASCADE'), nullable=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('slug', sa.String(250), nullable=False),
        sa.Column('short_description', sa.String(500), nullable=True),
        sa.Column('long_description', sa.Text, nullable=True),
        sa.Column('category', sa.String(30), nullable=False),
        sa.Column('color', sa.String(7), nullable=False, server_default='#6366F1'),
        sa.Column('icon', sa.String(50), nullable=True),
        sa.Column('min_age_years', sa.SmallInteger, nullable=True),
        sa.Column('max_age_years', sa.SmallInteger, nullable=True),
        sa.Column('min_grade_level', sa.SmallInteger, nullable=True),
        sa.Column('max_grade_level', sa.SmallInteger, nullable=True),
        sa.Column('default_session_duration_minutes', sa.SmallInteger, server_default='45'),
        sa.Column('default_weekly_frequency', sa.SmallInteger, server_default='5'),
        sa.Column('learning_objectives', postgresql.ARRAY(sa.String), nullable=False, server_default='{}'),
        sa.Column('skills_targeted', postgresql.ARRAY(sa.String), nullable=False, server_default='{}'),
        sa.Column('prerequisite_subject_ids', postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=False, server_default='{}'),
        sa.Column('is_platform_subject', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('is_public', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('family_id', 'slug', name='uq_subjects_family_slug'),
        sa.CheckConstraint("char_length(trim(name)) > 0", name='ck_subjects_name_not_empty'),
    )
    op.create_index('ix_subjects_family_id', 'subjects', ['family_id'])
    op.create_index('ix_subjects_category', 'subjects', ['category'])
    op.create_index('ix_subjects_is_platform_subject', 'subjects', ['is_platform_subject'])

    # --- curriculums table ---
    op.create_table(
        'curriculums',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('family_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('families.id', ondelete='CASCADE'), nullable=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('period_type', sa.String(20), nullable=False),
        sa.Column('start_date', sa.Date, nullable=False),
        sa.Column('end_date', sa.Date, nullable=False),
        sa.Column('academic_year', sa.String(20), nullable=True),
        sa.Column('term_name', sa.String(100), nullable=True),
        sa.Column('education_philosophy', sa.String(200), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('overall_goals', postgresql.ARRAY(sa.String), nullable=False, server_default='{}'),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('end_date > start_date', name='ck_curriculums_valid_date_range'),
        sa.CheckConstraint("char_length(trim(name)) > 0", name='ck_curriculums_name_not_empty'),
    )
    op.create_index('ix_curriculums_family_id', 'curriculums', ['family_id'])
    op.create_index('ix_curriculums_status', 'curriculums', ['status'])

    # --- child_curriculums junction table ---
    op.create_table(
        'child_curriculums',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('child_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('children.id', ondelete='CASCADE'), nullable=False),
        sa.Column('curriculum_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('curriculums.id', ondelete='CASCADE'), nullable=False),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('child_id', 'curriculum_id', name='uq_child_curriculum'),
    )
    op.create_index('ix_child_curriculums_child_id', 'child_curriculums', ['child_id'])
    op.create_index('ix_child_curriculums_curriculum_id', 'child_curriculums', ['curriculum_id'])

    # --- curriculum_subjects table ---
    op.create_table(
        'curriculum_subjects',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('curriculum_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('curriculums.id', ondelete='CASCADE'), nullable=False),
        sa.Column('subject_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('subjects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('weekly_frequency', sa.SmallInteger, nullable=False, server_default='5'),
        sa.Column('session_duration_minutes', sa.SmallInteger, nullable=False, server_default='45'),
        sa.Column('scheduled_days', postgresql.ARRAY(sa.SmallInteger), nullable=False, server_default='{}'),
        sa.Column('preferred_time_slot', sa.String(20), server_default='flexible'),
        sa.Column('goals_for_period', postgresql.ARRAY(sa.String), nullable=False, server_default='{}'),
        sa.Column('sort_order', sa.SmallInteger, server_default='0'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('curriculum_id', 'subject_id', name='uq_curriculum_subject'),
    )
    op.create_index('ix_curriculum_subjects_curriculum_id', 'curriculum_subjects', ['curriculum_id'])
    op.create_index('ix_curriculum_subjects_subject_id', 'curriculum_subjects', ['subject_id'])


def downgrade() -> None:
    op.drop_table('curriculum_subjects')
    op.drop_table('child_curriculums')
    op.drop_table('curriculums')
    op.drop_table('subjects')
