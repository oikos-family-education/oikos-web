from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.curriculum import (
    CurriculumCreate, CurriculumUpdate, CurriculumResponse, CurriculumListResponse,
    CurriculumStatusUpdate, CurriculumSubjectCreate, CurriculumSubjectUpdate,
    CurriculumSubjectResponse, ChildCurriculumCreate, ChildCurriculumResponse,
)
from app.services.curriculum_service import CurriculumService
from app.services.family_service import FamilyService

router = APIRouter(prefix="/curriculums", tags=["curriculums"])


def get_curriculum_service(db: AsyncSession = Depends(get_db)):
    return CurriculumService(db)


def get_family_service(db: AsyncSession = Depends(get_db)):
    return FamilyService(db)


async def _get_family_id(current_user: User, family_service: FamilyService) -> UUID:
    family = await family_service.get_family_by_account(current_user.id)
    if not family:
        raise HTTPException(status_code=400, detail="Must create a family first.")
    return family.id


@router.get("", response_model=list[CurriculumListResponse])
async def list_curriculums(
    current_user: User = Depends(get_current_user),
    service: CurriculumService = Depends(get_curriculum_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.list_curriculums(family_id)


@router.get("/templates", response_model=list[CurriculumListResponse])
async def list_templates(
    current_user: User = Depends(get_current_user),
    service: CurriculumService = Depends(get_curriculum_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.list_templates(family_id)


@router.get("/{curriculum_id}", response_model=CurriculumResponse)
async def get_curriculum(
    curriculum_id: UUID,
    current_user: User = Depends(get_current_user),
    service: CurriculumService = Depends(get_curriculum_service),
):
    curriculum = await service.get_curriculum(curriculum_id)
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found.")
    return curriculum


@router.post("", response_model=CurriculumResponse, status_code=status.HTTP_201_CREATED)
async def create_curriculum(
    req: CurriculumCreate,
    current_user: User = Depends(get_current_user),
    service: CurriculumService = Depends(get_curriculum_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.create_curriculum(family_id, current_user.id, req)


@router.patch("/{curriculum_id}", response_model=CurriculumResponse)
async def update_curriculum(
    curriculum_id: UUID,
    req: CurriculumUpdate,
    current_user: User = Depends(get_current_user),
    service: CurriculumService = Depends(get_curriculum_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.update_curriculum(curriculum_id, family_id, req)


@router.patch("/{curriculum_id}/status", response_model=CurriculumResponse)
async def update_curriculum_status(
    curriculum_id: UUID,
    req: CurriculumStatusUpdate,
    current_user: User = Depends(get_current_user),
    service: CurriculumService = Depends(get_curriculum_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.update_status(curriculum_id, family_id, req.status.value)


@router.delete("/{curriculum_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_curriculum(
    curriculum_id: UUID,
    current_user: User = Depends(get_current_user),
    service: CurriculumService = Depends(get_curriculum_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    await service.delete_curriculum(curriculum_id, family_id)


@router.post("/{curriculum_id}/apply-template", response_model=CurriculumResponse, status_code=status.HTTP_201_CREATED)
async def apply_template(
    curriculum_id: UUID,
    current_user: User = Depends(get_current_user),
    service: CurriculumService = Depends(get_curriculum_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.apply_template(curriculum_id, family_id, current_user.id)


# --- Curriculum Subject endpoints ---

@router.post("/{curriculum_id}/subjects", response_model=CurriculumSubjectResponse, status_code=status.HTTP_201_CREATED)
async def add_subject_to_curriculum(
    curriculum_id: UUID,
    req: CurriculumSubjectCreate,
    current_user: User = Depends(get_current_user),
    service: CurriculumService = Depends(get_curriculum_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.add_subject_to_curriculum(curriculum_id, family_id, req)


@router.patch("/subjects/{curriculum_subject_id}", response_model=CurriculumSubjectResponse)
async def update_curriculum_subject(
    curriculum_subject_id: UUID,
    req: CurriculumSubjectUpdate,
    current_user: User = Depends(get_current_user),
    service: CurriculumService = Depends(get_curriculum_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.update_curriculum_subject(curriculum_subject_id, family_id, req)


@router.delete("/subjects/{curriculum_subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_subject_from_curriculum(
    curriculum_subject_id: UUID,
    current_user: User = Depends(get_current_user),
    service: CurriculumService = Depends(get_curriculum_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    await service.remove_subject_from_curriculum(curriculum_subject_id, family_id)


# --- Child assignment endpoints ---

@router.post("/{curriculum_id}/children", response_model=ChildCurriculumResponse, status_code=status.HTTP_201_CREATED)
async def assign_child(
    curriculum_id: UUID,
    req: ChildCurriculumCreate,
    current_user: User = Depends(get_current_user),
    service: CurriculumService = Depends(get_curriculum_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.assign_child(curriculum_id, req.child_id, family_id)


@router.delete("/{curriculum_id}/children/{child_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unassign_child(
    curriculum_id: UUID,
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    service: CurriculumService = Depends(get_curriculum_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    await service.unassign_child(curriculum_id, child_id, family_id)
