"""add_community_join_flow_columns

Adds three columns supporting tighter request/approve/deny flow:
  * communities.closed_to_new_members BOOLEAN — admin-controlled stop sign
  * community_members.join_message VARCHAR(500) — free-text request note
  * community_members.agreed_to_principles_at TIMESTAMPTZ — explicit consent

Revision ID: y4n8z0b2e4f6
Revises: x3m7y9a1d3e5
Create Date: 2026-05-27 11:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "y4n8z0b2e4f6"
down_revision: Union[str, None] = "x3m7y9a1d3e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "communities",
        sa.Column(
            "closed_to_new_members",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "community_members",
        sa.Column("join_message", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "community_members",
        sa.Column("agreed_to_principles_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("community_members", "agreed_to_principles_at")
    op.drop_column("community_members", "join_message")
    op.drop_column("communities", "closed_to_new_members")
