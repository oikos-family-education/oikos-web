from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.resource import ResourceCreate, ResourceUpdate, ResourceResponse, ProgressUpdate
from app.services.resource_service import ResourceService
from app.services.family_service import FamilyService

router = APIRouter(prefix="/resources", tags=["resources"])


def get_resource_service(db: AsyncSession = Depends(get_db)):
    return ResourceService(db)


def get_family_service(db: AsyncSession = Depends(get_db)):
    return FamilyService(db)


async def _get_family_id(current_user: User, family_service: FamilyService) -> UUID:
    family = await family_service.get_family_by_account(current_user.id)
    if not family:
        raise HTTPException(status_code=400, detail="Must create a family first.")
    return family.id


@router.get("", response_model=list[ResourceResponse])
async def list_resources(
    type: Optional[str] = None,
    subject_id: Optional[UUID] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    service: ResourceService = Depends(get_resource_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.list_resources(family_id, resource_type=type, subject_id=subject_id, search=search)


@router.get("/{resource_id}", response_model=ResourceResponse)
async def get_resource(
    resource_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ResourceService = Depends(get_resource_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.get_resource(resource_id, family_id)


@router.post("", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
async def create_resource(
    req: ResourceCreate,
    current_user: User = Depends(get_current_user),
    service: ResourceService = Depends(get_resource_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.create_resource(family_id, req)


@router.patch("/{resource_id}", response_model=ResourceResponse)
async def update_resource(
    resource_id: UUID,
    req: ResourceUpdate,
    current_user: User = Depends(get_current_user),
    service: ResourceService = Depends(get_resource_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.update_resource(resource_id, family_id, req)


@router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resource(
    resource_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ResourceService = Depends(get_resource_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    await service.delete_resource(resource_id, family_id)


@router.patch("/{resource_id}/subjects/{subject_id}/progress")
async def update_progress(
    resource_id: UUID,
    subject_id: UUID,
    req: ProgressUpdate,
    current_user: User = Depends(get_current_user),
    service: ResourceService = Depends(get_resource_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.update_progress(resource_id, subject_id, family_id, req.progress_notes)


@router.get("/subject/{subject_id}", response_model=list)
async def list_resources_for_subject(
    subject_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ResourceService = Depends(get_resource_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.list_resources_for_subject(subject_id, family_id)


@router.post("/{resource_id}/subjects/{subject_id}", status_code=status.HTTP_201_CREATED)
async def add_resource_to_subject(
    resource_id: UUID,
    subject_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ResourceService = Depends(get_resource_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    await service.add_resource_to_subject(resource_id, subject_id, family_id)
    return {"status": "linked"}


@router.delete("/{resource_id}/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_resource_from_subject(
    resource_id: UUID,
    subject_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ResourceService = Depends(get_resource_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    await service.remove_resource_from_subject(resource_id, subject_id, family_id)
