from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime, date


# --- Teaching Log schemas ---

class TeachingLogCreate(BaseModel):
    taught_on: date
    child_id: Optional[UUID] = None
    subject_id: Optional[UUID] = None
    minutes: Optional[int] = Field(None, gt=0, le=720)
    notes: Optional[str] = Field(None, max_length=500)


class TeachingLogUpdate(BaseModel):
    minutes: Optional[int] = Field(None, gt=0, le=720)
    notes: Optional[str] = Field(None, max_length=500)


class TeachingLogResponse(BaseModel):
    id: UUID
    family_id: UUID
    taught_on: date
    child_id: Optional[UUID] = None
    subject_id: Optional[UUID] = None
    minutes: Optional[int] = None
    notes: Optional[str] = None
    logged_by_user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Summary schemas ---

class DateRange(BaseModel):
    from_: date = Field(..., alias="from")
    to: date

    model_config = {"populate_by_name": True}


class OverallStreak(BaseModel):
    current_weeks: Optional[int] = None
    longest_weeks: Optional[int] = None
    weekly_target: Optional[int] = None
    this_week_count: int = 0
    last_met_week_start: Optional[date] = None


class PerChildStreak(BaseModel):
    child_id: UUID
    first_name: str
    current_weeks: Optional[int] = None
    longest_weeks: Optional[int] = None
    weekly_target: Optional[int] = None
    this_week_count: int = 0


class PerSubjectStreak(BaseModel):
    subject_id: UUID
    name: str
    color: str
    current_weeks: Optional[int] = None
    longest_weeks: Optional[int] = None
    weekly_target: Optional[int] = None
    this_week_count: int = 0


class TeachCountByChild(BaseModel):
    child_id: UUID
    first_name: str
    count: int


class TeachCountBySubject(BaseModel):
    subject_id: UUID
    name: str
    color: str
    count: int


class TeachCounts(BaseModel):
    total: int
    by_child: list[TeachCountByChild] = []
    by_subject: list[TeachCountBySubject] = []


class HeatmapCell(BaseModel):
    date: date
    count: int


class ProgressSummaryResponse(BaseModel):
    range: DateRange
    overall_streak: OverallStreak
    per_child_streaks: list[PerChildStreak] = []
    per_subject_streaks: list[PerSubjectStreak] = []
    teach_counts: TeachCounts
    heatmap: list[HeatmapCell] = []


# --- Neglected subjects ---

class NeglectedSubjectResponse(BaseModel):
    subject_id: UUID
    subject_name: str
    color: Optional[str] = None
    days_since_last_log: Optional[int] = None
    last_taught_on: Optional[date] = None
    assigned_child_names: list[str] = []


# --- Report schemas ---

class ReportFamily(BaseModel):
    family_name: str
    shield_config: Optional[dict] = None
    location: Optional[str] = None


class ReportChild(BaseModel):
    id: UUID
    first_name: str
    grade_level: Optional[str] = None
    is_active: bool


class ReportCurriculumSubject(BaseModel):
    subject_id: UUID
    name: str
    color: str
    weekly_frequency: int
    goals_for_period: list[str] = []


class ReportCurriculum(BaseModel):
    id: UUID
    name: str
    period_type: str
    start_date: date
    end_date: date
    status: str
    subjects: list[ReportCurriculumSubject] = []
    enrolled_child_ids: list[UUID] = []


class ReportMilestoneCompletion(BaseModel):
    child_id: UUID
    completed_at: datetime


class ReportMilestone(BaseModel):
    id: UUID
    title: str
    due_date: Optional[date] = None
    completions: list[ReportMilestoneCompletion] = []


class ReportProject(BaseModel):
    id: UUID
    title: str
    status: str
    due_date: Optional[date] = None
    child_ids: list[UUID] = []
    subject_ids: list[UUID] = []
    milestones: list[ReportMilestone] = []


class ReportTeachCountBySubject(BaseModel):
    subject_id: UUID
    name: str
    count: int


class ReportTeachCountByChild(BaseModel):
    child_id: UUID
    first_name: str
    total: int
    by_subject: list[ReportTeachCountBySubject] = []


class ReportTeachCounts(BaseModel):
    range_days: int
    days_with_any_log: int
    total_entries: int
    by_child: list[ReportTeachCountByChild] = []
    by_subject: list[ReportTeachCountBySubject] = []


class ProgressReportResponse(BaseModel):
    generated_at: datetime
    range: DateRange
    family: ReportFamily
    children: list[ReportChild] = []
    curricula: list[ReportCurriculum] = []
    projects: list[ReportProject] = []
    teach_counts: ReportTeachCounts
