from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime
from enum import Enum


class SubjectCategory(str, Enum):
    CORE_ACADEMIC = "core_academic"
    LANGUAGE = "language"
    SCRIPTURE_THEOLOGY = "scripture_theology"
    ARTS = "arts"
    PHYSICAL = "physical"
    PRACTICAL_LIFE = "practical_life"
    LOGIC_RHETORIC = "logic_rhetoric"
    TECHNOLOGY = "technology"
    ELECTIVE = "elective"
    CO_OP = "co_op"
    OTHER = "other"


class SubjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    short_description: Optional[str] = Field(None, max_length=500)
    long_description: Optional[str] = None
    category: SubjectCategory
    color: str = Field("#6366F1", pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = Field(None, max_length=50)
    min_age_years: Optional[int] = Field(None, ge=0, le=25)
    max_age_years: Optional[int] = Field(None, ge=0, le=25)
    min_grade_level: Optional[int] = Field(None, ge=0, le=12)
    max_grade_level: Optional[int] = Field(None, ge=0, le=12)
    default_session_duration_minutes: int = Field(45, ge=5, le=480)
    default_weekly_frequency: int = Field(5, ge=1, le=7)
    learning_objectives: list[str] = Field(default_factory=list)
    skills_targeted: list[str] = Field(default_factory=list)
    prerequisite_subject_ids: list[UUID] = Field(default_factory=list)
    is_public: bool = False


class SubjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    short_description: Optional[str] = Field(None, max_length=500)
    long_description: Optional[str] = None
    category: Optional[SubjectCategory] = None
    color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = Field(None, max_length=50)
    min_age_years: Optional[int] = Field(None, ge=0, le=25)
    max_age_years: Optional[int] = Field(None, ge=0, le=25)
    min_grade_level: Optional[int] = Field(None, ge=0, le=12)
    max_grade_level: Optional[int] = Field(None, ge=0, le=12)
    default_session_duration_minutes: Optional[int] = Field(None, ge=5, le=480)
    default_weekly_frequency: Optional[int] = Field(None, ge=1, le=7)
    learning_objectives: Optional[list[str]] = None
    skills_targeted: Optional[list[str]] = None
    prerequisite_subject_ids: Optional[list[UUID]] = None
    is_public: Optional[bool] = None


class SubjectResponse(BaseModel):
    id: UUID
    family_id: Optional[UUID] = None
    name: str
    slug: str
    short_description: Optional[str] = None
    long_description: Optional[str] = None
    category: str
    color: str
    icon: Optional[str] = None
    min_age_years: Optional[int] = None
    max_age_years: Optional[int] = None
    min_grade_level: Optional[int] = None
    max_grade_level: Optional[int] = None
    default_session_duration_minutes: int
    default_weekly_frequency: int
    learning_objectives: list[str] = []
    skills_targeted: list[str] = []
    prerequisite_subject_ids: list[UUID] = []
    is_platform_subject: bool
    is_public: bool
    created_by_user_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
