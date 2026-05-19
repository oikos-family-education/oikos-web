import uuid
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.models.child import Child
from app.models.subject import Subject
from app.models.week_planner import WeekTemplate, RoutineEntry
from app.schemas.week_planner import (
    WeekTemplateCreate,
    WeekTemplateUpdate,
    RoutineEntryCreate,
    RoutineEntryUpdate,
    RoutineEntryDuplicate,
)


class WeekPlannerService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # --- Templates ---

    async def list_templates(self, family_id: uuid.UUID) -> list[WeekTemplate]:
        result = await self.db.execute(
            select(WeekTemplate)
            .where(WeekTemplate.family_id == family_id)
            .order_by(WeekTemplate.is_active.desc(), WeekTemplate.updated_at.desc())
        )
        return list(result.scalars().all())

    async def get_template(self, template_id: uuid.UUID, family_id: uuid.UUID) -> WeekTemplate:
        result = await self.db.execute(
            select(WeekTemplate)
            .options(selectinload(WeekTemplate.entries))
            .where(WeekTemplate.id == template_id, WeekTemplate.family_id == family_id)
        )
        template = result.scalars().first()
        if not template:
            raise HTTPException(status_code=404, detail="Week template not found.")
        return template

    async def create_template(self, family_id: uuid.UUID, data: WeekTemplateCreate) -> WeekTemplate:
        template = WeekTemplate(
            family_id=family_id,
            name=data.name,
            is_active=data.is_active,
            start_hour=data.start_hour,
            end_hour=data.end_hour,
            include_saturday=data.include_saturday,
            include_sunday=data.include_sunday,
        )
        if data.is_active:
            await self._deactivate_all(family_id)
        self.db.add(template)
        await self.db.commit()
        # Re-fetch with eager loading to avoid MissingGreenlet on entries
        return await self.get_template(template.id, family_id)

    async def update_template(self, template_id: uuid.UUID, family_id: uuid.UUID, data: WeekTemplateUpdate) -> WeekTemplate:
        template = await self.get_template(template_id, family_id)
        update_data = data.model_dump(exclude_unset=True)
        delete_outside = update_data.pop("delete_outside_entries", False)

        # Resolve final config values
        new_start = update_data.get("start_hour", template.start_hour)
        new_end = update_data.get("end_hour", template.end_hour)
        new_sat = update_data.get("include_saturday", template.include_saturday)
        new_sun = update_data.get("include_sunday", template.include_sunday)

        if new_start >= new_end:
            raise HTTPException(status_code=400, detail="start_hour must be earlier than end_hour")

        # Detect entries that would fall outside the new grid configuration
        outside_entries = [
            e for e in template.entries
            if self._entry_outside_config(e, new_start, new_end, new_sat, new_sun)
        ]
        if outside_entries:
            if not delete_outside:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": "Entries would fall outside the new grid configuration.",
                        "outside_entry_ids": [str(e.id) for e in outside_entries],
                        "count": len(outside_entries),
                    },
                )
            for e in outside_entries:
                await self.db.delete(e)

        for key, value in update_data.items():
            setattr(template, key, value)
        await self.db.commit()
        return await self.get_template(template_id, family_id)

    @staticmethod
    def _entry_outside_config(
        entry,
        start_hour: int,
        end_hour: int,
        include_saturday: bool,
        include_sunday: bool,
    ) -> bool:
        if entry.day_of_week == 5 and not include_saturday:
            return True
        if entry.day_of_week == 6 and not include_sunday:
            return True
        start_min = start_hour * 60
        end_min = end_hour * 60
        if entry.start_minute < start_min:
            return True
        if entry.start_minute + entry.duration_minutes > end_min:
            return True
        return False

    async def activate_template(self, template_id: uuid.UUID, family_id: uuid.UUID) -> WeekTemplate:
        template = await self.get_template(template_id, family_id)
        if template.is_active:
            raise HTTPException(status_code=409, detail="Template is already active.")
        await self._deactivate_all(family_id)
        template.is_active = True
        await self.db.commit()
        return await self.get_template(template_id, family_id)

    async def delete_template(self, template_id: uuid.UUID, family_id: uuid.UUID) -> None:
        template = await self.get_template(template_id, family_id)
        await self.db.delete(template)
        await self.db.commit()

    async def _deactivate_all(self, family_id: uuid.UUID) -> None:
        result = await self.db.execute(
            select(WeekTemplate).where(
                WeekTemplate.family_id == family_id,
                WeekTemplate.is_active == True,
            )
        )
        for t in result.scalars().all():
            t.is_active = False

    # --- Entries ---

    async def create_entry(
        self, template_id: uuid.UUID, family_id: uuid.UUID, data: RoutineEntryCreate
    ) -> RoutineEntry:
        # Verify template exists and belongs to family
        template = await self.get_template(template_id, family_id)

        # Enforce per-template grid bounds
        self._assert_entry_fits_config(
            day_of_week=data.day_of_week,
            start_minute=data.start_minute,
            duration_minutes=data.duration_minutes,
            template=template,
        )

        # Check same-child conflicts (skip for free time)
        if not data.is_free_time:
            await self._check_conflicts(template_id, data.child_ids, data.day_of_week, data.start_minute, data.duration_minutes)

        entry = RoutineEntry(
            template_id=template_id,
            family_id=family_id,
            subject_id=data.subject_id,
            is_free_time=data.is_free_time,
            child_ids=data.child_ids,
            day_of_week=data.day_of_week,
            start_minute=data.start_minute,
            duration_minutes=data.duration_minutes,
            priority=data.priority,
            color=data.color,
            notes=data.notes,
        )
        self.db.add(entry)
        await self.db.commit()
        await self.db.refresh(entry)
        return entry

    async def update_entry(
        self, entry_id: uuid.UUID, family_id: uuid.UUID, data: RoutineEntryUpdate
    ) -> RoutineEntry:
        entry = await self._get_entry(entry_id, family_id)
        update_data = data.model_dump(exclude_unset=True)

        # If time/day/duration changed, check conflicts and bounds
        new_day = update_data.get("day_of_week", entry.day_of_week)
        new_start = update_data.get("start_minute", entry.start_minute)
        new_duration = update_data.get("duration_minutes", entry.duration_minutes)

        if (
            new_day != entry.day_of_week
            or new_start != entry.start_minute
            or new_duration != entry.duration_minutes
        ):
            template = await self.get_template(entry.template_id, family_id)
            self._assert_entry_fits_config(
                day_of_week=new_day,
                start_minute=new_start,
                duration_minutes=new_duration,
                template=template,
            )

        if not entry.is_free_time and (
            new_day != entry.day_of_week
            or new_start != entry.start_minute
            or new_duration != entry.duration_minutes
        ):
            await self._check_conflicts(
                entry.template_id, entry.child_ids, new_day, new_start, new_duration,
                exclude_entry_id=entry_id,
            )

        for key, value in update_data.items():
            setattr(entry, key, value)

        await self.db.commit()
        await self.db.refresh(entry)
        return entry

    async def delete_entry(self, entry_id: uuid.UUID, family_id: uuid.UUID) -> None:
        entry = await self._get_entry(entry_id, family_id)
        await self.db.delete(entry)
        await self.db.commit()

    async def duplicate_entry(
        self, entry_id: uuid.UUID, family_id: uuid.UUID, data: RoutineEntryDuplicate
    ) -> list[RoutineEntry]:
        source = await self._get_entry(entry_id, family_id)
        template = await self.get_template(source.template_id, family_id)
        created = []
        for day in data.target_days:
            if day == source.day_of_week:
                continue
            # Skip target days that are disabled in the template config
            if day == 5 and not template.include_saturday:
                continue
            if day == 6 and not template.include_sunday:
                continue
            # Check conflicts per target day
            if not source.is_free_time:
                try:
                    await self._check_conflicts(
                        source.template_id, source.child_ids, day,
                        source.start_minute, source.duration_minutes,
                    )
                except HTTPException:
                    continue  # skip conflicting days silently
            entry = RoutineEntry(
                template_id=source.template_id,
                family_id=family_id,
                subject_id=source.subject_id,
                is_free_time=source.is_free_time,
                child_ids=list(source.child_ids),
                day_of_week=day,
                start_minute=source.start_minute,
                duration_minutes=source.duration_minutes,
                priority=source.priority,
                color=source.color,
                notes=source.notes,
            )
            self.db.add(entry)
            created.append(entry)
        await self.db.commit()
        for e in created:
            await self.db.refresh(e)
        return created

    async def clear_template_entries(self, template_id: uuid.UUID, family_id: uuid.UUID) -> None:
        await self.get_template(template_id, family_id)
        result = await self.db.execute(
            select(RoutineEntry).where(RoutineEntry.template_id == template_id)
        )
        for entry in result.scalars().all():
            await self.db.delete(entry)
        await self.db.commit()

    # --- Today (dashboard) ---

    async def get_today_routine(self, family_id: uuid.UUID) -> list[dict]:
        """Return today's routine entries enriched with subject and child names.

        Returns an empty list if no active template exists.
        """
        # Today's day_of_week using Python's weekday() (0=Monday..6=Sunday)
        day_of_week = date.today().weekday()

        # Find the active template for this family.
        tpl_result = await self.db.execute(
            select(WeekTemplate).where(
                WeekTemplate.family_id == family_id,
                WeekTemplate.is_active.is_(True),
            )
        )
        template = tpl_result.scalars().first()
        if not template:
            return []

        entries_result = await self.db.execute(
            select(RoutineEntry)
            .where(
                RoutineEntry.template_id == template.id,
                RoutineEntry.day_of_week == day_of_week,
            )
            .order_by(RoutineEntry.start_minute.asc())
        )
        entries = list(entries_result.scalars().all())
        if not entries:
            return []

        # Resolve subject names.
        subject_ids = {e.subject_id for e in entries if e.subject_id is not None}
        subject_map: dict[uuid.UUID, str] = {}
        if subject_ids:
            sres = await self.db.execute(select(Subject).where(Subject.id.in_(subject_ids)))
            for s in sres.scalars().all():
                subject_map[s.id] = s.name

        # Resolve child names (across the whole family — only need first names).
        child_ids: set[uuid.UUID] = set()
        for e in entries:
            for cid in (e.child_ids or []):
                child_ids.add(cid)
        child_map: dict[uuid.UUID, str] = {}
        if child_ids:
            cres = await self.db.execute(select(Child).where(Child.id.in_(child_ids)))
            for c in cres.scalars().all():
                child_map[c.id] = c.nickname or c.first_name

        return [
            {
                "id": e.id,
                "subject_id": e.subject_id,
                "subject_name": subject_map.get(e.subject_id) if e.subject_id else None,
                "is_free_time": e.is_free_time,
                "child_ids": list(e.child_ids or []),
                "child_names": [child_map[cid] for cid in (e.child_ids or []) if cid in child_map],
                "day_of_week": e.day_of_week,
                "start_minute": e.start_minute,
                "duration_minutes": e.duration_minutes,
                "priority": e.priority,
                "color": e.color,
                "notes": e.notes,
            }
            for e in entries
        ]

    # --- Helpers ---

    @staticmethod
    def _assert_entry_fits_config(
        day_of_week: int,
        start_minute: int,
        duration_minutes: int,
        template: WeekTemplate,
    ) -> None:
        """Reject entries that fall outside the template's grid configuration."""
        if day_of_week == 5 and not template.include_saturday:
            raise HTTPException(
                status_code=400,
                detail="Saturday is disabled for this routine.",
            )
        if day_of_week == 6 and not template.include_sunday:
            raise HTTPException(
                status_code=400,
                detail="Sunday is disabled for this routine.",
            )
        start_min = template.start_hour * 60
        end_min = template.end_hour * 60
        if start_minute < start_min:
            raise HTTPException(
                status_code=400,
                detail=f"Start time is before the grid start ({template.start_hour:02d}:00).",
            )
        if start_minute + duration_minutes > end_min:
            raise HTTPException(
                status_code=400,
                detail=f"Entry extends past the grid end ({template.end_hour:02d}:00).",
            )

    async def _get_entry(self, entry_id: uuid.UUID, family_id: uuid.UUID) -> RoutineEntry:
        result = await self.db.execute(
            select(RoutineEntry).where(
                RoutineEntry.id == entry_id,
                RoutineEntry.family_id == family_id,
            )
        )
        entry = result.scalars().first()
        if not entry:
            raise HTTPException(status_code=404, detail="Routine entry not found.")
        return entry

    async def _check_conflicts(
        self,
        template_id: uuid.UUID,
        child_ids: list[uuid.UUID],
        day_of_week: int,
        start_minute: int,
        duration_minutes: int,
        exclude_entry_id: uuid.UUID | None = None,
    ) -> None:
        """Check for same-child time overlaps on the same day."""
        end_minute = start_minute + duration_minutes

        query = select(RoutineEntry).where(
            RoutineEntry.template_id == template_id,
            RoutineEntry.day_of_week == day_of_week,
            RoutineEntry.is_free_time == False,
        )
        if exclude_entry_id:
            query = query.where(RoutineEntry.id != exclude_entry_id)

        result = await self.db.execute(query)
        existing = result.scalars().all()

        for entry in existing:
            entry_end = entry.start_minute + entry.duration_minutes
            # Check time overlap
            if start_minute < entry_end and end_minute > entry.start_minute:
                # Check child overlap
                overlapping_children = set(child_ids) & set(entry.child_ids)
                if overlapping_children:
                    raise HTTPException(
                        status_code=409,
                        detail="A child already has a subject scheduled at this time.",
                    )
