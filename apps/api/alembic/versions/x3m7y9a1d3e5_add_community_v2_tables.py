"""add_community_v2_tables

v2 schema additions for the community area:
  * communities.identity (JSONB) — banner colors + emblem
  * community_members.notifications_muted (BOOLEAN) — per-recipient mute
  * community_meetups — meetup series + one-offs
  * community_meetup_rsvps — per-occurrence RSVPs
  * notifications — generic notification rows fanned out on topic/reply create

Revision ID: x3m7y9a1d3e5
Revises: w2l6x8z0c2d4
Create Date: 2026-05-27 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "x3m7y9a1d3e5"
down_revision: Union[str, None] = "w2l6x8z0c2d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # communities.identity
    op.add_column(
        "communities",
        sa.Column(
            "identity",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )

    # community_members.notifications_muted
    op.add_column(
        "community_members",
        sa.Column(
            "notifications_muted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    # community_meetups
    op.create_table(
        "community_meetups",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("community_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by_family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("recurrence", sa.String(length=20), nullable=False, server_default="none"),
        sa.Column("recurrence_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("location_text", sa.String(length=200), nullable=True),
        sa.Column("meeting_url", sa.String(length=500), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["community_id"], ["communities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_family_id"], ["families.id"], ondelete="RESTRICT"),
        sa.CheckConstraint(
            "recurrence IN ('none','weekly','biweekly','monthly')",
            name="ck_community_meetups_recurrence_valid",
        ),
        sa.CheckConstraint(
            "location_text IS NOT NULL OR meeting_url IS NOT NULL",
            name="ck_community_meetups_has_location_or_url",
        ),
        sa.CheckConstraint(
            "duration_minutes BETWEEN 1 AND 1440",
            name="ck_community_meetups_duration_valid",
        ),
    )
    op.create_index("ix_community_meetups_community_id", "community_meetups", ["community_id"])
    op.create_index(
        "ix_community_meetups_community_starts",
        "community_meetups",
        ["community_id", "starts_at"],
    )

    # community_meetup_rsvps
    op.create_table(
        "community_meetup_rsvps",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("meetup_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("occurrence_date", sa.DateTime(timezone=False), nullable=False),
        sa.Column("response", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["meetup_id"], ["community_meetups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "meetup_id", "family_id", "occurrence_date",
            name="uq_community_meetup_rsvps_unique",
        ),
        sa.CheckConstraint(
            "response IN ('going','maybe','not_going')",
            name="ck_community_meetup_rsvps_response_valid",
        ),
    )
    op.create_index("ix_community_meetup_rsvps_meetup_id", "community_meetup_rsvps", ["meetup_id"])
    op.create_index("ix_community_meetup_rsvps_family_id", "community_meetup_rsvps", ["family_id"])

    # notifications
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("recipient_family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("community_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=30), nullable=False),
        sa.Column("topic_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reply_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_family_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["recipient_family_id"], ["families.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["community_id"], ["communities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["topic_id"], ["community_topics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reply_id"], ["community_replies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_family_id"], ["families.id"], ondelete="SET NULL"),
    )
    op.create_index(
        "ix_notifications_recipient_family_id",
        "notifications",
        ["recipient_family_id"],
    )
    op.create_index(
        "ix_notifications_community_id", "notifications", ["community_id"],
    )
    op.create_index(
        "ix_notifications_recipient_unread",
        "notifications",
        ["recipient_family_id", "read_at", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_recipient_unread", table_name="notifications")
    op.drop_index("ix_notifications_community_id", table_name="notifications")
    op.drop_index("ix_notifications_recipient_family_id", table_name="notifications")
    op.drop_table("notifications")

    op.drop_index("ix_community_meetup_rsvps_family_id", table_name="community_meetup_rsvps")
    op.drop_index("ix_community_meetup_rsvps_meetup_id", table_name="community_meetup_rsvps")
    op.drop_table("community_meetup_rsvps")

    op.drop_index("ix_community_meetups_community_starts", table_name="community_meetups")
    op.drop_index("ix_community_meetups_community_id", table_name="community_meetups")
    op.drop_table("community_meetups")

    op.drop_column("community_members", "notifications_muted")
    op.drop_column("communities", "identity")
