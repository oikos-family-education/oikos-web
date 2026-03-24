from pydantic import BaseModel, Field, model_validator
from typing import Optional
from uuid import UUID
from datetime import date, datetime
from enum import Enum


class CurriculumPeriodType(str, Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    SEMESTER = "semester"
    ANNUAL = "annual"
    CUSTOM = "custom"


class CurriculumStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"
    TEMPLATE = "template"


class TimeSlotPreference(str, Enum):
    MORNING_FIRST = "morning_first"
    MORNING = "morning"
    MIDDAY = "midday"
    AFTERNOON = "afternoon"
    FLEXIBLE = "flexible"


# --- Curriculum Subject schemas ---

class CurriculumSubjectCreate(BaseModel):
    subject_id: UUID
    weekly_frequency: int = Field(5, ge=1, le=7)
    session_duration_minutes: int = Field(45, ge=5, le=480)
    scheduled_days: list[int] = Field(default_factory=list)
    preferred_time_slot: TimeSlotPreference = TimeSlotPreference.FLEXIBLE
    goals_for_period: list[str] = Field(default_factory=list)
    sort_order: int = 0
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_scheduled_days(self):
        if self.scheduled_days and len(self.scheduled_days) != self.weekly_frequency:
            raise ValueError("scheduled_days length must equal weekly_frequency")
        for d in self.scheduled_days:
            if d < 0 or d > 6:
                raise ValueError("scheduled_days values must be 0-6 (Mon-Sun)")
        return self


class CurriculumSubjectUpdate(BaseModel):
    weekly_frequency: Optional[int] = Field(None, ge=1, le=7)
    session_duration_minutes: Optional[int] = Field(None, ge=5, le=480)
    scheduled_days: Optional[list[int]] = None
    preferred_time_slot: Optional[TimeSlotPreference] = None
    goals_for_period: Optional[list[str]] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class CurriculumSubjectResponse(BaseModel):
    id: UUID
    curriculum_id: UUID
    subject_id: UUID
    weekly_frequency: int
    session_duration_minutes: int
    scheduled_days: list[int] = []
    preferred_time_slot: str
    goals_for_period: list[str] = []
    sort_order: int
    is_active: bool
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Child Curriculum schemas ---

class ChildCurriculumCreate(BaseModel):
    child_id: UUID


class ChildCurriculumResponse(BaseModel):
    id: UUID
    child_id: UUID
    curriculum_id: UUID
    joined_at: datetime

    model_config = {"from_attributes": True}


# --- Curriculum schemas ---

class CurriculumCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    period_type: CurriculumPeriodType
    start_date: date
    end_date: date
    academic_year: Optional[str] = Field(None, max_length=20)
    term_name: Optional[str] = Field(None, max_length=100)
    education_philosophy: Optional[str] = Field(None, max_length=200)
    overall_goals: list[str] = Field(default_factory=list)
    notes: Optional[str] = None
    subjects: list[CurriculumSubjectCreate] = Field(default_factory=list)
    child_ids: list[UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self


class CurriculumUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    period_type: Optional[CurriculumPeriodType] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    academic_year: Optional[str] = Field(None, max_length=20)
    term_name: Optional[str] = Field(None, max_length=100)
    education_philosophy: Optional[str] = Field(None, max_length=200)
    overall_goals: Optional[list[str]] = None
    notes: Optional[str] = None


class CurriculumStatusUpdate(BaseModel):
    status: CurriculumStatus


class CurriculumResponse(BaseModel):
    id: UUID
    family_id: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    period_type: str
    start_date: date
    end_date: date
    academic_year: Optional[str] = None
    term_name: Optional[str] = None
    education_philosophy: Optional[str] = None
    status: str
    overall_goals: list[str] = []
    notes: Optional[str] = None
    created_by_user_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    curriculum_subjects: list[CurriculumSubjectResponse] = []
    child_curriculums: list[ChildCurriculumResponse] = []

    model_config = {"from_attributes": True}


class CurriculumListResponse(BaseModel):
    id: UUID
    family_id: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    period_type: str
    start_date: date
    end_date: date
    academic_year: Optional[str] = None
    status: str
    education_philosophy: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
