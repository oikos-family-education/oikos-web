"""Family-to-family messaging models.

Spec: docs/superpowers/specs/2026-05-28-family-messages-design.md

Tables added by this module:
  * message_threads — one row per unordered pair of families
  * message_thread_participants — per-side read state, mute, soft-delete
  * messages — immutable message items inside a thread
  * family_blocks — directional in storage, enforced mutually
  * message_reports — abuse reports surfaced in the admin moderation queue
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, CheckConstraint, Column, DateTime, ForeignKey, Index, String,
    Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class MessageThread(Base):
    """One row per unordered pair of families.

    The canonical-pair invariant (`family_a_id < family_b_id` lexicographically)
    means there is at most one thread per pair and we never need an OR-clause
    when looking it up.
    """
    __tablename__ = "message_threads"
    __table_args__ = (
        CheckConstraint(
            "family_a_id < family_b_id",
            name="ck_message_threads_canonical_pair",
        ),
        UniqueConstraint(
            "family_a_id", "family_b_id",
            name="uq_message_threads_pair",
        ),
        Index("ix_message_threads_a_last", "family_a_id", "last_message_at"),
        Index("ix_message_threads_b_last", "family_b_id", "last_message_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_a_id = Column(
        UUID(as_uuid=True),
        ForeignKey("families.id", ondelete="CASCADE"),
        nullable=False,
    )
    family_b_id = Column(
        UUID(as_uuid=True),
        ForeignKey("families.id", ondelete="CASCADE"),
        nullable=False,
    )
    started_by_family_id = Column(
        UUID(as_uuid=True),
        ForeignKey("families.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Denormalised — kept in sync by message_service. Drives the inbox row.
    last_message_at = Column(DateTime(timezone=True), nullable=True, index=True)
    last_message_excerpt = Column(String(120), nullable=True)
    last_message_author_family_id = Column(
        UUID(as_uuid=True),
        ForeignKey("families.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    participants = relationship(
        "MessageThreadParticipant",
        back_populates="thread",
        cascade="all, delete-orphan",
    )
    messages = relationship(
        "MessageItem",
        back_populates="thread",
        cascade="all, delete-orphan",
        order_by="MessageItem.created_at",
    )


class MessageThreadParticipant(Base):
    """Per-side state for a thread (two rows per thread)."""
    __tablename__ = "message_thread_participants"

    thread_id = Column(
        UUID(as_uuid=True),
        ForeignKey("message_threads.id", ondelete="CASCADE"),
        primary_key=True,
    )
    family_id = Column(
        UUID(as_uuid=True),
        ForeignKey("families.id", ondelete="CASCADE"),
        primary_key=True,
    )
    last_read_at = Column(DateTime(timezone=True), nullable=True)
    notifications_muted = Column(
        Boolean, nullable=False, server_default="false", default=False,
    )
    # Per-side soft delete. New incoming message clears this so the thread
    # reappears in that side's inbox.
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    thread = relationship("MessageThread", back_populates="participants")


class MessageItem(Base):
    """Immutable single message inside a thread."""
    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_thread_created", "thread_id", "created_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id = Column(
        UUID(as_uuid=True),
        ForeignKey("message_threads.id", ondelete="CASCADE"),
        nullable=False,
    )
    author_family_id = Column(
        UUID(as_uuid=True),
        ForeignKey("families.id", ondelete="RESTRICT"),
        nullable=False,
    )
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)

    thread = relationship("MessageThread", back_populates="messages")


class FamilyBlock(Base):
    """A blocker_family blocks the blocked_family.

    Storage is directional (lets the unblocker undo only their own block),
    but enforcement is mutual: `is_blocked(a, b)` returns true if a row
    exists in either direction.
    """
    __tablename__ = "family_blocks"
    __table_args__ = (
        UniqueConstraint(
            "blocker_family_id", "blocked_family_id",
            name="uq_family_blocks_pair",
        ),
        CheckConstraint(
            "blocker_family_id <> blocked_family_id",
            name="ck_family_blocks_no_self",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    blocker_family_id = Column(
        UUID(as_uuid=True),
        ForeignKey("families.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    blocked_family_id = Column(
        UUID(as_uuid=True),
        ForeignKey("families.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # Optional, never shown to the blocked side.
    reason = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class MessageReport(Base):
    """Abuse report on a thread, mirrors CommunityReport's shape."""
    __tablename__ = "message_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id = Column(
        UUID(as_uuid=True),
        ForeignKey("message_threads.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    reporter_family_id = Column(
        UUID(as_uuid=True),
        ForeignKey("families.id", ondelete="CASCADE"),
        nullable=False,
    )
    reported_family_id = Column(
        UUID(as_uuid=True),
        ForeignKey("families.id", ondelete="CASCADE"),
        nullable=False,
    )
    reason = Column(String(500), nullable=False)
    status = Column(String(20), nullable=False, server_default="open", default="open")
    resolved_by = Column(String(255), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_note = Column(String(2000), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
