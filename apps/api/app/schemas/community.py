from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ── Enums ──────────────────────────────────────────────────────────────────


class RegionScope(str, Enum):
    ONLINE = "online"
    COUNTRY = "country"
    COUNTRY_REGION = "country_region"


class JoinMode(str, Enum):
    REQUEST_TO_JOIN = "request_to_join"
    INVITE_ONLY = "invite_only"


class CommunityRole(str, Enum):
    ADMIN = "admin"
    CO_ADMIN = "co_admin"
    MEMBER = "member"


class MemberStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    REMOVED = "removed"


class ReportTargetType(str, Enum):
    TOPIC = "topic"
    REPLY = "reply"
    FAMILY = "family"


# ── Principle tags (matches Community.principle_tags JSON shape) ──────────


class PrincipleTags(BaseModel):
    faith: Optional[str] = None
    education_methods: list[str] = Field(default_factory=list)
    home_languages: list[str] = Field(default_factory=list)


# ── Discover ──────────────────────────────────────────────────────────────


class FamilyDiscoverCard(BaseModel):
    """Public, child-safe representation of a family for the discover grid."""
    id: UUID
    family_name: str
    family_name_slug: str
    shield_config: Optional[dict] = None
    location_country: Optional[str] = None
    location_country_code: Optional[str] = None
    location_region: Optional[str] = None
    faith_tradition: Optional[str] = None
    faith_denomination: Optional[str] = None
    education_purpose: Optional[str] = None
    education_methods: list[str] = []
    home_languages: list[str] = []
    family_culture_excerpt: Optional[str] = None
    children_count: int = 0
    children_age_min: Optional[int] = None
    children_age_max: Optional[int] = None

    model_config = {"from_attributes": True}


class FamilyDiscoverProfile(FamilyDiscoverCard):
    """Full discover profile — extends the card with extra public fields."""
    family_culture: Optional[str] = None
    worldview_notes: Optional[str] = None
    current_curriculum: list[str] = []
    diet: Optional[str] = None
    screen_policy: Optional[str] = None
    outdoor_orientation: Optional[str] = None
    visible_communities: list["CommunityCardSchema"] = []


class FamilyDiscoverPage(BaseModel):
    items: list[FamilyDiscoverCard]
    page: int
    total: int
    total_pages: int


# ── Communities ───────────────────────────────────────────────────────────


class CommunityCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=60)
    slug: Optional[str] = Field(None, min_length=3, max_length=80)
    tagline: Optional[str] = Field(None, max_length=140)
    description: str = Field("", max_length=2000)
    principles_text: str = Field("", max_length=4000)
    principle_tags: PrincipleTags = Field(default_factory=PrincipleTags)
    region_scope: RegionScope
    country_code: Optional[str] = Field(None, min_length=2, max_length=2)
    region: Optional[str] = Field(None, max_length=100)
    join_mode: JoinMode
    cover_image_url: Optional[str] = Field(None, max_length=500)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        return v.strip()


class CommunityUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=60)
    slug: Optional[str] = Field(None, min_length=3, max_length=80)
    tagline: Optional[str] = Field(None, max_length=140)
    description: Optional[str] = Field(None, max_length=2000)
    principles_text: Optional[str] = Field(None, max_length=4000)
    principle_tags: Optional[PrincipleTags] = None
    region_scope: Optional[RegionScope] = None
    country_code: Optional[str] = Field(None, min_length=2, max_length=2)
    region: Optional[str] = Field(None, max_length=100)
    join_mode: Optional[JoinMode] = None
    cover_image_url: Optional[str] = Field(None, max_length=500)


class CommunityCardSchema(BaseModel):
    id: UUID
    slug: str
    name: str
    tagline: Optional[str] = None
    region_scope: str
    country_code: Optional[str] = None
    region: Optional[str] = None
    join_mode: str
    cover_image_url: Optional[str] = None
    member_count: int
    principle_tags: dict = {}

    model_config = {"from_attributes": True}


class CommunityDetail(CommunityCardSchema):
    description: str
    principles_text: str
    created_at: datetime
    updated_at: datetime
    # Membership context for the calling family
    viewer_role: Optional[str] = None
    viewer_status: Optional[str] = None


class CommunityListPage(BaseModel):
    items: list[CommunityCardSchema]
    page: int
    total: int
    total_pages: int


# ── Membership ────────────────────────────────────────────────────────────


class MemberCard(BaseModel):
    family_id: UUID
    family_name: str
    family_name_slug: str
    shield_config: Optional[dict] = None
    location_country_code: Optional[str] = None
    location_region: Optional[str] = None
    role: str
    status: str
    joined_at: Optional[datetime] = None


class MembersList(BaseModel):
    active: list[MemberCard]
    pending: list[MemberCard] = []


class TransferAdminRequest(BaseModel):
    to_family_id: UUID


# ── Invitations ───────────────────────────────────────────────────────────


class InvitationCreate(BaseModel):
    family_id: Optional[UUID] = None  # If None, returns a link-based invite token


class InvitationResponseSchema(BaseModel):
    id: UUID
    community_id: UUID
    invited_family_id: Optional[UUID] = None
    expires_at: datetime
    created_at: datetime
    token: Optional[str] = None  # Returned only on creation (link invites)

    model_config = {"from_attributes": True}


class InvitationAcceptRequest(BaseModel):
    token: str = Field(..., min_length=16, max_length=128)


# ── Forum ─────────────────────────────────────────────────────────────────


class TopicCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    body: str = Field(..., min_length=1, max_length=20000)


class TopicUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    body: Optional[str] = Field(None, min_length=1, max_length=20000)
    is_pinned: Optional[bool] = None
    is_locked: Optional[bool] = None


class TopicCard(BaseModel):
    id: UUID
    community_id: UUID
    author_family_id: UUID
    author_family_name: str
    title: str
    is_pinned: bool
    is_locked: bool
    reply_count: int
    last_reply_at: Optional[datetime] = None
    created_at: datetime


class TopicListPage(BaseModel):
    items: list[TopicCard]
    page: int
    total: int
    total_pages: int


class ReplyCard(BaseModel):
    id: UUID
    topic_id: UUID
    author_family_id: UUID
    author_family_name: str
    body: str
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[str] = None
    edited_at: Optional[datetime] = None
    created_at: datetime


class TopicDetailSchema(BaseModel):
    id: UUID
    community_id: UUID
    author_family_id: UUID
    author_family_name: str
    title: str
    body: str
    is_pinned: bool
    is_locked: bool
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[str] = None
    edited_at: Optional[datetime] = None
    created_at: datetime
    replies: list[ReplyCard]


class ReplyCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=20000)


class ReplyUpdate(BaseModel):
    body: str = Field(..., min_length=1, max_length=20000)


# ── Reports ───────────────────────────────────────────────────────────────


class ReportCreate(BaseModel):
    target_type: ReportTargetType
    target_id: UUID
    reason: str = Field(..., min_length=1, max_length=500)


class ReportSchema(BaseModel):
    id: UUID
    target_type: str
    target_id: UUID
    community_id: Optional[UUID] = None
    reporter_family_id: Optional[UUID] = None
    reason: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# Late-bind forward reference
FamilyDiscoverProfile.model_rebuild()
