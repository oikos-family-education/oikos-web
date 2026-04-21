from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal, Any
from uuid import UUID
from datetime import datetime


EventType = Literal["family", "subject", "project", "curriculum"]
Recurrence = Literal["none", "weekly", "monthly", "yearly"]


class CalendarEventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    event_type: EventType = "family"
    all_day: bool = False
    start_at: datetime
    end_at: datetime
    child_ids: list[UUID] = Field(default_factory=list)
    subject_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    milestone_id: Optional[UUID] = None
    color: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")
    location: Optional[str] = Field(None, max_length=255)
    recurrence: Recurrence = "none"

    @field_validator("end_at")
    @classmethod
    def end_after_start(cls, v: datetime, info: Any) -> datetime:
        start = info.data.get("start_at")
        if start and v < start:
            raise ValueError("end_at must be on or after start_at")
        return v


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    event_type: Optional[EventType] = None
    all_day: Optional[bool] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    child_ids: Optional[list[UUID]] = None
    subject_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    milestone_id: Optional[UUID] = None
    color: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")
    location: Optional[str] = Field(None, max_length=255)
    recurrence: Optional[Recurrence] = None


class CalendarEventResponse(BaseModel):
    id: UUID
    family_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    event_type: EventType
    all_day: bool
    start_at: datetime
    end_at: datetime
    child_ids: list[UUID] = []
    subject_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    milestone_id: Optional[UUID] = None
    color: Optional[str] = None
    location: Optional[str] = None
    recurrence: Recurrence = "none"
    is_system: bool = False
    source_url: Optional[str] = None

    model_config = {"from_attributes": True}


class RoutineProjectionBlock(BaseModel):
    """A single projected instance of a routine entry on a specific date."""
    entry_id: UUID
    date: datetime
    day_of_week: int
    start_minute: int
    duration_minutes: int
    subject_id: Optional[UUID] = None
    subject_name: Optional[str] = None
    is_free_time: bool = False
    child_ids: list[UUID] = []
    color: Optional[str] = None
    notes: Optional[str] = None


class CalendarQueryResponse(BaseModel):
    events: list[CalendarEventResponse]
    routine_projections: list[RoutineProjectionBlock] = []
