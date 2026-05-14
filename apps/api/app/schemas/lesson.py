from pydantic import BaseModel, Field, field_validator
from typing import Optional, Any
from uuid import UUID
from datetime import datetime, date


VALID_LESSON_STATUSES = {
    "draft", "scheduled", "in_progress", "completed", "cancelled",
}

VALID_BLOCK_TYPES = {
    "text", "heading", "link", "resource_ref", "checklist",
    "image_url", "video_embed", "divider", "callout",
}


# ── Subject (embedded) ─────────────────────────────────────────────────────


class SubjectMinimal(BaseModel):
    """Subject info embedded in every lesson response, with derived relations."""
    id: UUID
    name: str
    color: Optional[str] = None
    icon: Optional[str] = None
    # Derived at serialisation time — never stored on the lesson row
    curriculum_ids: list[UUID] = []
    child_ids: list[UUID] = []
    project_ids: list[UUID] = []


# ── Lesson Blocks ──────────────────────────────────────────────────────────


class LessonBlockCreate(BaseModel):
    type: str
    content: dict[str, Any] = Field(default_factory=dict)
    sort_order: Optional[int] = None

    @field_validator("type")
    @classmethod
    def _check_type(cls, v: str) -> str:
        if v not in VALID_BLOCK_TYPES:
            raise ValueError(f"Invalid block type: {v}")
        return v


class LessonBlockUpdate(BaseModel):
    content: Optional[dict[str, Any]] = None
    sort_order: Optional[int] = None


class LessonBlockResponse(BaseModel):
    id: UUID
    lesson_id: UUID
    type: str
    content: dict[str, Any]
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LessonBlockReorderRequest(BaseModel):
    order: list[UUID]


# ── Lesson ─────────────────────────────────────────────────────────────────


class LessonCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    subject_id: UUID
    scheduled_for: date
    estimated_duration_minutes: Optional[int] = Field(None, ge=1, le=720)
    reference_number: Optional[str] = Field(None, max_length=64)
    objectives: list[str] = []
    tags: list[str] = []
    content_html: Optional[str] = None


class LessonUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    scheduled_for: Optional[date] = None
    estimated_duration_minutes: Optional[int] = Field(None, ge=1, le=720)
    reference_number: Optional[str] = Field(None, max_length=64)
    objectives: Optional[list[str]] = None
    tags: Optional[list[str]] = None
    content_html: Optional[str] = None


class LessonStatusUpdate(BaseModel):
    status: str
    actual_duration_minutes: Optional[int] = Field(None, ge=1, le=720)
    completion_notes: Optional[str] = None
    taught_on: Optional[date] = None
    create_teaching_log: bool = False

    @field_validator("status")
    @classmethod
    def _check_status(cls, v: str) -> str:
        if v not in VALID_LESSON_STATUSES:
            raise ValueError(f"Invalid status: {v}")
        return v


class LessonSummary(BaseModel):
    """List/today/week view — no blocks."""
    id: UUID
    title: str
    status: str
    scheduled_for: date
    estimated_duration_minutes: Optional[int] = None
    reference_number: Optional[str] = None
    sequence_number: int
    subject: SubjectMinimal
    tags: list[str] = []
    # Only populated when the list endpoint is called with
    # `include_content=true` (used by the bulk-print flow).
    content_html: Optional[str] = None

    model_config = {"from_attributes": True}


class LessonResponse(LessonSummary):
    """Detail view — with blocks and lifecycle fields."""
    objectives: list[str] = []
    actual_duration_minutes: Optional[int] = None
    completion_notes: Optional[str] = None
    taught_on: Optional[date] = None
    content_html: Optional[str] = None
    blocks: list[LessonBlockResponse] = []
    created_by_user_id: Optional[UUID] = None
    family_id: UUID
    created_at: datetime
    updated_at: datetime


class LessonListResponse(BaseModel):
    items: list[LessonSummary]
    total: int


class LessonDuplicateRequest(BaseModel):
    scheduled_for: date


# ── Link preview ───────────────────────────────────────────────────────────


class LinkPreviewResponse(BaseModel):
    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    favicon_url: Optional[str] = None
