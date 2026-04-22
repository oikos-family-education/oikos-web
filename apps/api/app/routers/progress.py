from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional
from datetime import date

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.progress import (
    TeachingLogCreate,
    TeachingLogUpdate,
    TeachingLogResponse,
    ProgressSummaryResponse,
    ProgressReportResponse,
)
from app.services.progress_service import ProgressService
from app.services.family_service import FamilyService


router = APIRouter(prefix="/progress", tags=["progress"])


def get_progress_service(db: AsyncSession = Depends(get_db)):
    return ProgressService(db)


def get_family_service(db: AsyncSession = Depends(get_db)):
    return FamilyService(db)


async def _get_family_id(current_user: User, family_service: FamilyService) -> UUID:
    family = await family_service.get_family_by_account(current_user.id)
    if not family:
        raise HTTPException(status_code=400, detail="Must create a family first.")
    return family.id


# ── Teaching logs ──

@router.post("/logs", response_model=TeachingLogResponse, status_code=status.HTTP_201_CREATED)
async def create_log(
    req: TeachingLogCreate,
    current_user: User = Depends(get_current_user),
    service: ProgressService = Depends(get_progress_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.create_log(family_id, current_user.id, req)


@router.get("/logs", response_model=list[TeachingLogResponse])
async def list_logs(
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = Query(None),
    child_id: Optional[UUID] = Query(None),
    subject_id: Optional[UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    service: ProgressService = Depends(get_progress_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.list_logs(family_id, from_date=from_, to_date=to, child_id=child_id, subject_id=subject_id)


@router.patch("/logs/{log_id}", response_model=TeachingLogResponse)
async def update_log(
    log_id: UUID,
    req: TeachingLogUpdate,
    current_user: User = Depends(get_current_user),
    service: ProgressService = Depends(get_progress_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.update_log(log_id, family_id, req)


@router.delete("/logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_log(
    log_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ProgressService = Depends(get_progress_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    await service.delete_log(log_id, family_id)


# ── Summary ──

@router.get("/summary", response_model=ProgressSummaryResponse)
async def get_summary(
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = Query(None),
    child_id: Optional[UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    service: ProgressService = Depends(get_progress_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.get_summary(family_id, from_date=from_, to_date=to, child_filter_id=child_id)


# ── Report ──

@router.get("/report", response_model=ProgressReportResponse)
async def get_report(
    from_: date = Query(..., alias="from"),
    to: date = Query(...),
    child_id: Optional[UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    service: ProgressService = Depends(get_progress_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.get_report(family_id, from_date=from_, to_date=to, child_filter_id=child_id)
