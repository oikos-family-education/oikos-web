from datetime import date, datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class HighlightCategory(str, Enum):
    SOCIAL = "social"
    BOOK = "book"
    DOCUMENTARY = "documentary"
    OUTDOOR = "outdoor"
    OTHER = "other"


class HighlightCreate(BaseModel):
    category: HighlightCategory
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    occurred_on: Optional[date] = None

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title is required")
        return v


class HighlightUpdate(BaseModel):
    category: Optional[HighlightCategory] = None
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    occurred_on: Optional[date] = None


class HighlightResponse(BaseModel):
    id: UUID
    child_id: UUID
    category: str
    title: str
    description: Optional[str] = None
    occurred_on: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Report ──────────────────────────────────────────────────────────────────

class ReportRange(BaseModel):
    from_date: date
    to_date: date


class ReportFamilyInfo(BaseModel):
    family_name: str
    shield_config: Optional[dict] = None


class ReportChildProfile(BaseModel):
    id: UUID
    first_name: str
    nickname: Optional[str] = None
    birthdate: Optional[date] = None
    birth_year: Optional[int] = None
    birth_month: Optional[int] = None
    grade_level: Optional[str] = None
    learning_styles: list[str] = []
    interests: list[str] = []
    personality_description: Optional[str] = None
    personality_tags: list[str] = []
    motivators: Optional[str] = None
    learning_differences: list[str] = []
    accommodations_notes: Optional[str] = None


class ReportResource(BaseModel):
    id: UUID
    title: str
    type: str
    author: Optional[str] = None
    progress_notes: Optional[str] = None


class ReportSubject(BaseModel):
    id: UUID
    name: str
    color: str
    icon: Optional[str] = None
    category: str
    short_description: Optional[str] = None
    learning_objectives: list[str] = []
    skills_targeted: list[str] = []
    weekly_frequency: int
    session_duration_minutes: int
    scheduled_days: list[int] = []
    goals_for_period: list[str] = []
    notes: Optional[str] = None
    taught_by: Optional[str] = None
    resources: list[ReportResource] = []
    sessions_logged: int = 0
    minutes_logged: int = 0


class ReportCurriculumDetail(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    period_type: str
    start_date: date
    end_date: date
    education_philosophy: Optional[str] = None
    overall_goals: list[str] = []
    subjects: list[ReportSubject] = []


class ReportPortfolio(BaseModel):
    title: str
    reflection: Optional[str] = None
    parent_notes: Optional[str] = None
    score: Optional[int] = None


class ReportProjectDetail(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    purpose: Optional[str] = None
    status: str
    due_date: Optional[date] = None
    completed_at: Optional[datetime] = None
    subject_names: list[str] = []
    milestones_total: int = 0
    milestones_completed: int = 0
    portfolio: Optional[ReportPortfolio] = None


class ReportRoutineEntry(BaseModel):
    day_of_week: int
    start_minute: int
    duration_minutes: int
    subject_id: Optional[UUID] = None
    subject_name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_free_time: bool
    notes: Optional[str] = None


class ReportRoutine(BaseModel):
    template_name: str
    include_saturday: bool
    include_sunday: bool
    entries: list[ReportRoutineEntry] = []


class ReportNote(BaseModel):
    id: UUID
    title: Optional[str] = None
    content: str
    tags: list[str] = []
    is_pinned: bool
    created_at: datetime


class ReportLearningSummary(BaseModel):
    total_sessions: int = 0
    total_minutes: int = 0
    days_with_sessions: int = 0


class ChildReportResponse(BaseModel):
    generated_at: datetime
    range: ReportRange
    family: ReportFamilyInfo
    child: ReportChildProfile
    curriculums: list[ReportCurriculumDetail] = []
    projects: list[ReportProjectDetail] = []
    routine: Optional[ReportRoutine] = None
    notes: list[ReportNote] = []
    highlights: list[HighlightResponse] = []
    learning_summary: ReportLearningSummary
