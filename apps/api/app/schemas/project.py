from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime, date


# --- Milestone schemas ---

class MilestoneCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    sort_order: int = Field(..., ge=0)
    due_date: Optional[date] = None


class MilestoneUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    sort_order: Optional[int] = Field(None, ge=0)
    due_date: Optional[date] = None


class MilestoneResponse(BaseModel):
    id: UUID
    project_id: UUID
    title: str
    description: Optional[str] = None
    sort_order: int
    due_date: Optional[date] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MilestoneCompletionResponse(BaseModel):
    id: UUID
    milestone_id: UUID
    child_id: UUID
    completed_at: datetime
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Project Subject schemas ---

class ProjectSubjectCreate(BaseModel):
    subject_id: UUID
    is_primary: bool = True


class ProjectSubjectResponse(BaseModel):
    project_id: UUID
    subject_id: UUID
    is_primary: bool

    model_config = {"from_attributes": True}


# --- Project Resource schemas ---

class ProjectResourceCreate(BaseModel):
    resource_id: UUID
    notes: Optional[str] = None


class ProjectResourceResponse(BaseModel):
    project_id: UUID
    resource_id: UUID
    added_at: datetime
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Portfolio Entry schemas ---

class PortfolioEntryUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    reflection: Optional[str] = None
    parent_notes: Optional[str] = None
    score: Optional[int] = Field(None, ge=1, le=10)


class PortfolioEntryResponse(BaseModel):
    id: UUID
    project_id: UUID
    child_id: UUID
    title: str
    reflection: Optional[str] = None
    parent_notes: Optional[str] = None
    score: Optional[int] = None
    media_urls: list[str] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Achievement schemas ---

class AchievementResponse(BaseModel):
    id: UUID
    child_id: UUID
    project_id: UUID
    awarded_at: datetime
    certificate_number: str
    acknowledged_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class RecentAchievementResponse(BaseModel):
    """Family-wide recent achievement, enriched with child name and project title for the dashboard."""
    achievement_id: UUID
    child_id: UUID
    child_name: str
    project_id: UUID
    project_title: str
    completed_at: datetime
    certificate_number: str


# --- Project schemas ---

class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    purpose: Optional[str] = None
    due_date: Optional[date] = None
    status: str = Field("draft", pattern=r"^(draft|active)$")
    child_ids: list[UUID] = Field(..., min_length=1)
    subject_ids: list[UUID] = Field(default_factory=list, max_length=2)
    milestones: Optional[list[MilestoneCreate]] = None


class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    purpose: Optional[str] = None
    due_date: Optional[date] = None
    status: Optional[str] = Field(None, pattern=r"^(draft|active|complete|archived)$")
    child_ids: Optional[list[UUID]] = None
    subject_ids: Optional[list[UUID]] = Field(None, max_length=2)


class ProjectChildResponse(BaseModel):
    project_id: UUID
    child_id: UUID
    assigned_at: datetime

    model_config = {"from_attributes": True}


class ProjectResponse(BaseModel):
    id: UUID
    family_id: UUID
    title: str
    description: Optional[str] = None
    purpose: Optional[str] = None
    due_date: Optional[date] = None
    status: str
    created_at: datetime
    updated_at: datetime
    archived_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    children: list[ProjectChildResponse] = []
    subjects: list[ProjectSubjectResponse] = []
    milestones: list[MilestoneResponse] = []
    completions: list[MilestoneCompletionResponse] = []

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    id: UUID
    family_id: UUID
    title: str
    description: Optional[str] = None
    due_date: Optional[date] = None
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None

    children: list[ProjectChildResponse] = []
    subjects: list[ProjectSubjectResponse] = []
    milestone_count: int = 0
    completions: list[MilestoneCompletionResponse] = []

    model_config = {"from_attributes": True}
