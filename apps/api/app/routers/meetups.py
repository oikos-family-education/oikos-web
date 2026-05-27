"""Community meetups router (v2 spec §11.3)."""
from __future__ import annotations

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.meetup import (
    MeetupCreate,
    MeetupDetail,
    MeetupOccurrenceList,
    MeetupUpdate,
    RsvpRequest,
)
from app.services.meetup_service import MeetupService


router = APIRouter(tags=["meetups"])


def get_service(db: AsyncSession = Depends(get_db)) -> MeetupService:
    return MeetupService(db)


@router.get(
    "/communities/{slug}/meetups",
    response_model=MeetupOccurrenceList,
)
async def list_meetups(
    slug: str,
    window_from: Optional[date] = Query(None),
    window_to: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    svc: MeetupService = Depends(get_service),
):
    items = await svc.list_occurrences(current_user.id, slug, window_from, window_to)
    return {"items": items}


@router.post(
    "/communities/{slug}/meetups",
    response_model=MeetupDetail,
    status_code=status.HTTP_201_CREATED,
)
async def create_meetup(
    slug: str,
    data: MeetupCreate,
    current_user: User = Depends(get_current_user),
    svc: MeetupService = Depends(get_service),
):
    m = await svc.create_meetup(current_user.id, slug, data)
    return MeetupDetail(
        id=m.id,
        community_id=m.community_id,
        created_by_family_id=m.created_by_family_id,
        created_by_family_name="",
        title=m.title,
        description=m.description,
        starts_at=m.starts_at,
        duration_minutes=m.duration_minutes,
        recurrence=m.recurrence,
        recurrence_until=m.recurrence_until.date() if m.recurrence_until else None,
        location_text=m.location_text,
        meeting_url=m.meeting_url,
        cancelled_at=m.cancelled_at,
        created_at=m.created_at,
    )


@router.get(
    "/communities/{slug}/meetups/{meetup_id}",
    response_model=MeetupDetail,
)
async def get_meetup(
    slug: str,
    meetup_id: UUID,
    current_user: User = Depends(get_current_user),
    svc: MeetupService = Depends(get_service),
):
    m, family_name = await svc.meetup_detail(current_user.id, slug, meetup_id)
    return MeetupDetail(
        id=m.id,
        community_id=m.community_id,
        created_by_family_id=m.created_by_family_id,
        created_by_family_name=family_name,
        title=m.title,
        description=m.description,
        starts_at=m.starts_at,
        duration_minutes=m.duration_minutes,
        recurrence=m.recurrence,
        recurrence_until=m.recurrence_until.date() if m.recurrence_until else None,
        location_text=m.location_text,
        meeting_url=m.meeting_url,
        cancelled_at=m.cancelled_at,
        created_at=m.created_at,
    )


@router.patch(
    "/communities/{slug}/meetups/{meetup_id}",
    response_model=MeetupDetail,
)
async def update_meetup(
    slug: str,
    meetup_id: UUID,
    data: MeetupUpdate,
    current_user: User = Depends(get_current_user),
    svc: MeetupService = Depends(get_service),
):
    m = await svc.update_meetup(current_user.id, slug, meetup_id, data)
    return MeetupDetail(
        id=m.id,
        community_id=m.community_id,
        created_by_family_id=m.created_by_family_id,
        created_by_family_name="",
        title=m.title,
        description=m.description,
        starts_at=m.starts_at,
        duration_minutes=m.duration_minutes,
        recurrence=m.recurrence,
        recurrence_until=m.recurrence_until.date() if m.recurrence_until else None,
        location_text=m.location_text,
        meeting_url=m.meeting_url,
        cancelled_at=m.cancelled_at,
        created_at=m.created_at,
    )


@router.post(
    "/communities/{slug}/meetups/{meetup_id}/cancel",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def cancel_meetup(
    slug: str,
    meetup_id: UUID,
    current_user: User = Depends(get_current_user),
    svc: MeetupService = Depends(get_service),
):
    await svc.cancel_meetup(current_user.id, slug, meetup_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/communities/{slug}/meetups/{meetup_id}/rsvp")
async def rsvp_meetup(
    slug: str,
    meetup_id: UUID,
    data: RsvpRequest,
    current_user: User = Depends(get_current_user),
    svc: MeetupService = Depends(get_service),
):
    row = await svc.rsvp(
        current_user.id, slug, meetup_id, data.occurrence_date, data.response,
    )
    return {"response": row.response, "occurrence_date": row.occurrence_date.date().isoformat()}
