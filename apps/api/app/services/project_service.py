import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, delete
from fastapi import HTTPException

from app.models.project import (
    Project, ProjectChild, ProjectSubject, ProjectMilestone,
    MilestoneCompletion, ProjectResource, PortfolioEntry, ChildAchievement,
)
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, MilestoneCreate, MilestoneUpdate,
    PortfolioEntryUpdate, ProjectResourceCreate,
)


DEFAULT_MILESTONES = [
    "Research & Gather",
    "Plan & Outline",
    "Create & Build",
    "Review & Refine",
    "Present or Deliver",
    "Reflect",
]


def utcnow():
    return datetime.now(timezone.utc)


class ProjectService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Helpers ──

    async def _get_project_owned(self, project_id: uuid.UUID, family_id: uuid.UUID) -> Project:
        result = await self.db.execute(select(Project).where(Project.id == project_id))
        project = result.scalars().first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found.")
        if project.family_id != family_id:
            raise HTTPException(status_code=404, detail="Project not found.")
        return project

    async def _load_children(self, project_id: uuid.UUID) -> list[ProjectChild]:
        result = await self.db.execute(
            select(ProjectChild).where(ProjectChild.project_id == project_id)
        )
        return list(result.scalars().all())

    async def _load_subjects(self, project_id: uuid.UUID) -> list[ProjectSubject]:
        result = await self.db.execute(
            select(ProjectSubject).where(ProjectSubject.project_id == project_id)
        )
        return list(result.scalars().all())

    async def _load_milestones(self, project_id: uuid.UUID) -> list[ProjectMilestone]:
        result = await self.db.execute(
            select(ProjectMilestone)
            .where(ProjectMilestone.project_id == project_id)
            .order_by(ProjectMilestone.sort_order)
        )
        return list(result.scalars().all())

    async def _load_completions(self, project_id: uuid.UUID) -> list[MilestoneCompletion]:
        milestone_ids_q = select(ProjectMilestone.id).where(ProjectMilestone.project_id == project_id)
        result = await self.db.execute(
            select(MilestoneCompletion).where(MilestoneCompletion.milestone_id.in_(milestone_ids_q))
        )
        return list(result.scalars().all())

    async def _enrich_project(self, project: Project) -> dict:
        children = await self._load_children(project.id)
        subjects = await self._load_subjects(project.id)
        milestones = await self._load_milestones(project.id)
        completions = await self._load_completions(project.id)
        return {
            **{c.key: getattr(project, c.key) for c in Project.__table__.columns},
            "children": children,
            "subjects": subjects,
            "milestones": milestones,
            "completions": completions,
        }

    async def _enrich_project_list(self, project: Project) -> dict:
        children = await self._load_children(project.id)
        subjects = await self._load_subjects(project.id)
        milestones = await self._load_milestones(project.id)
        completions = await self._load_completions(project.id)
        return {
            **{c.key: getattr(project, c.key) for c in Project.__table__.columns},
            "children": children,
            "subjects": subjects,
            "milestone_count": len(milestones),
            "completions": completions,
        }

    # ── CRUD ──

    async def list_projects(
        self,
        family_id: uuid.UUID,
        status: str | None = None,
        child_id: uuid.UUID | None = None,
        subject_id: uuid.UUID | None = None,
    ) -> list[dict]:
        query = select(Project).where(
            Project.family_id == family_id,
            Project.archived_at.is_(None),
        )

        if status:
            query = query.where(Project.status == status)

        if child_id:
            child_project_ids = select(ProjectChild.project_id).where(ProjectChild.child_id == child_id)
            query = query.where(Project.id.in_(child_project_ids))

        if subject_id:
            subj_project_ids = select(ProjectSubject.project_id).where(ProjectSubject.subject_id == subject_id)
            query = query.where(Project.id.in_(subj_project_ids))

        query = query.order_by(
            Project.due_date.asc().nulls_last(),
            Project.created_at.desc(),
        )

        result = await self.db.execute(query)
        projects = list(result.scalars().all())

        enriched = []
        for p in projects:
            enriched.append(await self._enrich_project_list(p))
        return enriched

    async def get_project(self, project_id: uuid.UUID, family_id: uuid.UUID) -> dict:
        project = await self._get_project_owned(project_id, family_id)
        return await self._enrich_project(project)

    async def create_project(self, family_id: uuid.UUID, data: ProjectCreate) -> dict:
        # Validate subject cap
        if len(data.subject_ids) > 2:
            raise HTTPException(status_code=400, detail="A project can have at most 2 subjects.")

        project = Project(
            family_id=family_id,
            title=data.title,
            description=data.description,
            purpose=data.purpose,
            due_date=data.due_date,
            status=data.status,
        )
        self.db.add(project)
        await self.db.flush()

        # Assign children
        for cid in data.child_ids:
            self.db.add(ProjectChild(project_id=project.id, child_id=cid))

        # Assign subjects
        for i, sid in enumerate(data.subject_ids):
            self.db.add(ProjectSubject(project_id=project.id, subject_id=sid, is_primary=(i == 0)))

        # Create milestones
        milestones = data.milestones
        if milestones is None:
            milestones = [
                MilestoneCreate(title=t, sort_order=i)
                for i, t in enumerate(DEFAULT_MILESTONES)
            ]
        for m in milestones:
            self.db.add(ProjectMilestone(
                project_id=project.id,
                title=m.title,
                description=m.description,
                sort_order=m.sort_order,
                due_date=m.due_date,
            ))

        await self.db.commit()
        await self.db.refresh(project)
        return await self._enrich_project(project)

    async def update_project(self, project_id: uuid.UUID, family_id: uuid.UUID, data: ProjectUpdate) -> dict:
        project = await self._get_project_owned(project_id, family_id)

        update_data = data.model_dump(exclude_unset=True)

        # Handle child reassignment
        if "child_ids" in update_data:
            child_ids = update_data.pop("child_ids")
            await self.db.execute(delete(ProjectChild).where(ProjectChild.project_id == project_id))
            for cid in child_ids:
                self.db.add(ProjectChild(project_id=project_id, child_id=cid))

        # Handle subject reassignment
        if "subject_ids" in update_data:
            subject_ids = update_data.pop("subject_ids")
            if len(subject_ids) > 2:
                raise HTTPException(status_code=400, detail="A project can have at most 2 subjects.")
            await self.db.execute(delete(ProjectSubject).where(ProjectSubject.project_id == project_id))
            for i, sid in enumerate(subject_ids):
                self.db.add(ProjectSubject(project_id=project_id, subject_id=sid, is_primary=(i == 0)))

        for key, value in update_data.items():
            setattr(project, key, value)

        await self.db.commit()
        await self.db.refresh(project)
        return await self._enrich_project(project)

    async def archive_project(self, project_id: uuid.UUID, family_id: uuid.UUID) -> dict:
        project = await self._get_project_owned(project_id, family_id)
        project.archived_at = utcnow()
        project.status = "archived"
        await self.db.commit()
        await self.db.refresh(project)
        return await self._enrich_project(project)

    async def complete_project(self, project_id: uuid.UUID, family_id: uuid.UUID) -> dict:
        project = await self._get_project_owned(project_id, family_id)

        now = utcnow()
        project.status = "complete"
        project.completed_at = now

        # Get assigned children
        children = await self._load_children(project_id)

        # Generate certificate numbers
        count_result = await self.db.execute(
            select(func.count()).select_from(ChildAchievement)
            .join(Project, ChildAchievement.project_id == Project.id)
            .where(Project.family_id == family_id)
        )
        existing_count = count_result.scalar() or 0
        year = now.year

        for i, pc in enumerate(children):
            # Create portfolio entry if not exists
            existing_pe = await self.db.execute(
                select(PortfolioEntry).where(
                    PortfolioEntry.project_id == project_id,
                    PortfolioEntry.child_id == pc.child_id,
                )
            )
            if not existing_pe.scalars().first():
                self.db.add(PortfolioEntry(
                    project_id=project_id,
                    child_id=pc.child_id,
                    title=project.title,
                ))

            # Create achievement if not exists
            existing_ach = await self.db.execute(
                select(ChildAchievement).where(
                    ChildAchievement.project_id == project_id,
                    ChildAchievement.child_id == pc.child_id,
                )
            )
            if not existing_ach.scalars().first():
                cert_num = f"OIK-{year}-{existing_count + i + 1:04d}"
                self.db.add(ChildAchievement(
                    child_id=pc.child_id,
                    project_id=project_id,
                    awarded_at=now,
                    certificate_number=cert_num,
                ))

        await self.db.commit()
        await self.db.refresh(project)
        return await self._enrich_project(project)

    async def delete_project(self, project_id: uuid.UUID, family_id: uuid.UUID) -> None:
        project = await self._get_project_owned(project_id, family_id)
        await self.db.delete(project)
        await self.db.commit()

    # ── Milestones ──

    async def add_milestone(self, project_id: uuid.UUID, family_id: uuid.UUID, data: MilestoneCreate) -> ProjectMilestone:
        await self._get_project_owned(project_id, family_id)
        milestone = ProjectMilestone(
            project_id=project_id,
            title=data.title,
            description=data.description,
            sort_order=data.sort_order,
            due_date=data.due_date,
        )
        self.db.add(milestone)
        await self.db.commit()
        await self.db.refresh(milestone)
        return milestone

    async def update_milestone(self, milestone_id: uuid.UUID, family_id: uuid.UUID, data: MilestoneUpdate) -> ProjectMilestone:
        result = await self.db.execute(select(ProjectMilestone).where(ProjectMilestone.id == milestone_id))
        milestone = result.scalars().first()
        if not milestone:
            raise HTTPException(status_code=404, detail="Milestone not found.")
        await self._get_project_owned(milestone.project_id, family_id)

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(milestone, key, value)

        await self.db.commit()
        await self.db.refresh(milestone)
        return milestone

    async def delete_milestone(self, milestone_id: uuid.UUID, family_id: uuid.UUID) -> None:
        result = await self.db.execute(select(ProjectMilestone).where(ProjectMilestone.id == milestone_id))
        milestone = result.scalars().first()
        if not milestone:
            raise HTTPException(status_code=404, detail="Milestone not found.")
        await self._get_project_owned(milestone.project_id, family_id)
        await self.db.delete(milestone)
        await self.db.commit()

    async def reorder_milestones(self, project_id: uuid.UUID, family_id: uuid.UUID, milestone_ids: list[uuid.UUID]) -> list[ProjectMilestone]:
        await self._get_project_owned(project_id, family_id)
        milestones = await self._load_milestones(project_id)
        id_to_milestone = {m.id: m for m in milestones}
        for i, mid in enumerate(milestone_ids):
            if mid in id_to_milestone:
                id_to_milestone[mid].sort_order = i
        await self.db.commit()
        return await self._load_milestones(project_id)

    # ── Milestone Completions ──

    async def toggle_milestone_completion(
        self, milestone_id: uuid.UUID, child_id: uuid.UUID, family_id: uuid.UUID
    ) -> dict:
        result = await self.db.execute(select(ProjectMilestone).where(ProjectMilestone.id == milestone_id))
        milestone = result.scalars().first()
        if not milestone:
            raise HTTPException(status_code=404, detail="Milestone not found.")
        await self._get_project_owned(milestone.project_id, family_id)

        existing = await self.db.execute(
            select(MilestoneCompletion).where(
                MilestoneCompletion.milestone_id == milestone_id,
                MilestoneCompletion.child_id == child_id,
            )
        )
        completion = existing.scalars().first()

        if completion:
            await self.db.delete(completion)
            await self.db.commit()
            return {"completed": False}
        else:
            mc = MilestoneCompletion(milestone_id=milestone_id, child_id=child_id)
            self.db.add(mc)
            await self.db.commit()
            await self.db.refresh(mc)
            return {"completed": True, "completion": mc}

    # ── Resources ──

    async def link_resource(self, project_id: uuid.UUID, family_id: uuid.UUID, data: ProjectResourceCreate) -> ProjectResource:
        await self._get_project_owned(project_id, family_id)
        pr = ProjectResource(project_id=project_id, resource_id=data.resource_id, notes=data.notes)
        self.db.add(pr)
        await self.db.commit()
        await self.db.refresh(pr)
        return pr

    async def unlink_resource(self, project_id: uuid.UUID, resource_id: uuid.UUID, family_id: uuid.UUID) -> None:
        await self._get_project_owned(project_id, family_id)
        await self.db.execute(
            delete(ProjectResource).where(
                ProjectResource.project_id == project_id,
                ProjectResource.resource_id == resource_id,
            )
        )
        await self.db.commit()

    async def list_resources(self, project_id: uuid.UUID, family_id: uuid.UUID) -> list[ProjectResource]:
        await self._get_project_owned(project_id, family_id)
        result = await self.db.execute(
            select(ProjectResource).where(ProjectResource.project_id == project_id)
        )
        return list(result.scalars().all())

    # ── Portfolio Entries ──

    async def list_portfolio_entries(self, project_id: uuid.UUID, family_id: uuid.UUID) -> list[PortfolioEntry]:
        await self._get_project_owned(project_id, family_id)
        result = await self.db.execute(
            select(PortfolioEntry).where(PortfolioEntry.project_id == project_id)
        )
        return list(result.scalars().all())

    async def get_portfolio_entries_by_child(self, child_id: uuid.UUID, family_id: uuid.UUID) -> list[PortfolioEntry]:
        # Verify child belongs to family by checking project ownership
        result = await self.db.execute(
            select(PortfolioEntry)
            .join(Project, PortfolioEntry.project_id == Project.id)
            .where(
                PortfolioEntry.child_id == child_id,
                Project.family_id == family_id,
            )
            .order_by(PortfolioEntry.created_at.desc())
        )
        return list(result.scalars().all())

    async def update_portfolio_entry(
        self, entry_id: uuid.UUID, family_id: uuid.UUID, data: PortfolioEntryUpdate
    ) -> PortfolioEntry:
        result = await self.db.execute(select(PortfolioEntry).where(PortfolioEntry.id == entry_id))
        entry = result.scalars().first()
        if not entry:
            raise HTTPException(status_code=404, detail="Portfolio entry not found.")
        await self._get_project_owned(entry.project_id, family_id)

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(entry, key, value)

        await self.db.commit()
        await self.db.refresh(entry)
        return entry

    # ── Achievements ──

    async def list_achievements_by_child(self, child_id: uuid.UUID, family_id: uuid.UUID) -> list[ChildAchievement]:
        result = await self.db.execute(
            select(ChildAchievement)
            .join(Project, ChildAchievement.project_id == Project.id)
            .where(
                ChildAchievement.child_id == child_id,
                Project.family_id == family_id,
            )
            .order_by(ChildAchievement.awarded_at.desc())
        )
        return list(result.scalars().all())

    async def acknowledge_achievement(self, achievement_id: uuid.UUID, family_id: uuid.UUID) -> ChildAchievement:
        result = await self.db.execute(select(ChildAchievement).where(ChildAchievement.id == achievement_id))
        achievement = result.scalars().first()
        if not achievement:
            raise HTTPException(status_code=404, detail="Achievement not found.")
        await self._get_project_owned(achievement.project_id, family_id)

        achievement.acknowledged_at = utcnow()
        await self.db.commit()
        await self.db.refresh(achievement)
        return achievement

    # ── Certificate Data ──

    async def get_certificate_data(self, project_id: uuid.UUID, child_id: uuid.UUID, family_id: uuid.UUID) -> dict:
        project = await self._get_project_owned(project_id, family_id)
        if project.status != "complete":
            raise HTTPException(status_code=400, detail="Project is not complete.")

        # Get achievement
        result = await self.db.execute(
            select(ChildAchievement).where(
                ChildAchievement.project_id == project_id,
                ChildAchievement.child_id == child_id,
            )
        )
        achievement = result.scalars().first()
        if not achievement:
            raise HTTPException(status_code=404, detail="Achievement not found.")

        # Get subjects
        subjects = await self._load_subjects(project_id)

        return {
            "project": project,
            "achievement": achievement,
            "subjects": subjects,
        }
