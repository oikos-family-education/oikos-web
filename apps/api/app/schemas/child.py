from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import date, datetime


class ChildCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=60)
    nickname: Optional[str] = Field(None, max_length=40)
    gender: Optional[str] = None
    birthdate: Optional[date] = None
    birth_year: Optional[int] = Field(None, ge=1990, le=2030)
    birth_month: Optional[int] = Field(None, ge=1, le=12)
    grade_level: Optional[str] = None
    child_curriculum: list[str] = Field(default_factory=list)
    learning_styles: list[str] = Field(default_factory=list)
    personality_description: Optional[str] = Field(None, max_length=1000)
    personality_tags: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)
    motivators: Optional[str] = Field(None, max_length=200)
    demotivators: Optional[str] = Field(None, max_length=200)
    learning_differences: list[str] = Field(default_factory=list)
    accommodations_notes: Optional[str] = Field(None, max_length=500)
    support_services: list[str] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class ChildUpdate(ChildCreate):
    first_name: Optional[str] = Field(None, min_length=1, max_length=60)


class ChildResponse(BaseModel):
    id: UUID
    family_id: UUID
    first_name: str
    nickname: Optional[str] = None
    gender: Optional[str] = None
    birthdate: Optional[date] = None
    birth_year: Optional[int] = None
    grade_level: Optional[str] = None
    learning_styles: list[str] = []
    personality_tags: list[str] = []
    interests: list[str] = []
    is_active: bool = True
    created_at: datetime

    model_config = {"from_attributes": True}
