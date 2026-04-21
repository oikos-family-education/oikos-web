from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional
from datetime import datetime, time, timezone

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.calendar import (
    CalendarEventCreate,
    CalendarEventUpdate,
    CalendarEventResponse,
    CalendarQueryResponse,
)
from app.services.calendar_service import CalendarService
from app.services.family_service import FamilyService

router = APIRouter(prefix="/calendar", tags=["calendar"])


def get_calendar_service(db: AsyncSession = Depends(get_db)):
    return CalendarService(db)


def get_family_service(db: AsyncSession = Depends(get_db)):
    return FamilyService(db)


async def _get_family_id(current_user: User, family_service: FamilyService) -> UUID:
    family = await family_service.get_family_by_account(current_user.id)
    if not family:
        raise HTTPException(status_code=400, detail="Must create a family first.")
    return family.id


@router.get("/events", response_model=CalendarQueryResponse)
async def list_events(
    from_: str = Query(..., alias="from", description="ISO date, start of range (inclusive)"),
    to: str = Query(..., description="ISO date, end of range (inclusive)"),
    child_id: Optional[UUID] = Query(None),
    event_type: Optional[str] = Query(None, description="Comma-separated event types"),
    include_system: bool = Query(True),
    include_routine: bool = Query(False),
    current_user: User = Depends(get_current_user),
    service: CalendarService = Depends(get_calendar_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)

    try:
        start_date = datetime.fromisoformat(from_).date()
        end_date = datetime.fromisoformat(to).date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO date (YYYY-MM-DD).")

    range_start = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
    range_end = datetime.combine(end_date, time.max, tzinfo=timezone.utc)

    event_types: Optional[list[str]] = None
    if event_type:
        event_types = [t.strip() for t in event_type.split(",") if t.strip()]

    return await service.query_range(
        family_id=family_id,
        range_start=range_start,
        range_end=range_end,
        include_system=include_system,
        include_routine=include_routine,
        event_types=event_types,
        child_id=child_id,
    )


@router.get("/events/{event_id}", response_model=CalendarEventResponse)
async def get_event(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    service: CalendarService = Depends(get_calendar_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.get_event(event_id, family_id)


@router.post("/events", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    req: CalendarEventCreate,
    current_user: User = Depends(get_current_user),
    service: CalendarService = Depends(get_calendar_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.create_event(family_id, req)


@router.patch("/events/{event_id}", response_model=CalendarEventResponse)
async def update_event(
    event_id: UUID,
    req: CalendarEventUpdate,
    current_user: User = Depends(get_current_user),
    service: CalendarService = Depends(get_calendar_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.update_event(event_id, family_id, req)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    service: CalendarService = Depends(get_calendar_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    await service.delete_event(event_id, family_id)
