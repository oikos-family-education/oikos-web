"""Add teaching logs table

Revision ID: m3i1l5h9a0k1
Revises: l2h0k4g89j05
Create Date: 2026-04-21 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = 'm3i1l5h9a0k1'
down_revision: Union[str, None] = 'l2h0k4g89j05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SCOPE_SENTINEL = '00000000-0000-0000-0000-000000000000'


def upgrade() -> None:
    op.create_table(
        'teaching_logs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('family_id', UUID(as_uuid=True), sa.ForeignKey('families.id', ondelete='CASCADE'), nullable=False),
        sa.Column('taught_on', sa.Date, nullable=False),
        sa.Column('child_id', UUID(as_uuid=True), sa.ForeignKey('children.id', ondelete='CASCADE'), nullable=True),
        sa.Column('subject_id', UUID(as_uuid=True), sa.ForeignKey('subjects.id', ondelete='SET NULL'), nullable=True),
        sa.Column('minutes', sa.SmallInteger, nullable=True),
        sa.Column('notes', sa.String(500), nullable=True),
        sa.Column('logged_by_user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.CheckConstraint(
            'minutes IS NULL OR (minutes > 0 AND minutes <= 720)',
            name='ck_teaching_logs_minutes_range',
        ),
    )

    op.create_index('ix_teaching_logs_family_id', 'teaching_logs', ['family_id'])
    op.create_index('ix_teaching_logs_taught_on', 'teaching_logs', ['taught_on'])
    op.create_index(
        'ix_teaching_logs_family_date',
        'teaching_logs',
        ['family_id', sa.text('taught_on DESC')],
    )
    op.create_index(
        'ix_teaching_logs_family_child_date',
        'teaching_logs',
        ['family_id', 'child_id', sa.text('taught_on DESC')],
    )
    op.create_index(
        'ix_teaching_logs_family_subject_date',
        'teaching_logs',
        ['family_id', 'subject_id', sa.text('taught_on DESC')],
    )

    # Unique index using COALESCE so NULL child_id / subject_id count as "all".
    op.execute(
        f"""
        CREATE UNIQUE INDEX uq_teaching_logs_scope ON teaching_logs (
            family_id,
            taught_on,
            COALESCE(child_id, '{SCOPE_SENTINEL}'::uuid),
            COALESCE(subject_id, '{SCOPE_SENTINEL}'::uuid)
        )
        """
    )


def downgrade() -> None:
    op.execute('DROP INDEX IF EXISTS uq_teaching_logs_scope')
    op.drop_index('ix_teaching_logs_family_subject_date', table_name='teaching_logs')
    op.drop_index('ix_teaching_logs_family_child_date', table_name='teaching_logs')
    op.drop_index('ix_teaching_logs_family_date', table_name='teaching_logs')
    op.drop_index('ix_teaching_logs_taught_on', table_name='teaching_logs')
    op.drop_index('ix_teaching_logs_family_id', table_name='teaching_logs')
    op.drop_table('teaching_logs')
