import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Boolean, Integer, DateTime, ForeignKey, Text,
    CheckConstraint, UniqueConstraint, Index, text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Community(Base):
    __tablename__ = "communities"
    __table_args__ = (
        CheckConstraint(
            "region_scope = 'online' OR country_code IS NOT NULL",
            name="ck_communities_country_required_for_geo",
        ),
        CheckConstraint(
            "region_scope <> 'country_region' OR region IS NOT NULL",
            name="ck_communities_region_required_for_country_region",
        ),
        Index("ix_communities_country_region", "country_code", "region"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(80), unique=True, nullable=False, index=True)
    name = Column(String(60), nullable=False)
    tagline = Column(String(140), nullable=True)
    description = Column(Text, nullable=False, server_default="", default="")
    principles_text = Column(Text, nullable=False, server_default="", default="")
    principle_tags = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"), default=dict)
    region_scope = Column(String(20), nullable=False)  # 'online' | 'country' | 'country_region'
    country_code = Column(String(2), nullable=True, index=True)
    region = Column(String(100), nullable=True, index=True)
    join_mode = Column(String(20), nullable=False)  # 'request_to_join' | 'invite_only'
    cover_image_url = Column(String(500), nullable=True)
    member_count = Column(Integer, nullable=False, server_default="1", default=1)
    created_by_family_id = Column(
        UUID(as_uuid=True),
        ForeignKey("families.id", ondelete="RESTRICT"),
        nullable=False,
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    members = relationship("CommunityMember", back_populates="community", cascade="all, delete-orphan")
    topics = relationship("CommunityTopic", back_populates="community", cascade="all, delete-orphan")


class CommunityMember(Base):
    __tablename__ = "community_members"
    __table_args__ = (
        UniqueConstraint("community_id", "family_id", name="uq_community_members_community_family"),
        CheckConstraint(
            "status <> 'active' OR joined_at IS NOT NULL",
            name="ck_community_members_active_has_joined_at",
        ),
        CheckConstraint(
            "role IN ('admin','co_admin','member')",
            name="ck_community_members_role_valid",
        ),
        CheckConstraint(
            "status IN ('pending','active','removed')",
            name="ck_community_members_status_valid",
        ),
        # At most one active admin per community
        Index(
            "uq_community_members_one_active_admin",
            "community_id",
            unique=True,
            postgresql_where=text("role = 'admin' AND status = 'active'"),
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    community_id = Column(
        UUID(as_uuid=True),
        ForeignKey("communities.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    family_id = Column(
        UUID(as_uuid=True),
        ForeignKey("families.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    role = Column(String(20), nullable=False, default="member")
    status = Column(String(20), nullable=False, default="pending")
    joined_at = Column(DateTime(timezone=True), nullable=True)
    removed_at = Column(DateTime(timezone=True), nullable=True)
    removed_reason = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    community = relationship("Community", back_populates="members")


class CommunityInvitation(Base):
    __tablename__ = "community_invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    community_id = Column(
        UUID(as_uuid=True),
        ForeignKey("communities.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    invited_family_id = Column(
        UUID(as_uuid=True),
        ForeignKey("families.id", ondelete="SET NULL"),
        nullable=True,
    )
    invited_by_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    token_hash = Column(String(64), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    accepted_by_family_id = Column(
        UUID(as_uuid=True),
        ForeignKey("families.id", ondelete="SET NULL"),
        nullable=True,
    )
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class CommunityTopic(Base):
    __tablename__ = "community_topics"
    __table_args__ = (
        Index(
            "ix_community_topics_sort",
            "community_id",
            "is_pinned",
            "last_reply_at",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    community_id = Column(
        UUID(as_uuid=True),
        ForeignKey("communities.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    author_family_id = Column(
        UUID(as_uuid=True),
        ForeignKey("families.id", ondelete="RESTRICT"),
        nullable=False,
    )
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    is_pinned = Column(Boolean, nullable=False, server_default="false", default=False)
    is_locked = Column(Boolean, nullable=False, server_default="false", default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by = Column(String(20), nullable=True)  # 'author' | 'community_admin' | 'platform_admin'
    reply_count = Column(Integer, nullable=False, server_default="0", default=0)
    last_reply_at = Column(DateTime(timezone=True), nullable=True)
    edited_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    community = relationship("Community", back_populates="topics")
    replies = relationship("CommunityReply", back_populates="topic", cascade="all, delete-orphan")


class CommunityReply(Base):
    __tablename__ = "community_replies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    topic_id = Column(
        UUID(as_uuid=True),
        ForeignKey("community_topics.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    author_family_id = Column(
        UUID(as_uuid=True),
        ForeignKey("families.id", ondelete="RESTRICT"),
        nullable=False,
    )
    body = Column(Text, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by = Column(String(20), nullable=True)
    edited_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    topic = relationship("CommunityTopic", back_populates="replies")


class CommunityReport(Base):
    __tablename__ = "community_reports"
    __table_args__ = (
        CheckConstraint(
            "target_type IN ('topic','reply','family')",
            name="ck_community_reports_target_type_valid",
        ),
        CheckConstraint(
            "status IN ('open','resolved','dismissed')",
            name="ck_community_reports_status_valid",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    target_type = Column(String(20), nullable=False)
    target_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    community_id = Column(
        UUID(as_uuid=True),
        ForeignKey("communities.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    reporter_family_id = Column(
        UUID(as_uuid=True),
        ForeignKey("families.id", ondelete="SET NULL"),
        nullable=True,
    )
    reason = Column(String(500), nullable=False)
    status = Column(String(20), nullable=False, server_default="open", default="open", index=True)
    resolved_by = Column(String(255), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_note = Column(String(2000), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
