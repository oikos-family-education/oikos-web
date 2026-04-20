"""Add project, milestone, portfolio, and achievement tables

Revision ID: k1g9j3f78i04
Revises: j0f8i2e67h93
Create Date: 2026-04-14 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = 'k1g9j3f78i04'
down_revision: Union[str, None] = 'j0f8i2e67h93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Projects
    op.create_table(
        'projects',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('family_id', UUID(as_uuid=True), sa.ForeignKey('families.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('purpose', sa.Text, nullable=True),
        sa.Column('due_date', sa.Date, nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_projects_family_id', 'projects', ['family_id'])
    op.create_index('ix_projects_status', 'projects', ['status'])
    op.create_index('ix_projects_due_date', 'projects', ['due_date'])

    # Project-Children junction
    op.create_table(
        'project_children',
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('child_id', UUID(as_uuid=True), sa.ForeignKey('children.id', ondelete='CASCADE'), nullable=False),
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('project_id', 'child_id'),
    )

    # Project-Subjects junction
    op.create_table(
        'project_subjects',
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('subject_id', UUID(as_uuid=True), sa.ForeignKey('subjects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('is_primary', sa.Boolean, nullable=False, server_default=sa.text('true')),
        sa.PrimaryKeyConstraint('project_id', 'subject_id'),
    )

    # Project Milestones
    op.create_table(
        'project_milestones',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('sort_order', sa.Integer, nullable=False),
        sa.Column('due_date', sa.Date, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_project_milestones_project_id', 'project_milestones', ['project_id'])

    # Milestone Completions
    op.create_table(
        'milestone_completions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('milestone_id', UUID(as_uuid=True), sa.ForeignKey('project_milestones.id', ondelete='CASCADE'), nullable=False),
        sa.Column('child_id', UUID(as_uuid=True), sa.ForeignKey('children.id', ondelete='CASCADE'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('notes', sa.Text, nullable=True),
        sa.UniqueConstraint('milestone_id', 'child_id', name='uq_milestone_child'),
    )
    op.create_index('ix_milestone_completions_milestone_id', 'milestone_completions', ['milestone_id'])
    op.create_index('ix_milestone_completions_child_id', 'milestone_completions', ['child_id'])

    # Project-Resources junction
    op.create_table(
        'project_resources',
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('resource_id', UUID(as_uuid=True), sa.ForeignKey('resources.id', ondelete='CASCADE'), nullable=False),
        sa.Column('added_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('notes', sa.Text, nullable=True),
        sa.PrimaryKeyConstraint('project_id', 'resource_id'),
    )

    # Portfolio Entries
    op.create_table(
        'portfolio_entries',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('child_id', UUID(as_uuid=True), sa.ForeignKey('children.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('reflection', sa.Text, nullable=True),
        sa.Column('parent_notes', sa.Text, nullable=True),
        sa.Column('score', sa.SmallInteger, nullable=True),
        sa.Column('media_urls', sa.ARRAY(sa.String), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('project_id', 'child_id', name='uq_portfolio_project_child'),
        sa.CheckConstraint('score IS NULL OR (score >= 1 AND score <= 10)', name='ck_portfolio_score_range'),
    )
    op.create_index('ix_portfolio_entries_project_id', 'portfolio_entries', ['project_id'])
    op.create_index('ix_portfolio_entries_child_id', 'portfolio_entries', ['child_id'])

    # Child Achievements
    op.create_table(
        'child_achievements',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('child_id', UUID(as_uuid=True), sa.ForeignKey('children.id', ondelete='CASCADE'), nullable=False),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('awarded_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('certificate_number', sa.String(20), nullable=False),
        sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('project_id', 'child_id', name='uq_achievement_project_child'),
    )
    op.create_index('ix_child_achievements_child_id', 'child_achievements', ['child_id'])
    op.create_index('ix_child_achievements_project_id', 'child_achievements', ['project_id'])


def downgrade() -> None:
    op.drop_table('child_achievements')
    op.drop_table('portfolio_entries')
    op.drop_table('project_resources')
    op.drop_table('milestone_completions')
    op.drop_table('project_milestones')
    op.drop_table('project_subjects')
    op.drop_table('project_children')
    op.drop_table('projects')
