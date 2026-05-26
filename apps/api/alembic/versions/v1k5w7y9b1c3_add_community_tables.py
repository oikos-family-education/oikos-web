"""add_community_tables

Adds the community feature: discoverability columns on families plus seven
new tables (communities, community_members, community_invitations,
community_topics, community_replies, community_reports).

See docs/superpowers/specs/2026-05-26-community-area-design.md.

Revision ID: v1k5w7y9b1c3
Revises: u0j4v6x8z0a2
Create Date: 2026-05-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "v1k5w7y9b1c3"
down_revision: Union[str, None] = "u0j4v6x8z0a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- families: discoverability opt-in ---
    op.add_column(
        "families",
        sa.Column("discoverable", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "families",
        sa.Column("discoverable_set_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_families_discoverable", "families", ["discoverable"])

    # --- communities ---
    op.create_table(
        "communities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("tagline", sa.String(length=140), nullable=True),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("principles_text", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "principle_tags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("region_scope", sa.String(length=20), nullable=False),
        sa.Column("country_code", sa.String(length=2), nullable=True),
        sa.Column("region", sa.String(length=100), nullable=True),
        sa.Column("join_mode", sa.String(length=20), nullable=False),
        sa.Column("cover_image_url", sa.String(length=500), nullable=True),
        sa.Column("member_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_by_family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_by_family_id"], ["families.id"], ondelete="RESTRICT"),
        sa.CheckConstraint(
            "region_scope = 'online' OR country_code IS NOT NULL",
            name="ck_communities_country_required_for_geo",
        ),
        sa.CheckConstraint(
            "region_scope <> 'country_region' OR region IS NOT NULL",
            name="ck_communities_region_required_for_country_region",
        ),
        sa.CheckConstraint(
            "region_scope IN ('online','country','country_region')",
            name="ck_communities_region_scope_valid",
        ),
        sa.CheckConstraint(
            "join_mode IN ('request_to_join','invite_only')",
            name="ck_communities_join_mode_valid",
        ),
    )
    op.create_index("ix_communities_slug", "communities", ["slug"], unique=True)
    op.create_index("ix_communities_country_code", "communities", ["country_code"])
    op.create_index("ix_communities_region", "communities", ["region"])
    op.create_index("ix_communities_country_region", "communities", ["country_code", "region"])
    op.create_index("ix_communities_deleted_at", "communities", ["deleted_at"])

    # --- community_members ---
    op.create_table(
        "community_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("community_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("removed_reason", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["community_id"], ["communities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("community_id", "family_id", name="uq_community_members_community_family"),
        sa.CheckConstraint(
            "status <> 'active' OR joined_at IS NOT NULL",
            name="ck_community_members_active_has_joined_at",
        ),
        sa.CheckConstraint(
            "role IN ('admin','co_admin','member')",
            name="ck_community_members_role_valid",
        ),
        sa.CheckConstraint(
            "status IN ('pending','active','removed')",
            name="ck_community_members_status_valid",
        ),
    )
    op.create_index("ix_community_members_community_id", "community_members", ["community_id"])
    op.create_index("ix_community_members_family_id", "community_members", ["family_id"])
    op.create_index(
        "uq_community_members_one_active_admin",
        "community_members",
        ["community_id"],
        unique=True,
        postgresql_where=sa.text("role = 'admin' AND status = 'active'"),
    )

    # --- community_invitations ---
    op.create_table(
        "community_invitations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("community_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invited_family_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("invited_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accepted_by_family_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["community_id"], ["communities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_family_id"], ["families.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["invited_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["accepted_by_family_id"], ["families.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_community_invitations_community_id", "community_invitations", ["community_id"])
    op.create_index("ix_community_invitations_token_hash", "community_invitations", ["token_hash"])

    # --- community_topics ---
    op.create_table(
        "community_topics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("community_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_locked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(length=20), nullable=True),
        sa.Column("reply_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_reply_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["community_id"], ["communities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["author_family_id"], ["families.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_community_topics_community_id", "community_topics", ["community_id"])
    op.create_index(
        "ix_community_topics_sort",
        "community_topics",
        ["community_id", "is_pinned", "last_reply_at"],
    )

    # --- community_replies ---
    op.create_table(
        "community_replies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("topic_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(length=20), nullable=True),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["topic_id"], ["community_topics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["author_family_id"], ["families.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_community_replies_topic_id", "community_replies", ["topic_id"])

    # --- community_reports ---
    op.create_table(
        "community_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("target_type", sa.String(length=20), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("community_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reporter_family_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reason", sa.String(length=500), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("resolved_by", sa.String(length=255), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_note", sa.String(length=2000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["community_id"], ["communities.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["reporter_family_id"], ["families.id"], ondelete="SET NULL"),
        sa.CheckConstraint(
            "target_type IN ('topic','reply','family')",
            name="ck_community_reports_target_type_valid",
        ),
        sa.CheckConstraint(
            "status IN ('open','resolved','dismissed')",
            name="ck_community_reports_status_valid",
        ),
    )
    op.create_index("ix_community_reports_target_id", "community_reports", ["target_id"])
    op.create_index("ix_community_reports_community_id", "community_reports", ["community_id"])
    op.create_index("ix_community_reports_status", "community_reports", ["status"])


def downgrade() -> None:
    op.drop_index("ix_community_reports_status", table_name="community_reports")
    op.drop_index("ix_community_reports_community_id", table_name="community_reports")
    op.drop_index("ix_community_reports_target_id", table_name="community_reports")
    op.drop_table("community_reports")

    op.drop_index("ix_community_replies_topic_id", table_name="community_replies")
    op.drop_table("community_replies")

    op.drop_index("ix_community_topics_sort", table_name="community_topics")
    op.drop_index("ix_community_topics_community_id", table_name="community_topics")
    op.drop_table("community_topics")

    op.drop_index("ix_community_invitations_token_hash", table_name="community_invitations")
    op.drop_index("ix_community_invitations_community_id", table_name="community_invitations")
    op.drop_table("community_invitations")

    op.drop_index("uq_community_members_one_active_admin", table_name="community_members")
    op.drop_index("ix_community_members_family_id", table_name="community_members")
    op.drop_index("ix_community_members_community_id", table_name="community_members")
    op.drop_table("community_members")

    op.drop_index("ix_communities_deleted_at", table_name="communities")
    op.drop_index("ix_communities_country_region", table_name="communities")
    op.drop_index("ix_communities_region", table_name="communities")
    op.drop_index("ix_communities_country_code", table_name="communities")
    op.drop_index("ix_communities_slug", table_name="communities")
    op.drop_table("communities")

    op.drop_index("ix_families_discoverable", table_name="families")
    op.drop_column("families", "discoverable_set_at")
    op.drop_column("families", "discoverable")
