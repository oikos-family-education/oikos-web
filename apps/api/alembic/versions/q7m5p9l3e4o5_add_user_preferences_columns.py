"""Add user locale and notification preferences columns

Revision ID: q7m5p9l3e4o5
Revises: p6l4o8k2d3n4
Create Date: 2026-05-13 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = 'q7m5p9l3e4o5'
down_revision: Union[str, None] = 'p6l4o8k2d3n4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('timezone', sa.String(100), nullable=False, server_default='UTC'))
    op.add_column('users', sa.Column('locale', sa.String(10), nullable=False, server_default='en'))
    op.add_column('users', sa.Column('date_format', sa.String(20), nullable=False, server_default='MM/DD/YYYY'))
    op.add_column('users', sa.Column('time_format', sa.String(5), nullable=False, server_default='12h'))
    op.add_column(
        'users',
        sa.Column(
            'notification_preferences',
            JSONB,
            nullable=False,
            server_default='{"weekly_summary":true,"lesson_reminders":false,"lesson_reminder_offset_hours":1,"progress_milestones":true,"member_activity":false,"platform_news":true}',
        ),
    )


def downgrade() -> None:
    op.drop_column('users', 'notification_preferences')
    op.drop_column('users', 'time_format')
    op.drop_column('users', 'date_format')
    op.drop_column('users', 'locale')
    op.drop_column('users', 'timezone')
