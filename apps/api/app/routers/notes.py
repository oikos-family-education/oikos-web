from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional
from datetime import date

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.note import (
    NoteCreate, NoteUpdate, NoteResponse, NoteListResponse,
    NoteUpcomingCountResponse, NoteTagsResponse,
)
from app.services.note_service import NoteService
from app.services.family_service import FamilyService

router = APIRouter(prefix="/notes", tags=["notes"])


def get_note_service(db: AsyncSession = Depends(get_db)):
    return NoteService(db)


def get_family_service(db: AsyncSession = Depends(get_db)):
    return FamilyService(db)


async def _get_family_id(current_user: User, family_service: FamilyService) -> UUID:
    family = await family_service.get_family_by_account(current_user.id)
    if not family:
        raise HTTPException(status_code=400, detail="Must create a family first.")
    return family.id


@router.get("", response_model=NoteListResponse)
async def list_notes(
    status_filter: Optional[list[str]] = Query(None, alias="status"),
    entity_type: Optional[str] = None,
    entity_id: Optional[UUID] = None,
    author_user_id: Optional[UUID] = None,
    tag: Optional[list[str]] = Query(None),
    pinned: Optional[bool] = None,
    due_before: Optional[date] = None,
    overdue: bool = False,
    q: Optional[str] = None,
    sort: str = "created_at_desc",
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    service: NoteService = Depends(get_note_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.list_notes(
        family_id,
        statuses=status_filter,
        entity_type=entity_type,
        entity_id=entity_id,
        author_user_id=author_user_id,
        tags=tag,
        pinned=pinned,
        due_before=due_before,
        overdue=overdue,
        q=q,
        sort=sort,
        limit=limit,
        offset=offset,
    )


@router.get("/upcoming-count", response_model=NoteUpcomingCountResponse)
async def get_upcoming_count(
    current_user: User = Depends(get_current_user),
    service: NoteService = Depends(get_note_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    count = await service.upcoming_count(family_id)
    return {"count": count}


@router.get("/tags", response_model=NoteTagsResponse)
async def list_tags(
    current_user: User = Depends(get_current_user),
    service: NoteService = Depends(get_note_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    tags = await service.list_tags(family_id)
    return {"tags": tags}


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: UUID,
    current_user: User = Depends(get_current_user),
    service: NoteService = Depends(get_note_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.get_note(note_id, family_id)


@router.post("", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    req: NoteCreate,
    current_user: User = Depends(get_current_user),
    service: NoteService = Depends(get_note_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.create_note(family_id, current_user.id, req)


@router.patch("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: UUID,
    req: NoteUpdate,
    current_user: User = Depends(get_current_user),
    service: NoteService = Depends(get_note_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.update_note(note_id, family_id, req)


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: UUID,
    current_user: User = Depends(get_current_user),
    service: NoteService = Depends(get_note_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    await service.delete_note(note_id, family_id)
