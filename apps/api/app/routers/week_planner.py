from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.week_planner import (
    WeekTemplateCreate,
    WeekTemplateUpdate,
    WeekTemplateResponse,
    WeekTemplateSummary,
    RoutineEntryCreate,
    RoutineEntryUpdate,
    RoutineEntryResponse,
    RoutineEntryDuplicate,
    TodayRoutineEntryResponse,
)
from app.services.week_planner_service import WeekPlannerService
from app.services.family_service import FamilyService

router = APIRouter(prefix="/week-planner", tags=["week-planner"])


def get_planner_service(db: AsyncSession = Depends(get_db)):
    return WeekPlannerService(db)


def get_family_service(db: AsyncSession = Depends(get_db)):
    return FamilyService(db)


async def _get_family_id(current_user: User, family_service: FamilyService) -> UUID:
    family = await family_service.get_family_by_account(current_user.id)
    if not family:
        raise HTTPException(status_code=400, detail="Must create a family first.")
    return family.id


# --- Today (dashboard) ---

@router.get("/today", response_model=list[TodayRoutineEntryResponse])
async def get_today_routine(
    current_user: User = Depends(get_current_user),
    service: WeekPlannerService = Depends(get_planner_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.get_today_routine(family_id)


# --- Templates ---

@router.get("/templates", response_model=list[WeekTemplateSummary])
async def list_templates(
    current_user: User = Depends(get_current_user),
    service: WeekPlannerService = Depends(get_planner_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    templates = await service.list_templates(family_id)
    return [
        WeekTemplateSummary(
            id=t.id,
            family_id=t.family_id,
            name=t.name,
            is_active=t.is_active,
            entry_count=0,  # populated below
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        for t in templates
    ]


@router.post("/templates", response_model=WeekTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    req: WeekTemplateCreate,
    current_user: User = Depends(get_current_user),
    service: WeekPlannerService = Depends(get_planner_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.create_template(family_id, req)


@router.get("/templates/{template_id}", response_model=WeekTemplateResponse)
async def get_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    service: WeekPlannerService = Depends(get_planner_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.get_template(template_id, family_id)


@router.patch("/templates/{template_id}", response_model=WeekTemplateResponse)
async def update_template(
    template_id: UUID,
    req: WeekTemplateUpdate,
    current_user: User = Depends(get_current_user),
    service: WeekPlannerService = Depends(get_planner_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.update_template(template_id, family_id, req)


@router.post("/templates/{template_id}/activate", response_model=WeekTemplateResponse)
async def activate_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    service: WeekPlannerService = Depends(get_planner_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.activate_template(template_id, family_id)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    service: WeekPlannerService = Depends(get_planner_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    await service.delete_template(template_id, family_id)


@router.delete("/templates/{template_id}/entries", status_code=status.HTTP_204_NO_CONTENT)
async def clear_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    service: WeekPlannerService = Depends(get_planner_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    await service.clear_template_entries(template_id, family_id)


# --- Entries ---

@router.post("/templates/{template_id}/entries", response_model=RoutineEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_entry(
    template_id: UUID,
    req: RoutineEntryCreate,
    current_user: User = Depends(get_current_user),
    service: WeekPlannerService = Depends(get_planner_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.create_entry(template_id, family_id, req)


@router.patch("/entries/{entry_id}", response_model=RoutineEntryResponse)
async def update_entry(
    entry_id: UUID,
    req: RoutineEntryUpdate,
    current_user: User = Depends(get_current_user),
    service: WeekPlannerService = Depends(get_planner_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.update_entry(entry_id, family_id, req)


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: UUID,
    current_user: User = Depends(get_current_user),
    service: WeekPlannerService = Depends(get_planner_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    await service.delete_entry(entry_id, family_id)


@router.post("/entries/{entry_id}/duplicate", response_model=list[RoutineEntryResponse])
async def duplicate_entry(
    entry_id: UUID,
    req: RoutineEntryDuplicate,
    current_user: User = Depends(get_current_user),
    service: WeekPlannerService = Depends(get_planner_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.duplicate_entry(entry_id, family_id, req)
