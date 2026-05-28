"""Pydantic schemas for family-to-family messaging.

Spec: docs/superpowers/specs/2026-05-28-family-messages-design.md
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


MAX_BODY_LEN = 4000
MIN_BODY_LEN = 1
MAX_REASON_LEN = 500


class ThreadFilter(str, Enum):
    ALL = "all"
    UNREAD = "unread"
    ARCHIVED = "archived"


# ── Inputs ────────────────────────────────────────────────────────────────


class StartThreadRequest(BaseModel):
    recipient_family_id: UUID
    body: str = Field(..., min_length=MIN_BODY_LEN, max_length=MAX_BODY_LEN)


class ReplyRequest(BaseModel):
    body: str = Field(..., min_length=MIN_BODY_LEN, max_length=MAX_BODY_LEN)


class MuteRequest(BaseModel):
    muted: bool


class BlockRequest(BaseModel):
    family_id: UUID
    reason: Optional[str] = Field(None, max_length=MAX_REASON_LEN)


class ReportRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=MAX_REASON_LEN)
    also_block: bool = True


# ── Outputs ───────────────────────────────────────────────────────────────


class OtherFamilyIdentity(BaseModel):
    """The "other side" of a thread — strictly family-level identity."""
    id: UUID
    family_name: str
    family_name_slug: Optional[str] = None
    shield_config: Optional[dict] = None


class MessageItemRead(BaseModel):
    id: UUID
    thread_id: UUID
    author_family_id: UUID
    body: str
    created_at: datetime


class ThreadInboxRow(BaseModel):
    id: UUID
    other_family: OtherFamilyIdentity
    last_message_excerpt: Optional[str] = None
    last_message_at: Optional[datetime] = None
    last_message_author_family_id: Optional[UUID] = None
    unread: bool = False
    is_blocked: bool = False
    notifications_muted: bool = False
    deleted_on_my_side: bool = False


class InboxPage(BaseModel):
    items: list[ThreadInboxRow]
    page: int
    total: int
    total_pages: int


class ThreadDetail(BaseModel):
    id: UUID
    other_family: OtherFamilyIdentity
    can_send: bool = True
    blocked_by_me: bool = False
    blocked_by_them: bool = False
    notifications_muted: bool = False
    last_read_at: Optional[datetime] = None
    messages: list[MessageItemRead]
    next_cursor: Optional[datetime] = None


class StartThreadResponse(BaseModel):
    thread: ThreadDetail
    message: MessageItemRead


class UnreadCount(BaseModel):
    threads: int


class BlockRead(BaseModel):
    family: OtherFamilyIdentity
    created_at: datetime
    reason: Optional[str] = None


class BlockList(BaseModel):
    items: list[BlockRead]
