from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.subject import SubjectCreate, SubjectUpdate, SubjectResponse
from app.services.subject_service import SubjectService
from app.services.family_service import FamilyService

router = APIRouter(prefix="/subjects", tags=["subjects"])


def get_subject_service(db: AsyncSession = Depends(get_db)):
    return SubjectService(db)


def get_family_service(db: AsyncSession = Depends(get_db)):
    return FamilyService(db)


async def _get_family_id(current_user: User, family_service: FamilyService) -> UUID:
    family = await family_service.get_family_by_account(current_user.id)
    if not family:
        raise HTTPException(status_code=400, detail="Must create a family first.")
    return family.id


@router.get("", response_model=list[SubjectResponse])
async def list_subjects(
    source: Optional[str] = Query(None, pattern="^(mine|platform|community)$"),
    category: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    service: SubjectService = Depends(get_subject_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.list_subjects(family_id, source=source, category=category, search=search)


@router.get("/{subject_id}", response_model=SubjectResponse)
async def get_subject(
    subject_id: UUID,
    current_user: User = Depends(get_current_user),
    service: SubjectService = Depends(get_subject_service),
):
    subject = await service.get_subject(subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")
    return subject


@router.post("", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
async def create_subject(
    req: SubjectCreate,
    current_user: User = Depends(get_current_user),
    service: SubjectService = Depends(get_subject_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.create_subject(family_id, current_user.id, req)


@router.patch("/{subject_id}", response_model=SubjectResponse)
async def update_subject(
    subject_id: UUID,
    req: SubjectUpdate,
    current_user: User = Depends(get_current_user),
    service: SubjectService = Depends(get_subject_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.update_subject(subject_id, family_id, req)


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(
    subject_id: UUID,
    current_user: User = Depends(get_current_user),
    service: SubjectService = Depends(get_subject_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    await service.delete_subject(subject_id, family_id)


@router.post("/{subject_id}/fork", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
async def fork_subject(
    subject_id: UUID,
    current_user: User = Depends(get_current_user),
    service: SubjectService = Depends(get_subject_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.fork_subject(subject_id, family_id, current_user.id)
