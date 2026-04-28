from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListResponse,
    MilestoneCreate, MilestoneUpdate, MilestoneResponse, MilestoneCompletionResponse,
    ProjectResourceCreate, ProjectResourceResponse,
    PortfolioEntryUpdate, PortfolioEntryResponse,
    AchievementResponse, RecentAchievementResponse,
)
from app.services.project_service import ProjectService
from app.services.family_service import FamilyService

router = APIRouter(prefix="/projects", tags=["projects"])


def get_project_service(db: AsyncSession = Depends(get_db)):
    return ProjectService(db)


def get_family_service(db: AsyncSession = Depends(get_db)):
    return FamilyService(db)


async def _get_family_id(current_user: User, family_service: FamilyService) -> UUID:
    family = await family_service.get_family_by_account(current_user.id)
    if not family:
        raise HTTPException(status_code=400, detail="Must create a family first.")
    return family.id


# ── Project CRUD ──

@router.get("", response_model=list[ProjectListResponse])
async def list_projects(
    status_filter: Optional[str] = Query(None, alias="status", pattern="^(draft|active|complete|archived)$"),
    child_id: Optional[UUID] = None,
    subject_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.list_projects(family_id, status=status_filter, child_id=child_id, subject_id=subject_id)


# Static-prefix routes (must come before /{project_id} so FastAPI doesn't try to coerce
# the path segment into a UUID).

@router.get("/achievements", response_model=list[RecentAchievementResponse])
async def list_recent_achievements(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.list_recent_achievements(family_id, limit=limit)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.get_project(project_id, family_id)


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    req: ProjectCreate,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.create_project(family_id, req)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    req: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.update_project(project_id, family_id, req)


@router.post("/{project_id}/complete", response_model=ProjectResponse)
async def complete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.complete_project(project_id, family_id)


@router.post("/{project_id}/archive", response_model=ProjectResponse)
async def archive_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.archive_project(project_id, family_id)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    await service.delete_project(project_id, family_id)


# ── Milestones ──

@router.post("/{project_id}/milestones", response_model=MilestoneResponse, status_code=status.HTTP_201_CREATED)
async def add_milestone(
    project_id: UUID,
    req: MilestoneCreate,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.add_milestone(project_id, family_id, req)


@router.patch("/milestones/{milestone_id}", response_model=MilestoneResponse)
async def update_milestone(
    milestone_id: UUID,
    req: MilestoneUpdate,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.update_milestone(milestone_id, family_id, req)


@router.delete("/milestones/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_milestone(
    milestone_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    await service.delete_milestone(milestone_id, family_id)


@router.put("/{project_id}/milestones/reorder", response_model=list[MilestoneResponse])
async def reorder_milestones(
    project_id: UUID,
    milestone_ids: list[UUID],
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.reorder_milestones(project_id, family_id, milestone_ids)


# ── Milestone Completions ──

@router.post("/milestones/{milestone_id}/toggle/{child_id}")
async def toggle_milestone_completion(
    milestone_id: UUID,
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.toggle_milestone_completion(milestone_id, child_id, family_id)


# ── Resources ──

@router.get("/{project_id}/resources", response_model=list[ProjectResourceResponse])
async def list_project_resources(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.list_resources(project_id, family_id)


@router.post("/{project_id}/resources", response_model=ProjectResourceResponse, status_code=status.HTTP_201_CREATED)
async def link_resource(
    project_id: UUID,
    req: ProjectResourceCreate,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.link_resource(project_id, family_id, req)


@router.delete("/{project_id}/resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_resource(
    project_id: UUID,
    resource_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    await service.unlink_resource(project_id, resource_id, family_id)


# ── Portfolio Entries ──

@router.get("/{project_id}/portfolio", response_model=list[PortfolioEntryResponse])
async def list_portfolio_entries(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.list_portfolio_entries(project_id, family_id)


@router.get("/portfolio/child/{child_id}", response_model=list[PortfolioEntryResponse])
async def get_child_portfolio(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.get_portfolio_entries_by_child(child_id, family_id)


@router.patch("/portfolio/{entry_id}", response_model=PortfolioEntryResponse)
async def update_portfolio_entry(
    entry_id: UUID,
    req: PortfolioEntryUpdate,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.update_portfolio_entry(entry_id, family_id, req)


# ── Achievements ──

@router.get("/achievements/child/{child_id}", response_model=list[AchievementResponse])
async def list_child_achievements(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.list_achievements_by_child(child_id, family_id)


@router.post("/achievements/{achievement_id}/acknowledge", response_model=AchievementResponse)
async def acknowledge_achievement(
    achievement_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    return await service.acknowledge_achievement(achievement_id, family_id)


# ── Certificate ──

@router.get("/{project_id}/certificate/{child_id}")
async def get_certificate_data(
    project_id: UUID,
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    family_service: FamilyService = Depends(get_family_service),
):
    family_id = await _get_family_id(current_user, family_service)
    data = await service.get_certificate_data(project_id, child_id, family_id)

    # Get child and family info for the certificate
    from app.models.child import Child
    from app.models.family import Family
    from app.models.subject import Subject
    from sqlalchemy.future import select

    db = service.db

    child_result = await db.execute(select(Child).where(Child.id == child_id))
    child = child_result.scalars().first()

    family = await family_service.get_family_by_account(current_user.id)

    # Get subject names
    subject_names = []
    for ps in data["subjects"]:
        subj_result = await db.execute(select(Subject).where(Subject.id == ps.subject_id))
        subj = subj_result.scalars().first()
        if subj:
            subject_names.append(subj.name)

    return {
        "child_name": f"{child.first_name}" if child else "",
        "family_name": family.family_name if family else "",
        "shield_config": family.shield_config if family else None,
        "project_title": data["project"].title,
        "project_purpose": data["project"].purpose,
        "completed_at": data["project"].completed_at.isoformat() if data["project"].completed_at else None,
        "certificate_number": data["achievement"].certificate_number,
        "subjects": subject_names,
    }
