from datetime import datetime
from typing import List, Literal, Optional
import uuid

from pydantic import BaseModel, EmailStr, Field


# ---- Overview ----


class OverviewCount(BaseModel):
    label: str
    total: int
    delta_7d: int


class BetaCounts(BaseModel):
    pending: int
    approved: int
    denied: int
    total: int
    cap: int


class TrendPoint(BaseModel):
    date: str  # YYYY-MM-DD
    signups: int
    beta_applications: int
    beta_approvals: int


class MostActiveFamilyItem(BaseModel):
    family_id: uuid.UUID
    family_name: str
    owner_email: Optional[str]
    member_count: int
    child_count: int
    last_active_at: Optional[datetime]


class OverviewResponse(BaseModel):
    counts: dict
    beta: BetaCounts
    trend: List[TrendPoint]
    most_active_families: List[MostActiveFamilyItem]


# ---- Families ----


class FamilyListItem(BaseModel):
    family_id: uuid.UUID
    family_name: str
    owner_email: Optional[str]
    owner_user_id: Optional[uuid.UUID]
    member_count: int
    child_count: int
    created_at: datetime
    last_active_at: Optional[datetime]
    owner_status: Literal["active", "blocked", "banned"] = "active"


class FamilyMemberSummary(BaseModel):
    user_id: uuid.UUID
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    role: Optional[str] = None
    moderation_status: Literal["active", "blocked", "banned"] = "active"
    last_login_at: Optional[datetime]


class ChildSummary(BaseModel):
    """Admin-facing child summary — names are intentionally omitted as PII for minors."""

    child_id: uuid.UUID
    created_at: datetime


class FamilyDetailResponse(BaseModel):
    family_id: uuid.UUID
    family_name: str
    created_at: datetime
    owner_email: Optional[str]
    owner_user_id: Optional[uuid.UUID]
    is_beta_approved: bool
    members: List[FamilyMemberSummary]
    children: List[ChildSummary]
    content_counts: dict
    recent_activity: List[dict]


# ---- Moderation ----


class ModerationActionRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=2000)
    expires_at: Optional[datetime] = None  # only for block; null = indefinite


class BlockedUserItem(BaseModel):
    user_id: uuid.UUID
    email: str
    reason: Optional[str]
    set_by: Optional[str]
    set_at: Optional[datetime]
    expires_at: Optional[datetime]


class BannedUserItem(BaseModel):
    user_id: uuid.UUID
    email: str
    reason: Optional[str]
    set_by: Optional[str]
    set_at: Optional[datetime]


class EmailBlacklistItem(BaseModel):
    email: str
    source_action: Optional[str]
    source_actor_email: Optional[str]
    created_at: datetime


class ModerationOverviewResponse(BaseModel):
    blocked: List[BlockedUserItem]
    banned: List[BannedUserItem]
    blacklist: List[EmailBlacklistItem]


# ---- Admin allowlist mutations (UI add/remove) ----


class AddAdminRequest(BaseModel):
    email: EmailStr


class RemoveAdminConfirm(BaseModel):
    confirm: bool = True
