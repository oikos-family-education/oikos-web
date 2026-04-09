from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.family import FamilyCreate, FamilyResponse, ShieldConfig
from app.schemas.child import ChildCreate, ChildUpdate, ChildResponse
from app.services.family_service import FamilyService

router = APIRouter(prefix="/families", tags=["families"])

def get_family_service(db: AsyncSession = Depends(get_db)):
    return FamilyService(db)

@router.post("", response_model=FamilyResponse, status_code=status.HTTP_201_CREATED)
async def create_family(
    req: FamilyCreate,
    current_user: User = Depends(get_current_user),
    service: FamilyService = Depends(get_family_service)
):
    return await service.create_family(current_user.id, req)

@router.get("/me", response_model=FamilyResponse)
async def get_my_family(
    current_user: User = Depends(get_current_user),
    service: FamilyService = Depends(get_family_service)
):
    family = await service.get_family_by_account(current_user.id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not configured yet.")
    return family

@router.patch("/me/shield", response_model=FamilyResponse)
async def update_shield(
    req: ShieldConfig,
    current_user: User = Depends(get_current_user),
    service: FamilyService = Depends(get_family_service)
):
    return await service.update_shield(current_user.id, req.model_dump())

@router.post("/me/children", response_model=ChildResponse, status_code=status.HTTP_201_CREATED)
async def add_child(
    req: ChildCreate,
    current_user: User = Depends(get_current_user),
    service: FamilyService = Depends(get_family_service)
):
    family = await service.get_family_by_account(current_user.id)
    if not family:
        raise HTTPException(status_code=400, detail="Must create a family first before adding children.")
    return await service.add_child(family.id, req)

@router.get("/me/children", response_model=list[ChildResponse])
async def get_children(
    include_archived: bool = Query(False),
    current_user: User = Depends(get_current_user),
    service: FamilyService = Depends(get_family_service),
):
    family = await service.get_family_by_account(current_user.id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not configured yet.")
    return await service.get_children(family.id, include_archived=include_archived)


@router.get("/me/children/{child_id}", response_model=ChildResponse)
async def get_child(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    service: FamilyService = Depends(get_family_service),
):
    family = await service.get_family_by_account(current_user.id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not configured yet.")
    return await service.get_child(child_id, family.id)


@router.patch("/me/children/{child_id}", response_model=ChildResponse)
async def update_child(
    child_id: UUID,
    req: ChildUpdate,
    current_user: User = Depends(get_current_user),
    service: FamilyService = Depends(get_family_service),
):
    family = await service.get_family_by_account(current_user.id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not configured yet.")
    return await service.update_child(child_id, family.id, req)


@router.post("/me/children/{child_id}/archive", response_model=ChildResponse)
async def archive_child(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    service: FamilyService = Depends(get_family_service),
):
    family = await service.get_family_by_account(current_user.id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not configured yet.")
    return await service.archive_child(child_id, family.id)


@router.post("/me/children/{child_id}/unarchive", response_model=ChildResponse)
async def unarchive_child(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    service: FamilyService = Depends(get_family_service),
):
    family = await service.get_family_by_account(current_user.id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not configured yet.")
    return await service.unarchive_child(child_id, family.id)
