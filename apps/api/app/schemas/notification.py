"""Pydantic schemas for the in-app notification system (v2 spec §6)."""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class NotificationItem(BaseModel):
    id: UUID
    event_type: str  # 'topic_created' | 'reply_created'
    community_id: Optional[UUID] = None
    community_slug: Optional[str] = None
    community_name: Optional[str] = None
    topic_id: Optional[UUID] = None
    topic_title: Optional[str] = None
    reply_id: Optional[UUID] = None
    actor_family_id: Optional[UUID] = None
    actor_family_name: Optional[str] = None
    actor_shield_config: Optional[dict] = None
    read_at: Optional[datetime] = None
    created_at: datetime


class NotificationListPage(BaseModel):
    items: list[NotificationItem]
    unread_count: int


class UnreadCount(BaseModel):
    count: int


class MuteRequest(BaseModel):
    muted: bool


class DashboardCommunityRow(BaseModel):
    community: dict  # CommunityCardSchema shape, kept loose to avoid circular imports
    unread_count: int
    last_activity: Optional[dict] = None


class DashboardSummary(BaseModel):
    items: list[DashboardCommunityRow]
