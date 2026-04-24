from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime, date


VALID_STATUSES = {
    "draft", "todo", "in_progress", "to_remember",
    "completed", "archived", "history_only",
}

VALID_ENTITY_TYPES = {"child", "subject", "resource", "event", "project"}


class NoteCreate(BaseModel):
    content: str = Field(..., min_length=1)
    title: Optional[str] = Field(None, max_length=255)
    status: str = "draft"
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    tags: list[str] = []
    is_pinned: bool = False
    due_date: Optional[date] = None


class NoteUpdate(BaseModel):
    content: Optional[str] = Field(None, min_length=1)
    title: Optional[str] = Field(None, max_length=255)
    status: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    tags: Optional[list[str]] = None
    is_pinned: Optional[bool] = None
    due_date: Optional[date] = None


class NoteResponse(BaseModel):
    id: UUID
    family_id: UUID
    author_user_id: Optional[UUID] = None
    author_name: Optional[str] = None
    title: Optional[str] = None
    content: str
    status: str
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    entity_label: Optional[str] = None
    tags: list[str] = []
    is_pinned: bool
    due_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NoteListResponse(BaseModel):
    items: list[NoteResponse]
    total: int


class NoteUpcomingCountResponse(BaseModel):
    count: int


class NoteTagsResponse(BaseModel):
    tags: list[str]
