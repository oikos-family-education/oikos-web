"""Add ui_preferences column to users

Revision ID: r8n6q0m4f5p6
Revises: q7m5p9l3e4o5
Create Date: 2026-05-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = 'r8n6q0m4f5p6'
down_revision: Union[str, None] = 'q7m5p9l3e4o5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column(
            'ui_preferences',
            JSONB,
            nullable=False,
            server_default='{"theme":"system","font_size":"default","reduce_motion":false,"high_contrast":false,"dyslexia_font":false}',
        ),
    )


def downgrade() -> None:
    op.drop_column('users', 'ui_preferences')
