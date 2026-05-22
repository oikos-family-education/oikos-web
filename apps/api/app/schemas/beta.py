from datetime import datetime
from typing import Optional, Literal, List
import uuid

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---- Public-facing ----


class BetaApplicationCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    reason: str = Field(..., min_length=50, max_length=1000)
    # Honeypot: must be empty. Anything filled in here = silently drop.
    website: Optional[str] = Field(default="", max_length=200)

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class BetaApplicationPublicAck(BaseModel):
    """Returned to the public form. Same shape whether new or duplicate."""

    received: bool = True
    duplicate: bool = False


class InviteTokenValidationResponse(BaseModel):
    valid: bool
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    reason: Optional[str] = None  # "expired" | "used" | "unknown" — only populated when invalid


# ---- Admin-facing ----


class BetaApplicationDetail(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    email: str
    reason: str
    status: Literal["pending", "approved", "denied"]
    internal_note: Optional[str]
    applied_at: datetime
    decided_at: Optional[datetime]
    decided_by_admin_email: Optional[str]
    invite_sent_at: Optional[datetime]
    invite_token_expires_at: Optional[datetime]
    invite_consumed_at: Optional[datetime]
    registered_user_id: Optional[uuid.UUID]

    model_config = {"from_attributes": True}


class BetaApplicationListItem(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    email: str
    reason: str
    status: Literal["pending", "approved", "denied"]
    applied_at: datetime
    decided_at: Optional[datetime]

    model_config = {"from_attributes": True}


class BetaApplicationList(BaseModel):
    items: List[BetaApplicationListItem]
    total: int
    approved_count: int
    pending_count: int
    denied_count: int
    cap: int = 50


class BetaDecisionRequest(BaseModel):
    over_cap_confirmed: bool = False
    note: Optional[str] = Field(default=None, max_length=2000)


class BetaInternalNoteUpdate(BaseModel):
    note: Optional[str] = Field(default=None, max_length=2000)


# ---- Audit log ----


class AuditLogEntry(BaseModel):
    id: uuid.UUID
    ts: datetime
    actor_email: str
    action: str
    target_type: Optional[str]
    target_id: Optional[str]
    target_email: Optional[str]
    reason: Optional[str]
    snapshot: Optional[dict]

    model_config = {"from_attributes": True}


class AuditLogList(BaseModel):
    items: List[AuditLogEntry]
    total: int


# ---- Admin allowlist ----


class AdminAllowlistEntry(BaseModel):
    id: uuid.UUID
    email: str
    added_by_admin_email: Optional[str]
    added_at: datetime
    source: Literal["env", "db"] = "db"

    model_config = {"from_attributes": True}


class AdminAllowlistAdd(BaseModel):
    email: EmailStr


# ---- Admin auth ----


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminMeResponse(BaseModel):
    email: str
    is_admin: bool = True
