"""add_grid_config_to_week_templates

Adds per-template grid configuration columns:
  * start_hour       (SMALLINT, NOT NULL, default 6)   — hour the grid starts (6-21)
  * end_hour         (SMALLINT, NOT NULL, default 22)  — hour the grid ends (7-22)
  * include_saturday (BOOLEAN, NOT NULL, default true)
  * include_sunday   (BOOLEAN, NOT NULL, default true)

Revision ID: s8h2t4v6x8y0
Revises: f22e651d2a93
Create Date: 2026-05-19 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 's8h2t4v6x8y0'
down_revision: Union[str, None] = 'f22e651d2a93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'week_templates',
        sa.Column('start_hour', sa.SmallInteger(), nullable=False, server_default='6'),
    )
    op.add_column(
        'week_templates',
        sa.Column('end_hour', sa.SmallInteger(), nullable=False, server_default='22'),
    )
    op.add_column(
        'week_templates',
        sa.Column('include_saturday', sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        'week_templates',
        sa.Column('include_sunday', sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column('week_templates', 'include_sunday')
    op.drop_column('week_templates', 'include_saturday')
    op.drop_column('week_templates', 'end_hour')
    op.drop_column('week_templates', 'start_hour')
