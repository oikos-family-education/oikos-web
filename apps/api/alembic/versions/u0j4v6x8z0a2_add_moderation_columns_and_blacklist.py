"""add_moderation_columns_and_blacklist

Adds moderation state to the `users` table and creates an `email_blacklist` table
for emails barred from re-registration (populated by bans).

Revision ID: u0j4v6x8z0a2
Revises: t9i3u5w7y9z1
Create Date: 2026-05-21 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "u0j4v6x8z0a2"
down_revision: Union[str, None] = "t9i3u5w7y9z1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("moderation_status", sa.String(length=20), nullable=False, server_default="active"),
    )
    op.add_column("users", sa.Column("moderation_reason", sa.String(length=2000), nullable=True))
    op.add_column("users", sa.Column("moderation_set_by", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("moderation_set_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "users", sa.Column("moderation_expires_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_index("ix_users_moderation_status", "users", ["moderation_status"])

    op.create_table(
        "email_blacklist",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("source_action", sa.String(length=64), nullable=True),
        sa.Column("source_actor_email", sa.String(length=255), nullable=True),
        sa.Column("reason", sa.String(length=2000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_email_blacklist_email", "email_blacklist", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_email_blacklist_email", table_name="email_blacklist")
    op.drop_table("email_blacklist")

    op.drop_index("ix_users_moderation_status", table_name="users")
    op.drop_column("users", "moderation_expires_at")
    op.drop_column("users", "moderation_set_at")
    op.drop_column("users", "moderation_set_by")
    op.drop_column("users", "moderation_reason")
    op.drop_column("users", "moderation_status")
