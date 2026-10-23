from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.child_report import (
    ChildReportResponse,
    HighlightCreate,
    HighlightResponse,
    HighlightUpdate,
)
from app.services.child_report_service import ChildReportService
from app.services.family_service import FamilyService

router = APIRouter(prefix="/children", tags=["child-reports"])


def get_child_report_service(db: AsyncSession = Depends(get_db)):
    return ChildReportService(db)


def get_family_service(db: AsyncSession = Depends(get_db)):
    return FamilyService(db)


async def _get_family_id(current_user: User, family_service: FamilyService) -> UUID:
    family = await family_service.get_family_by_account(current_user.id)
    if not family:
        raise HTTPException(status_code=400, detail="Must create a family first.")
    return family.id


# ── Highlights ──

@router.get("/{child_id}/highlights", response_model=list[HighlightResponse])
async def list_highlights(
    child_id: UUID,
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    service: ChildReportService = Depends(get_child_report_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.list_highlights(child_id, family_id, from_, to)


@router.post("/{child_id}/highlights", response_model=HighlightResponse, status_code=status.HTTP_201_CREATED)
async def create_highlight(
    child_id: UUID,
    req: HighlightCreate,
    current_user: User = Depends(get_current_user),
    service: ChildReportService = Depends(get_child_report_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.create_highlight(child_id, family_id, req)


@router.patch("/{child_id}/highlights/{highlight_id}", response_model=HighlightResponse)
async def update_highlight(
    child_id: UUID,
    highlight_id: UUID,
    req: HighlightUpdate,
    current_user: User = Depends(get_current_user),
    service: ChildReportService = Depends(get_child_report_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.update_highlight(child_id, highlight_id, family_id, req)


@router.delete("/{child_id}/highlights/{highlight_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_highlight(
    child_id: UUID,
    highlight_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ChildReportService = Depends(get_child_report_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    await service.delete_highlight(child_id, highlight_id, family_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Report ──

@router.get("/{child_id}/report", response_model=ChildReportResponse)
async def get_child_report(
    child_id: UUID,
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    service: ChildReportService = Depends(get_child_report_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.get_report(child_id, family_id, from_, to)
