"""add_family_messages_tables

Adds family-to-family messaging:
  * message_threads — canonical pair of families (family_a_id < family_b_id)
  * message_thread_participants — per-side read state, mute, soft-delete
  * messages — immutable message items
  * family_blocks — directional rows, mutual enforcement in the service layer
  * message_reports — abuse reports surfaced in the admin moderation queue
  * notifications.thread_id — new column for 'message_received' /
    'message_thread_started' events

Spec: docs/superpowers/specs/2026-05-28-family-messages-design.md

Revision ID: z5p9a1c3g5h7
Revises: y4n8z0b2e4f6
Create Date: 2026-05-28 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "z5p9a1c3g5h7"
down_revision: Union[str, None] = "y4n8z0b2e4f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── message_threads ────────────────────────────────────────────────
    op.create_table(
        "message_threads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("family_a_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("family_b_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("started_by_family_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_message_excerpt", sa.String(length=120), nullable=True),
        sa.Column("last_message_author_family_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["family_a_id"], ["families.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["family_b_id"], ["families.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["started_by_family_id"], ["families.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["last_message_author_family_id"], ["families.id"], ondelete="SET NULL",
        ),
        sa.CheckConstraint(
            "family_a_id < family_b_id",
            name="ck_message_threads_canonical_pair",
        ),
        sa.UniqueConstraint("family_a_id", "family_b_id", name="uq_message_threads_pair"),
    )
    op.create_index(
        "ix_message_threads_last_message_at",
        "message_threads",
        ["last_message_at"],
    )
    op.create_index(
        "ix_message_threads_a_last",
        "message_threads",
        ["family_a_id", "last_message_at"],
    )
    op.create_index(
        "ix_message_threads_b_last",
        "message_threads",
        ["family_b_id", "last_message_at"],
    )

    # ── message_thread_participants ────────────────────────────────────
    op.create_table(
        "message_thread_participants",
        sa.Column("thread_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "notifications_muted", sa.Boolean(), nullable=False, server_default=sa.text("false"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("thread_id", "family_id"),
        sa.ForeignKeyConstraint(["thread_id"], ["message_threads.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"], ondelete="CASCADE"),
    )

    # ── messages ───────────────────────────────────────────────────────
    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("thread_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["thread_id"], ["message_threads.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["author_family_id"], ["families.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_messages_created_at", "messages", ["created_at"])
    op.create_index(
        "ix_messages_thread_created",
        "messages",
        ["thread_id", "created_at"],
    )

    # ── family_blocks ──────────────────────────────────────────────────
    op.create_table(
        "family_blocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("blocker_family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("blocked_family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["blocker_family_id"], ["families.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["blocked_family_id"], ["families.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "blocker_family_id", "blocked_family_id", name="uq_family_blocks_pair",
        ),
        sa.CheckConstraint(
            "blocker_family_id <> blocked_family_id",
            name="ck_family_blocks_no_self",
        ),
    )
    op.create_index("ix_family_blocks_blocker", "family_blocks", ["blocker_family_id"])
    op.create_index("ix_family_blocks_blocked", "family_blocks", ["blocked_family_id"])

    # ── message_reports ────────────────────────────────────────────────
    op.create_table(
        "message_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("thread_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reporter_family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reported_family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.String(length=500), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("resolved_by", sa.String(length=255), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_note", sa.String(length=2000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["thread_id"], ["message_threads.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reporter_family_id"], ["families.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reported_family_id"], ["families.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_message_reports_thread_id", "message_reports", ["thread_id"])

    # ── notifications.thread_id ────────────────────────────────────────
    op.add_column(
        "notifications",
        sa.Column("thread_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_notifications_thread_id",
        "notifications",
        "message_threads",
        ["thread_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_notifications_thread_id", "notifications", ["thread_id"])


def downgrade() -> None:
    op.drop_index("ix_notifications_thread_id", table_name="notifications")
    op.drop_constraint("fk_notifications_thread_id", "notifications", type_="foreignkey")
    op.drop_column("notifications", "thread_id")

    op.drop_index("ix_message_reports_thread_id", table_name="message_reports")
    op.drop_table("message_reports")

    op.drop_index("ix_family_blocks_blocked", table_name="family_blocks")
    op.drop_index("ix_family_blocks_blocker", table_name="family_blocks")
    op.drop_table("family_blocks")

    op.drop_index("ix_messages_thread_created", table_name="messages")
    op.drop_index("ix_messages_created_at", table_name="messages")
    op.drop_table("messages")

    op.drop_table("message_thread_participants")

    op.drop_index("ix_message_threads_b_last", table_name="message_threads")
    op.drop_index("ix_message_threads_a_last", table_name="message_threads")
    op.drop_index("ix_message_threads_last_message_at", table_name="message_threads")
    op.drop_table("message_threads")
