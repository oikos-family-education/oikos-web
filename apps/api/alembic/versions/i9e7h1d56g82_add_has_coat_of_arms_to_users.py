"""Add has_coat_of_arms flag to users table

Revision ID: i9e7h1d56g82
Revises: h8d6g0c45f71
Create Date: 2026-04-02 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'i9e7h1d56g82'
down_revision: Union[str, None] = 'h8d6g0c45f71'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('has_coat_of_arms', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade() -> None:
    op.drop_column('users', 'has_coat_of_arms')
