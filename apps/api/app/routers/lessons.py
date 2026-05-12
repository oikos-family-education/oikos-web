from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.lesson import (
    LessonBlockCreate, LessonBlockReorderRequest, LessonBlockResponse,
    LessonBlockUpdate, LessonCreate, LessonDuplicateRequest, LessonListResponse,
    LessonResponse, LessonStatusUpdate, LessonSummary, LessonUpdate,
    LinkPreviewResponse,
)
from app.services.family_service import FamilyService
from app.services.lesson_service import LessonService

router = APIRouter(prefix="/lessons", tags=["lessons"])


def get_lesson_service(db: AsyncSession = Depends(get_db)) -> LessonService:
    return LessonService(db)


def get_family_service(db: AsyncSession = Depends(get_db)) -> FamilyService:
    return FamilyService(db)


async def _get_family_id(current_user: User, family_service: FamilyService) -> UUID:
    family = await family_service.get_family_by_account(current_user.id)
    if not family:
        raise HTTPException(status_code=400, detail="Must create a family first.")
    return family.id


# ── Link preview (must come before /{lesson_id}) ──────────────────────────


@router.get("/link-preview", response_model=LinkPreviewResponse)
async def link_preview(
    url: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    service: LessonService = Depends(get_lesson_service),
):
    return await service.link_preview(url)


# ── Today / Week (also fixed paths, before /{lesson_id}) ──────────────────


@router.get("/today", response_model=list[LessonSummary])
async def list_today(
    current_user: User = Depends(get_current_user),
    service: LessonService = Depends(get_lesson_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.list_today(family_id)


@router.get("/week")
async def list_week(
    week_start: date = Query(...),
    current_user: User = Depends(get_current_user),
    service: LessonService = Depends(get_lesson_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.list_week(family_id, week_start)


# ── List / Create ─────────────────────────────────────────────────────────


@router.get("", response_model=LessonListResponse)
async def list_lessons(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    subject_id: Optional[UUID] = None,
    status: Optional[str] = None,
    child_id: Optional[UUID] = None,
    curriculum_id: Optional[UUID] = None,
    project_id: Optional[UUID] = None,
    q: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    service: LessonService = Depends(get_lesson_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.list_lessons(
        family_id,
        from_date=from_date,
        to_date=to_date,
        subject_id=subject_id,
        status=status,
        child_id=child_id,
        curriculum_id=curriculum_id,
        project_id=project_id,
        q=q,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=LessonResponse, status_code=status.HTTP_201_CREATED)
async def create_lesson(
    req: LessonCreate,
    current_user: User = Depends(get_current_user),
    service: LessonService = Depends(get_lesson_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.create_lesson(family_id, current_user.id, req)


# ── Detail / Update / Delete / Status / Duplicate ─────────────────────────


@router.get("/{lesson_id}", response_model=LessonResponse)
async def get_lesson(
    lesson_id: UUID,
    current_user: User = Depends(get_current_user),
    service: LessonService = Depends(get_lesson_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.get_lesson(lesson_id, family_id)


@router.patch("/{lesson_id}", response_model=LessonResponse)
async def update_lesson(
    lesson_id: UUID,
    req: LessonUpdate,
    current_user: User = Depends(get_current_user),
    service: LessonService = Depends(get_lesson_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.update_lesson(lesson_id, family_id, req)


@router.patch("/{lesson_id}/status", response_model=LessonResponse)
async def update_lesson_status(
    lesson_id: UUID,
    req: LessonStatusUpdate,
    current_user: User = Depends(get_current_user),
    service: LessonService = Depends(get_lesson_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.update_status(lesson_id, family_id, current_user.id, req)


@router.delete("/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lesson(
    lesson_id: UUID,
    current_user: User = Depends(get_current_user),
    service: LessonService = Depends(get_lesson_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    await service.delete_lesson(lesson_id, family_id)


@router.post("/{lesson_id}/duplicate", response_model=LessonResponse, status_code=status.HTTP_201_CREATED)
async def duplicate_lesson(
    lesson_id: UUID,
    req: LessonDuplicateRequest,
    current_user: User = Depends(get_current_user),
    service: LessonService = Depends(get_lesson_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.duplicate_lesson(
        lesson_id, family_id, current_user.id, req.scheduled_for
    )


# ── Blocks ────────────────────────────────────────────────────────────────


@router.get("/{lesson_id}/blocks", response_model=list[LessonBlockResponse])
async def list_blocks(
    lesson_id: UUID,
    current_user: User = Depends(get_current_user),
    service: LessonService = Depends(get_lesson_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.list_blocks(lesson_id, family_id)


@router.post(
    "/{lesson_id}/blocks",
    response_model=LessonBlockResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_block(
    lesson_id: UUID,
    req: LessonBlockCreate,
    current_user: User = Depends(get_current_user),
    service: LessonService = Depends(get_lesson_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.create_block(lesson_id, family_id, req)


@router.put(
    "/{lesson_id}/blocks/reorder",
    response_model=list[LessonBlockResponse],
)
async def reorder_blocks(
    lesson_id: UUID,
    req: LessonBlockReorderRequest,
    current_user: User = Depends(get_current_user),
    service: LessonService = Depends(get_lesson_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.reorder_blocks(lesson_id, family_id, req.order)


@router.patch(
    "/{lesson_id}/blocks/{block_id}",
    response_model=LessonBlockResponse,
)
async def update_block(
    lesson_id: UUID,
    block_id: UUID,
    req: LessonBlockUpdate,
    current_user: User = Depends(get_current_user),
    service: LessonService = Depends(get_lesson_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.update_block(lesson_id, block_id, family_id, req)


@router.delete(
    "/{lesson_id}/blocks/{block_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_block(
    lesson_id: UUID,
    block_id: UUID,
    current_user: User = Depends(get_current_user),
    service: LessonService = Depends(get_lesson_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    await service.delete_block(lesson_id, block_id, family_id)
