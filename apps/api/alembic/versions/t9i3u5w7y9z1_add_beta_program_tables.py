"""add_beta_program_tables

Adds tables for the closed beta program:
  * beta_applications — public applications submitted via /beta
  * admin_allowlist   — DB-backed admin allowlist (env var allowlist is read separately)
  * audit_log         — append-only log of admin actions

Revision ID: t9i3u5w7y9z1
Revises: s8h2t4v6x8y0
Create Date: 2026-05-21 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "t9i3u5w7y9z1"
down_revision: Union[str, None] = "s8h2t4v6x8y0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "beta_applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("internal_note", sa.Text(), nullable=True),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decided_by_admin_email", sa.String(length=255), nullable=True),
        sa.Column("invite_token_hash", sa.String(length=255), nullable=True),
        sa.Column("invite_token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("invite_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("invite_consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("registered_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["registered_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint(
            "status IN ('pending','approved','denied')",
            name="ck_beta_applications_status_valid",
        ),
    )
    op.create_index("ix_beta_applications_email", "beta_applications", ["email"], unique=True)
    op.create_index("ix_beta_applications_status", "beta_applications", ["status"])
    op.create_index("ix_beta_applications_applied_at", "beta_applications", ["applied_at"])
    op.create_index("ix_beta_applications_invite_token_hash", "beta_applications", ["invite_token_hash"])
    op.create_index(
        "ix_beta_applications_registered_user_id", "beta_applications", ["registered_user_id"]
    )

    op.create_table(
        "admin_allowlist",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("added_by_admin_email", sa.String(length=255), nullable=True),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_admin_allowlist_email", "admin_allowlist", ["email"], unique=True)

    op.create_table(
        "audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actor_email", sa.String(length=255), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("target_type", sa.String(length=32), nullable=True),
        sa.Column("target_id", sa.String(length=64), nullable=True),
        sa.Column("target_email", sa.String(length=255), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_index("ix_audit_log_ts", "audit_log", ["ts"])
    op.create_index("ix_audit_log_actor_email", "audit_log", ["actor_email"])
    op.create_index("ix_audit_log_action", "audit_log", ["action"])
    op.create_index("ix_audit_log_target_email", "audit_log", ["target_email"])
    op.create_index("ix_audit_log_action_ts", "audit_log", ["action", "ts"])


def downgrade() -> None:
    op.drop_index("ix_audit_log_action_ts", table_name="audit_log")
    op.drop_index("ix_audit_log_target_email", table_name="audit_log")
    op.drop_index("ix_audit_log_action", table_name="audit_log")
    op.drop_index("ix_audit_log_actor_email", table_name="audit_log")
    op.drop_index("ix_audit_log_ts", table_name="audit_log")
    op.drop_table("audit_log")

    op.drop_index("ix_admin_allowlist_email", table_name="admin_allowlist")
    op.drop_table("admin_allowlist")

    op.drop_index("ix_beta_applications_registered_user_id", table_name="beta_applications")
    op.drop_index("ix_beta_applications_invite_token_hash", table_name="beta_applications")
    op.drop_index("ix_beta_applications_applied_at", table_name="beta_applications")
    op.drop_index("ix_beta_applications_status", table_name="beta_applications")
    op.drop_index("ix_beta_applications_email", table_name="beta_applications")
    op.drop_table("beta_applications")
