import uuid
from datetime import datetime, date, time, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.models.calendar import CalendarEvent
from app.models.project import Project, ProjectChild, ProjectMilestone
from app.models.curriculum import Curriculum, ChildCurriculum
from app.models.week_planner import WeekTemplate, RoutineEntry
from app.models.subject import Subject
from app.schemas.calendar import CalendarEventCreate, CalendarEventUpdate


def utcnow():
    return datetime.now(timezone.utc)


def _to_utc_midnight(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=timezone.utc)


def _to_utc_end_of_day(d: date) -> datetime:
    return datetime.combine(d, time.max, tzinfo=timezone.utc)


class CalendarService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Helpers ──

    async def _get_event_owned(self, event_id: uuid.UUID, family_id: uuid.UUID) -> CalendarEvent:
        result = await self.db.execute(select(CalendarEvent).where(CalendarEvent.id == event_id))
        event = result.scalars().first()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found.")
        if event.family_id != family_id:
            raise HTTPException(status_code=404, detail="Event not found.")
        return event

    # ── CRUD ──

    async def list_user_events(
        self,
        family_id: uuid.UUID,
        range_start: datetime,
        range_end: datetime,
    ) -> list[CalendarEvent]:
        """Return user events that *could* overlap the range.

        Non-recurring events: filter by start_at/end_at overlap.
        Recurring events: fetch all and let caller expand/filter.
        """
        non_recurring = select(CalendarEvent).where(
            CalendarEvent.family_id == family_id,
            CalendarEvent.recurrence == "none",
            CalendarEvent.end_at >= range_start,
            CalendarEvent.start_at <= range_end,
        )
        recurring = select(CalendarEvent).where(
            CalendarEvent.family_id == family_id,
            CalendarEvent.recurrence != "none",
            CalendarEvent.start_at <= range_end,
        )
        nr_result = await self.db.execute(non_recurring)
        r_result = await self.db.execute(recurring)
        return list(nr_result.scalars().all()) + list(r_result.scalars().all())

    async def get_event(self, event_id: uuid.UUID, family_id: uuid.UUID) -> CalendarEvent:
        return await self._get_event_owned(event_id, family_id)

    async def create_event(self, family_id: uuid.UUID, data: CalendarEventCreate) -> CalendarEvent:
        event = CalendarEvent(
            family_id=family_id,
            title=data.title,
            description=data.description,
            event_type=data.event_type,
            all_day=data.all_day,
            start_at=data.start_at,
            end_at=data.end_at,
            child_ids=[str(cid) for cid in data.child_ids] if data.child_ids else [],
            subject_id=data.subject_id,
            project_id=data.project_id,
            milestone_id=data.milestone_id,
            color=data.color,
            location=data.location,
            recurrence=data.recurrence,
        )
        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)
        return event

    async def update_event(
        self, event_id: uuid.UUID, family_id: uuid.UUID, data: CalendarEventUpdate
    ) -> CalendarEvent:
        event = await self._get_event_owned(event_id, family_id)
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(event, key, value)
        await self.db.commit()
        await self.db.refresh(event)
        return event

    async def delete_event(self, event_id: uuid.UUID, family_id: uuid.UUID) -> None:
        event = await self._get_event_owned(event_id, family_id)
        await self.db.delete(event)
        await self.db.commit()

    # ── Recurrence expansion ──

    @staticmethod
    def expand_recurrence(
        event: CalendarEvent,
        range_start: datetime,
        range_end: datetime,
    ) -> list[dict]:
        """Expand a recurring event into occurrences within the range.

        Returns a list of dicts with `start_at`/`end_at` overridden per occurrence.
        For `none` recurrence, returns the event as-is if it overlaps.
        """
        base_start = event.start_at
        base_end = event.end_at
        duration = base_end - base_start

        occurrences: list[dict] = []

        def emit(occ_start: datetime) -> None:
            occ_end = occ_start + duration
            if occ_end < range_start or occ_start > range_end:
                return
            occurrences.append({"start_at": occ_start, "end_at": occ_end})

        if event.recurrence == "none":
            emit(base_start)
            return occurrences

        # Cap the walk to avoid unbounded iteration
        max_iter = 600

        if event.recurrence == "weekly":
            current = base_start
            # fast-forward to the range window
            while current + duration < range_start and max_iter > 0:
                current = current + timedelta(weeks=1)
                max_iter -= 1
            while current <= range_end and max_iter > 0:
                emit(current)
                current = current + timedelta(weeks=1)
                max_iter -= 1

        elif event.recurrence == "monthly":
            current = base_start
            while current + duration < range_start and max_iter > 0:
                current = _add_months(current, 1)
                max_iter -= 1
            while current <= range_end and max_iter > 0:
                emit(current)
                current = _add_months(current, 1)
                max_iter -= 1

        elif event.recurrence == "yearly":
            current = base_start
            while current + duration < range_start and max_iter > 0:
                current = _add_months(current, 12)
                max_iter -= 1
            while current <= range_end and max_iter > 0:
                emit(current)
                current = _add_months(current, 12)
                max_iter -= 1

        return occurrences

    # ── System events (projects, curriculums) ──

    async def fetch_system_events(
        self,
        family_id: uuid.UUID,
        range_start: datetime,
        range_end: datetime,
    ) -> list[dict]:
        """Fetch project milestone dates and curriculum boundaries as system events."""
        events: list[dict] = []

        # Project milestones with due_date in range
        start_d = range_start.date()
        end_d = range_end.date()

        milestone_q = (
            select(ProjectMilestone, Project)
            .join(Project, ProjectMilestone.project_id == Project.id)
            .where(
                Project.family_id == family_id,
                Project.archived_at.is_(None),
                ProjectMilestone.due_date.is_not(None),
                ProjectMilestone.due_date >= start_d,
                ProjectMilestone.due_date <= end_d,
            )
        )
        m_result = await self.db.execute(milestone_q)
        for milestone, project in m_result.all():
            # Gather assigned children for this project
            ch_result = await self.db.execute(
                select(ProjectChild.child_id).where(ProjectChild.project_id == project.id)
            )
            child_ids = [row[0] for row in ch_result.all()]

            events.append({
                "id": f"milestone-{milestone.id}",
                "family_id": family_id,
                "title": f"{project.title} — {milestone.title}",
                "description": milestone.description,
                "event_type": "project",
                "all_day": True,
                "start_at": _to_utc_midnight(milestone.due_date),
                "end_at": _to_utc_end_of_day(milestone.due_date),
                "child_ids": child_ids,
                "subject_id": None,
                "project_id": project.id,
                "milestone_id": milestone.id,
                "color": None,
                "location": None,
                "recurrence": "none",
                "is_system": True,
                "source_url": f"/projects/{project.id}",
            })

        # Curriculum start/end dates
        curr_q = select(Curriculum).where(
            Curriculum.family_id == family_id,
            Curriculum.status.in_(["active", "draft", "paused", "completed"]),
        )
        c_result = await self.db.execute(curr_q)
        for curriculum in c_result.scalars().all():
            # Assigned children
            cc_result = await self.db.execute(
                select(ChildCurriculum.child_id).where(ChildCurriculum.curriculum_id == curriculum.id)
            )
            c_child_ids = [row[0] for row in cc_result.all()]

            if start_d <= curriculum.start_date <= end_d:
                events.append({
                    "id": f"curriculum-start-{curriculum.id}",
                    "family_id": family_id,
                    "title": f"{curriculum.name} begins",
                    "description": None,
                    "event_type": "curriculum",
                    "all_day": True,
                    "start_at": _to_utc_midnight(curriculum.start_date),
                    "end_at": _to_utc_end_of_day(curriculum.start_date),
                    "child_ids": c_child_ids,
                    "subject_id": None,
                    "project_id": None,
                    "milestone_id": None,
                    "color": None,
                    "location": None,
                    "recurrence": "none",
                    "is_system": True,
                    "source_url": f"/curriculums/{curriculum.id}",
                })
            if start_d <= curriculum.end_date <= end_d:
                events.append({
                    "id": f"curriculum-end-{curriculum.id}",
                    "family_id": family_id,
                    "title": f"{curriculum.name} ends",
                    "description": None,
                    "event_type": "curriculum",
                    "all_day": True,
                    "start_at": _to_utc_midnight(curriculum.end_date),
                    "end_at": _to_utc_end_of_day(curriculum.end_date),
                    "child_ids": c_child_ids,
                    "subject_id": None,
                    "project_id": None,
                    "milestone_id": None,
                    "color": None,
                    "location": None,
                    "recurrence": "none",
                    "is_system": True,
                    "source_url": f"/curriculums/{curriculum.id}",
                })

        return events

    # ── Routine projection ──

    async def fetch_routine_projections(
        self,
        family_id: uuid.UUID,
        range_start: datetime,
        range_end: datetime,
    ) -> list[dict]:
        """Expand the active week template's routine entries across the date range."""
        tmpl_result = await self.db.execute(
            select(WeekTemplate)
            .options(selectinload(WeekTemplate.entries))
            .where(
                WeekTemplate.family_id == family_id,
                WeekTemplate.is_active.is_(True),
            )
        )
        template = tmpl_result.scalars().first()
        if not template:
            return []

        subject_ids = [e.subject_id for e in template.entries if e.subject_id]
        subjects: dict[uuid.UUID, Subject] = {}
        if subject_ids:
            s_result = await self.db.execute(
                select(Subject).where(Subject.id.in_(subject_ids))
            )
            subjects = {s.id: s for s in s_result.scalars().all()}

        blocks: list[dict] = []
        current = range_start.date()
        end_date = range_end.date()
        while current <= end_date:
            dow = current.weekday()  # 0=Monday
            for entry in template.entries:
                if entry.day_of_week != dow:
                    continue
                subject = subjects.get(entry.subject_id) if entry.subject_id else None
                block_date = datetime.combine(current, time.min, tzinfo=timezone.utc)
                color = entry.color or (subject.color if subject else None)
                blocks.append({
                    "entry_id": entry.id,
                    "date": block_date,
                    "day_of_week": entry.day_of_week,
                    "start_minute": entry.start_minute,
                    "duration_minutes": entry.duration_minutes,
                    "subject_id": entry.subject_id,
                    "subject_name": subject.name if subject else None,
                    "is_free_time": entry.is_free_time,
                    "child_ids": [cid for cid in entry.child_ids] if entry.child_ids else [],
                    "color": color,
                    "notes": entry.notes,
                })
            current += timedelta(days=1)

        return blocks

    # ── Unified query ──

    async def query_range(
        self,
        family_id: uuid.UUID,
        range_start: datetime,
        range_end: datetime,
        include_system: bool = True,
        include_routine: bool = False,
        event_types: list[str] | None = None,
        child_id: uuid.UUID | None = None,
    ) -> dict:
        # User events
        raw_events = await self.list_user_events(family_id, range_start, range_end)
        user_events: list[dict] = []
        for event in raw_events:
            occurrences = self.expand_recurrence(event, range_start, range_end)
            for occ in occurrences:
                user_events.append({
                    "id": str(event.id),
                    "family_id": event.family_id,
                    "title": event.title,
                    "description": event.description,
                    "event_type": event.event_type,
                    "all_day": event.all_day,
                    "start_at": occ["start_at"],
                    "end_at": occ["end_at"],
                    "child_ids": [cid for cid in event.child_ids] if event.child_ids else [],
                    "subject_id": event.subject_id,
                    "project_id": event.project_id,
                    "milestone_id": event.milestone_id,
                    "color": event.color,
                    "location": event.location,
                    "recurrence": event.recurrence,
                    "is_system": False,
                    "source_url": None,
                })

        # System events
        system_events: list[dict] = []
        if include_system:
            system_events = await self.fetch_system_events(family_id, range_start, range_end)

        all_events = user_events + system_events

        # Filter by event_type
        if event_types:
            all_events = [e for e in all_events if e["event_type"] in event_types]

        # Filter by child_id
        if child_id:
            cid_str = str(child_id)
            all_events = [
                e for e in all_events
                if not e["child_ids"] or cid_str in [str(x) for x in e["child_ids"]]
            ]

        # Sort by start_at
        all_events.sort(key=lambda e: e["start_at"])

        # Routine projections
        routine_projections: list[dict] = []
        if include_routine:
            routine_projections = await self.fetch_routine_projections(family_id, range_start, range_end)

        return {
            "events": all_events,
            "routine_projections": routine_projections,
        }


def _add_months(dt: datetime, months: int) -> datetime:
    """Add months to a datetime, clamping day to the end of the target month if needed."""
    year = dt.year + (dt.month - 1 + months) // 12
    month = (dt.month - 1 + months) % 12 + 1
    # Clamp day to last day of target month
    import calendar
    last_day = calendar.monthrange(year, month)[1]
    day = min(dt.day, last_day)
    return dt.replace(year=year, month=month, day=day)
