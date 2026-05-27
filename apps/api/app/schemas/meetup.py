"""Pydantic schemas for community meetups (v2 spec §5)."""
from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl


class Recurrence(str, Enum):
    NONE = "none"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"


class RsvpResponse(str, Enum):
    GOING = "going"
    MAYBE = "maybe"
    NOT_GOING = "not_going"


class MeetupCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=120)
    description: str = Field("", max_length=4000)
    starts_at: datetime
    duration_minutes: int = Field(60, ge=1, le=1440)
    recurrence: Recurrence = Recurrence.NONE
    recurrence_until: Optional[date] = None
    location_text: Optional[str] = Field(None, max_length=200)
    meeting_url: Optional[HttpUrl] = None


class MeetupUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=120)
    description: Optional[str] = Field(None, max_length=4000)
    starts_at: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(None, ge=1, le=1440)
    recurrence: Optional[Recurrence] = None
    recurrence_until: Optional[date] = None
    location_text: Optional[str] = Field(None, max_length=200)
    meeting_url: Optional[HttpUrl] = None


class MeetupOccurrenceRsvp(BaseModel):
    going: int = 0
    maybe: int = 0
    not_going: int = 0


class MeetupOccurrence(BaseModel):
    meetup_id: UUID
    occurrence_date: date
    starts_at: datetime
    title: str
    description: str
    duration_minutes: int
    location_text: Optional[str] = None
    meeting_url: Optional[str] = None
    created_by_family_id: UUID
    rsvp_counts: MeetupOccurrenceRsvp = MeetupOccurrenceRsvp()
    viewer_rsvp: Optional[str] = None


class MeetupOccurrenceList(BaseModel):
    items: list[MeetupOccurrence]


class MeetupDetail(BaseModel):
    id: UUID
    community_id: UUID
    created_by_family_id: UUID
    created_by_family_name: str
    title: str
    description: str
    starts_at: datetime
    duration_minutes: int
    recurrence: str
    recurrence_until: Optional[date] = None
    location_text: Optional[str] = None
    meeting_url: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RsvpRequest(BaseModel):
    occurrence_date: date
    response: RsvpResponse


class RsvpRow(BaseModel):
    family_id: UUID
    family_name: str
    family_name_slug: str
    shield_config: Optional[dict] = None
    response: str
    occurrence_date: date
