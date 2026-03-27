from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime
from enum import Enum


class ResourceType(str, Enum):
    BOOK = "book"
    ARTICLE = "article"
    VIDEO = "video"
    COURSE = "course"
    PODCAST = "podcast"
    DOCUMENTARY = "documentary"
    PRINTABLE = "printable"
    WEBSITE = "website"
    CURRICULUM = "curriculum"
    OTHER = "other"


class SubjectResourceLink(BaseModel):
    subject_id: UUID
    progress_notes: Optional[str] = Field(None, max_length=500)


class ResourceCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    type: ResourceType
    author: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    url: Optional[str] = None
    subject_ids: list[UUID] = Field(default_factory=list)


class ResourceUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    type: Optional[ResourceType] = None
    author: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    url: Optional[str] = None
    subject_ids: Optional[list[UUID]] = None


class SubjectResourceResponse(BaseModel):
    subject_id: UUID
    subject_name: str
    progress_notes: Optional[str] = None
    updated_at: datetime


class ResourceResponse(BaseModel):
    id: UUID
    family_id: UUID
    title: str
    type: str
    author: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None
    subjects: list[SubjectResourceResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProgressUpdate(BaseModel):
    progress_notes: Optional[str] = Field(None, max_length=500)
