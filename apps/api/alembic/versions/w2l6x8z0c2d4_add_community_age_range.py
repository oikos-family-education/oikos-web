"""add_community_age_range

Adds child_age_min and child_age_max columns to communities so a community can
declare the children-age band it's aimed at, and the index page can filter on it.

Revision ID: w2l6x8z0c2d4
Revises: v1k5w7y9b1c3
Create Date: 2026-05-26 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "w2l6x8z0c2d4"
down_revision: Union[str, None] = "v1k5w7y9b1c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("communities", sa.Column("child_age_min", sa.Integer(), nullable=True))
    op.add_column("communities", sa.Column("child_age_max", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "ck_communities_age_range_valid",
        "communities",
        "child_age_min IS NULL OR child_age_max IS NULL OR child_age_min <= child_age_max",
    )


def downgrade() -> None:
    op.drop_constraint("ck_communities_age_range_valid", "communities", type_="check")
    op.drop_column("communities", "child_age_max")
    op.drop_column("communities", "child_age_min")
