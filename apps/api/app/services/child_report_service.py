import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import Date, cast, func
from sqlalchemy.future import select

from app.models.child import Child
from app.models.child_highlight import ChildHighlight
from app.models.curriculum import ChildCurriculum, Curriculum, CurriculumSubject
from app.models.family import Family
from app.models.family_member import FamilyMember
from app.models.note import Note
from app.models.project import (
    MilestoneCompletion,
    PortfolioEntry,
    Project,
    ProjectChild,
    ProjectMilestone,
    ProjectSubject,
)
from app.models.resource import Resource, SubjectResource
from app.models.subject import Subject
from app.models.teaching_log import TeachingLog
from app.models.user import User
from app.models.week_planner import RoutineEntry, WeekTemplate
from app.schemas.child_report import HighlightCreate, HighlightUpdate

# Without an active curriculum, the report covers this many days up to today
DEFAULT_RANGE_DAYS = 90


class ChildReportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_child(self, child_id: uuid.UUID, family_id: uuid.UUID) -> Child:
        result = await self.db.execute(
            select(Child).where(Child.id == child_id, Child.family_id == family_id)
        )
        child = result.scalars().first()
        if not child:
            raise HTTPException(status_code=404, detail="Child not found.")
        return child

    # ── Highlights ──────────────────────────────────────────────────────────

    async def list_highlights(
        self,
        child_id: uuid.UUID,
        family_id: uuid.UUID,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> list[ChildHighlight]:
        await self._get_child(child_id, family_id)
        query = select(ChildHighlight).where(
            ChildHighlight.child_id == child_id,
            ChildHighlight.family_id == family_id,
        )
        # Undated highlights (recurring things) count from the day they were recorded
        effective_date = func.coalesce(ChildHighlight.occurred_on, cast(ChildHighlight.created_at, Date))
        if from_date:
            query = query.where(effective_date >= from_date)
        if to_date:
            query = query.where(effective_date <= to_date)
        query = query.order_by(
            ChildHighlight.occurred_on.desc().nulls_first(), ChildHighlight.created_at.desc()
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create_highlight(
        self, child_id: uuid.UUID, family_id: uuid.UUID, data: HighlightCreate
    ) -> ChildHighlight:
        await self._get_child(child_id, family_id)
        highlight = ChildHighlight(
            family_id=family_id,
            child_id=child_id,
            category=data.category.value,
            title=data.title,
            description=data.description or None,
            occurred_on=data.occurred_on,
        )
        self.db.add(highlight)
        await self.db.commit()
        await self.db.refresh(highlight)
        return highlight

    async def _get_highlight(
        self, child_id: uuid.UUID, highlight_id: uuid.UUID, family_id: uuid.UUID
    ) -> ChildHighlight:
        result = await self.db.execute(
            select(ChildHighlight).where(
                ChildHighlight.id == highlight_id,
                ChildHighlight.child_id == child_id,
                ChildHighlight.family_id == family_id,
            )
        )
        highlight = result.scalars().first()
        if not highlight:
            raise HTTPException(status_code=404, detail="Highlight not found.")
        return highlight

    async def update_highlight(
        self, child_id: uuid.UUID, highlight_id: uuid.UUID, family_id: uuid.UUID, data: HighlightUpdate
    ) -> ChildHighlight:
        highlight = await self._get_highlight(child_id, highlight_id, family_id)
        update_data = data.model_dump(exclude_unset=True)
        if update_data.get("category") is not None:
            update_data["category"] = update_data["category"].value
        if "title" in update_data:
            title = (update_data["title"] or "").strip()
            if not title:
                raise HTTPException(status_code=422, detail="Title is required.")
            update_data["title"] = title
        for key, value in update_data.items():
            # Category can't be cleared; the date can (sending null makes it undated)
            if value is None and key == "category":
                continue
            setattr(highlight, key, value)
        await self.db.commit()
        await self.db.refresh(highlight)
        return highlight

    async def delete_highlight(self, child_id: uuid.UUID, highlight_id: uuid.UUID, family_id: uuid.UUID) -> None:
        highlight = await self._get_highlight(child_id, highlight_id, family_id)
        await self.db.delete(highlight)
        await self.db.commit()

    # ── Report ──────────────────────────────────────────────────────────────

    async def _active_curriculums(self, child_id: uuid.UUID, family_id: uuid.UUID) -> list[Curriculum]:
        result = await self.db.execute(
            select(Curriculum)
            .join(ChildCurriculum, ChildCurriculum.curriculum_id == Curriculum.id)
            .where(
                ChildCurriculum.child_id == child_id,
                Curriculum.family_id == family_id,
                Curriculum.status == "active",
            )
            .order_by(Curriculum.start_date)
        )
        return list(result.scalars().unique().all())

    async def _member_names(self, family_id: uuid.UUID) -> dict[uuid.UUID, str]:
        result = await self.db.execute(
            select(FamilyMember, User)
            .outerjoin(User, User.id == FamilyMember.user_id)
            .where(FamilyMember.family_id == family_id)
        )
        names: dict[uuid.UUID, str] = {}
        for member, user in result.all():
            first = user.first_name if user else member.first_name
            last = user.last_name if user else member.last_name
            names[member.id] = " ".join(p for p in (first, last) if p) or (user.email if user else "")
        return names

    async def _resources_by_subject(
        self, subject_ids: list[uuid.UUID], family_id: uuid.UUID
    ) -> dict[uuid.UUID, list[dict]]:
        if not subject_ids:
            return {}
        result = await self.db.execute(
            select(SubjectResource, Resource)
            .join(Resource, Resource.id == SubjectResource.resource_id)
            .where(SubjectResource.subject_id.in_(subject_ids), Resource.family_id == family_id)
            .order_by(Resource.title)
        )
        out: dict[uuid.UUID, list[dict]] = defaultdict(list)
        for link, resource in result.all():
            out[link.subject_id].append({
                "id": resource.id,
                "title": resource.title,
                "type": resource.type,
                "author": resource.author,
                "progress_notes": link.progress_notes,
            })
        return out

    async def _curriculum_details(
        self,
        curriculums: list[Curriculum],
        family_id: uuid.UUID,
        logs_by_subject: dict[uuid.UUID, dict],
    ) -> list[dict]:
        if not curriculums:
            return []
        result = await self.db.execute(
            select(CurriculumSubject, Subject)
            .join(Subject, Subject.id == CurriculumSubject.subject_id)
            .where(
                CurriculumSubject.curriculum_id.in_([c.id for c in curriculums]),
                CurriculumSubject.is_active == True,  # noqa: E712
            )
            .order_by(CurriculumSubject.sort_order, Subject.name)
        )
        rows = result.all()
        member_names = await self._member_names(family_id)
        resources = await self._resources_by_subject(list({s.id for _, s in rows}), family_id)

        subjects_by_curriculum: dict[uuid.UUID, list[dict]] = defaultdict(list)
        for cs, subject in rows:
            logged = logs_by_subject.get(subject.id, {"sessions": 0, "minutes": 0})
            subjects_by_curriculum[cs.curriculum_id].append({
                "id": subject.id,
                "name": subject.name,
                "color": subject.color,
                "icon": subject.icon,
                "category": subject.category,
                "short_description": subject.short_description,
                "learning_objectives": list(subject.learning_objectives or []),
                "skills_targeted": list(subject.skills_targeted or []),
                "weekly_frequency": cs.weekly_frequency,
                "session_duration_minutes": cs.session_duration_minutes,
                "scheduled_days": list(cs.scheduled_days or []),
                "goals_for_period": list(cs.goals_for_period or []),
                "notes": cs.notes,
                "taught_by": member_names.get(subject.responsible_member_id) if subject.responsible_member_id else None,
                "resources": resources.get(subject.id, []),
                "sessions_logged": logged["sessions"],
                "minutes_logged": logged["minutes"],
            })

        return [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "period_type": c.period_type,
                "start_date": c.start_date,
                "end_date": c.end_date,
                "education_philosophy": c.education_philosophy,
                "overall_goals": list(c.overall_goals or []),
                "subjects": subjects_by_curriculum.get(c.id, []),
            }
            for c in curriculums
        ]

    async def _projects(self, child_id: uuid.UUID, family_id: uuid.UUID, from_date: date, to_date: date) -> list[dict]:
        result = await self.db.execute(
            select(Project)
            .join(ProjectChild, ProjectChild.project_id == Project.id)
            .where(
                ProjectChild.child_id == child_id,
                Project.family_id == family_id,
                Project.status.in_(("active", "complete")),
            )
            .order_by(Project.created_at)
        )
        projects = [
            p for p in result.scalars().unique().all()
            # Overlaps the report period: started before it ends, and not finished before it began
            if p.created_at.date() <= to_date and (p.completed_at is None or p.completed_at.date() >= from_date)
        ]
        if not projects:
            return []
        project_ids = [p.id for p in projects]

        sres = await self.db.execute(
            select(ProjectSubject.project_id, Subject.name)
            .join(Subject, Subject.id == ProjectSubject.subject_id)
            .where(ProjectSubject.project_id.in_(project_ids))
            .order_by(Subject.name)
        )
        subject_names: dict[uuid.UUID, list[str]] = defaultdict(list)
        for project_id, name in sres.all():
            subject_names[project_id].append(name)

        mres = await self.db.execute(
            select(ProjectMilestone.project_id, ProjectMilestone.id).where(ProjectMilestone.project_id.in_(project_ids))
        )
        milestones: dict[uuid.UUID, list[uuid.UUID]] = defaultdict(list)
        for project_id, milestone_id in mres.all():
            milestones[project_id].append(milestone_id)

        all_milestone_ids = [m for ids in milestones.values() for m in ids]
        completed: set[uuid.UUID] = set()
        if all_milestone_ids:
            cres = await self.db.execute(
                select(MilestoneCompletion.milestone_id).where(
                    MilestoneCompletion.milestone_id.in_(all_milestone_ids),
                    MilestoneCompletion.child_id == child_id,
                )
            )
            completed = set(cres.scalars().all())

        pres = await self.db.execute(
            select(PortfolioEntry).where(
                PortfolioEntry.project_id.in_(project_ids),
                PortfolioEntry.child_id == child_id,
            )
        )
        portfolio = {e.project_id: e for e in pres.scalars().all()}

        out = []
        for p in projects:
            entry = portfolio.get(p.id)
            out.append({
                "id": p.id,
                "title": p.title,
                "description": p.description,
                "purpose": p.purpose,
                "status": p.status,
                "due_date": p.due_date,
                "completed_at": p.completed_at,
                "subject_names": subject_names.get(p.id, []),
                "milestones_total": len(milestones.get(p.id, [])),
                "milestones_completed": len([m for m in milestones.get(p.id, []) if m in completed]),
                "portfolio": {
                    "title": entry.title,
                    "reflection": entry.reflection,
                    "parent_notes": entry.parent_notes,
                    "score": entry.score,
                } if entry else None,
            })
        return out

    async def _routine(self, child_id: uuid.UUID, family_id: uuid.UUID) -> dict | None:
        tres = await self.db.execute(
            select(WeekTemplate).where(WeekTemplate.family_id == family_id, WeekTemplate.is_active == True)  # noqa: E712
        )
        template = tres.scalars().first()
        if not template:
            return None
        eres = await self.db.execute(
            select(RoutineEntry, Subject)
            .outerjoin(Subject, Subject.id == RoutineEntry.subject_id)
            .where(RoutineEntry.template_id == template.id, RoutineEntry.child_ids.any(child_id))
            .order_by(RoutineEntry.day_of_week, RoutineEntry.start_minute)
        )
        return {
            "template_name": template.name,
            "include_saturday": template.include_saturday,
            "include_sunday": template.include_sunday,
            "entries": [
                {
                    "day_of_week": e.day_of_week,
                    "start_minute": e.start_minute,
                    "duration_minutes": e.duration_minutes,
                    "subject_id": e.subject_id,
                    "subject_name": s.name if s else None,
                    "icon": s.icon if s else None,
                    "color": e.color or (s.color if s else None),
                    "is_free_time": e.is_free_time,
                    "notes": e.notes,
                }
                for e, s in eres.all()
            ],
        }

    async def _notes(self, child_id: uuid.UUID, family_id: uuid.UUID, from_date: date, to_date: date) -> list[Note]:
        result = await self.db.execute(
            select(Note)
            .where(
                Note.family_id == family_id,
                Note.entity_type == "child",
                Note.entity_id == child_id,
                Note.status != "archived",
            )
            .order_by(Note.is_pinned.desc(), Note.created_at.desc())
        )
        # Pinned notes always belong in the report; others only when written in the period
        return [
            n for n in result.scalars().all()
            if n.is_pinned or from_date <= n.created_at.date() <= to_date
        ]

    async def _teaching_logs(
        self, child_id: uuid.UUID, family_id: uuid.UUID, from_date: date, to_date: date
    ) -> tuple[dict[uuid.UUID, dict], dict]:
        result = await self.db.execute(
            select(TeachingLog).where(
                TeachingLog.family_id == family_id,
                TeachingLog.child_id == child_id,
                TeachingLog.taught_on >= from_date,
                TeachingLog.taught_on <= to_date,
            )
        )
        logs = list(result.scalars().all())
        by_subject: dict[uuid.UUID, dict] = defaultdict(lambda: {"sessions": 0, "minutes": 0})
        for log in logs:
            if log.subject_id:
                by_subject[log.subject_id]["sessions"] += 1
                by_subject[log.subject_id]["minutes"] += log.minutes or 0
        summary = {
            "total_sessions": len(logs),
            "total_minutes": sum(log.minutes or 0 for log in logs),
            "days_with_sessions": len({log.taught_on for log in logs}),
        }
        return by_subject, summary

    async def get_report(
        self,
        child_id: uuid.UUID,
        family_id: uuid.UUID,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> dict:
        child = await self._get_child(child_id, family_id)
        fres = await self.db.execute(select(Family).where(Family.id == family_id))
        family = fres.scalars().first()

        curriculums = await self._active_curriculums(child_id, family_id)
        # Default period: the span of the active curriculums, else the last 90 days
        if from_date is None:
            from_date = (
                min(c.start_date for c in curriculums)
                if curriculums
                else date.today() - timedelta(days=DEFAULT_RANGE_DAYS)
            )
        if to_date is None:
            to_date = max(c.end_date for c in curriculums) if curriculums else date.today()
        if from_date > to_date:
            raise HTTPException(status_code=422, detail="The start date must be before the end date.")

        logs_by_subject, learning_summary = await self._teaching_logs(child_id, family_id, from_date, to_date)

        return {
            "generated_at": datetime.now(timezone.utc),
            "range": {"from_date": from_date, "to_date": to_date},
            "family": {
                "family_name": family.family_name,
                "shield_config": family.shield_config or None,
            },
            "child": {
                "id": child.id,
                "first_name": child.first_name,
                "nickname": child.nickname,
                "birthdate": child.birthdate,
                "birth_year": child.birth_year,
                "birth_month": child.birth_month,
                "grade_level": child.grade_level,
                "learning_styles": list(child.learning_styles or []),
                "interests": list(child.interests or []),
                "personality_description": child.personality_description,
                "personality_tags": list(child.personality_tags or []),
                "motivators": child.motivators,
                "learning_differences": list(child.learning_differences or []),
                "accommodations_notes": child.accommodations_notes,
            },
            "curriculums": await self._curriculum_details(curriculums, family_id, logs_by_subject),
            "projects": await self._projects(child_id, family_id, from_date, to_date),
            "routine": await self._routine(child_id, family_id),
            "notes": await self._notes(child_id, family_id, from_date, to_date),
            "highlights": await self.list_highlights(child_id, family_id, from_date, to_date),
            "learning_summary": learning_summary,
        }
