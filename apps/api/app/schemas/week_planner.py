from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


# --- RoutineEntry ---

class RoutineEntryCreate(BaseModel):
    subject_id: Optional[UUID] = None
    is_free_time: bool = False
    child_ids: list[UUID] = Field(default_factory=list)
    day_of_week: int = Field(ge=0, le=6)
    start_minute: int = Field(ge=360, le=1320)  # 06:00 to 22:00
    duration_minutes: int = Field(ge=15, le=300, default=45)
    priority: str = Field(default="medium", pattern="^(high|medium|low)$")
    color: Optional[str] = None
    notes: Optional[str] = None


class RoutineEntryUpdate(BaseModel):
    day_of_week: Optional[int] = Field(default=None, ge=0, le=6)
    start_minute: Optional[int] = Field(default=None, ge=360, le=1320)
    duration_minutes: Optional[int] = Field(default=None, ge=15, le=300)
    priority: Optional[str] = Field(default=None, pattern="^(high|medium|low)$")
    color: Optional[str] = None
    notes: Optional[str] = None


class RoutineEntryResponse(BaseModel):
    id: UUID
    template_id: UUID
    family_id: UUID
    subject_id: Optional[UUID] = None
    is_free_time: bool
    child_ids: list[UUID]
    day_of_week: int
    start_minute: int
    duration_minutes: int
    priority: str
    color: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RoutineEntryDuplicate(BaseModel):
    target_days: list[int] = Field(min_length=1)  # list of day_of_week values


# --- WeekTemplate ---

class WeekTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    is_active: bool = False


class WeekTemplateUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)


class WeekTemplateResponse(BaseModel):
    id: UUID
    family_id: UUID
    name: str
    is_active: bool
    entries: list[RoutineEntryResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WeekTemplateSummary(BaseModel):
    id: UUID
    family_id: UUID
    name: str
    is_active: bool
    entry_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TodayRoutineEntryResponse(BaseModel):
    """Routine entry for today, enriched with subject and child names for the dashboard."""
    id: UUID
    subject_id: Optional[UUID] = None
    subject_name: Optional[str] = None
    is_free_time: bool
    child_ids: list[UUID]
    child_names: list[str]
    day_of_week: int
    start_minute: int
    duration_minutes: int
    priority: str
    color: Optional[str] = None
    notes: Optional[str] = None
