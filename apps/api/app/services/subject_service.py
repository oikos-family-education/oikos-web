import uuid
import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from fastapi import HTTPException

from app.models.subject import Subject
from app.models.curriculum import CurriculumSubject
from app.schemas.subject import SubjectCreate, SubjectUpdate


def _escape_like(value: str) -> str:
    """Escape special SQL LIKE characters to prevent wildcard injection."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class SubjectService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _generate_slug(self, name: str, family_id: uuid.UUID | None) -> str:
        base_slug = re.sub(r"[^a-zA-Z0-9\s]", "", name).lower()
        base_slug = re.sub(r"\s+", "-", base_slug.strip())
        final_slug = base_slug
        counter = 0
        while True:
            query = select(Subject.id).where(
                Subject.slug == final_slug,
                Subject.family_id == family_id
            )
            result = await self.db.execute(query)
            if not result.scalars().first():
                break
            counter += 1
            final_slug = f"{base_slug}-{counter}"
        return final_slug

    async def list_subjects(
        self,
        family_id: uuid.UUID,
        source: str | None = None,
        category: str | None = None,
        search: str | None = None,
    ) -> list[Subject]:
        query = select(Subject)

        if source == "mine":
            query = query.where(Subject.family_id == family_id)
        elif source == "platform":
            query = query.where(Subject.is_platform_subject == True)
        elif source == "community":
            query = query.where(Subject.is_public == True, Subject.family_id != family_id)
        else:
            # Show family's own + platform + community
            query = query.where(
                (Subject.family_id == family_id) |
                (Subject.is_platform_subject == True) |
                (Subject.is_public == True)
            )

        if category:
            query = query.where(Subject.category == category)

        if search:
            query = query.where(Subject.name.ilike(f"%{_escape_like(search)}%"))

        query = query.order_by(Subject.name)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_subject(self, subject_id: uuid.UUID) -> Subject | None:
        result = await self.db.execute(select(Subject).where(Subject.id == subject_id))
        return result.scalars().first()

    async def create_subject(
        self,
        family_id: uuid.UUID,
        user_id: uuid.UUID,
        data: SubjectCreate,
    ) -> Subject:
        slug = await self._generate_slug(data.name, family_id)
        db_subject = Subject(
            family_id=family_id,
            name=data.name,
            slug=slug,
            short_description=data.short_description,
            long_description=data.long_description,
            category=data.category.value,
            color=data.color,
            icon=data.icon,
            min_age_years=data.min_age_years,
            max_age_years=data.max_age_years,
            min_grade_level=data.min_grade_level,
            max_grade_level=data.max_grade_level,
            default_session_duration_minutes=data.default_session_duration_minutes,
            default_weekly_frequency=data.default_weekly_frequency,
            learning_objectives=data.learning_objectives,
            skills_targeted=data.skills_targeted,
            prerequisite_subject_ids=data.prerequisite_subject_ids,
            is_public=data.is_public,
            is_platform_subject=False,
            created_by_user_id=user_id,
        )
        self.db.add(db_subject)
        await self.db.commit()
        await self.db.refresh(db_subject)
        return db_subject

    async def update_subject(
        self,
        subject_id: uuid.UUID,
        family_id: uuid.UUID,
        data: SubjectUpdate,
    ) -> Subject:
        subject = await self.get_subject(subject_id)
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found.")
        if subject.is_platform_subject:
            raise HTTPException(status_code=403, detail="Platform subjects are read-only. Fork it to customise.")
        if subject.family_id != family_id:
            raise HTTPException(status_code=403, detail="You can only edit your own subjects.")

        update_data = data.model_dump(exclude_unset=True)
        if "name" in update_data:
            update_data["slug"] = await self._generate_slug(update_data["name"], family_id)
        if "category" in update_data and update_data["category"]:
            update_data["category"] = update_data["category"].value

        for key, value in update_data.items():
            setattr(subject, key, value)

        await self.db.commit()
        await self.db.refresh(subject)
        return subject

    async def delete_subject(self, subject_id: uuid.UUID, family_id: uuid.UUID) -> None:
        subject = await self.get_subject(subject_id)
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found.")
        if subject.is_platform_subject:
            raise HTTPException(status_code=403, detail="Cannot delete platform subjects.")
        if subject.family_id != family_id:
            raise HTTPException(status_code=403, detail="You can only delete your own subjects.")

        # Check if subject is in use by any curriculum
        result = await self.db.execute(
            select(func.count()).select_from(CurriculumSubject).where(
                CurriculumSubject.subject_id == subject_id
            )
        )
        count = result.scalar()
        if count and count > 0:
            raise HTTPException(
                status_code=409,
                detail=f"Subject is used in {count} curriculum(s). Remove it from those curricula first, or archive it instead."
            )

        await self.db.delete(subject)
        await self.db.commit()

    async def fork_subject(
        self,
        subject_id: uuid.UUID,
        family_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Subject:
        """Fork a platform or community subject into a family-owned editable copy."""
        source = await self.get_subject(subject_id)
        if not source:
            raise HTTPException(status_code=404, detail="Subject not found.")

        slug = await self._generate_slug(source.name, family_id)
        forked = Subject(
            family_id=family_id,
            name=source.name,
            slug=slug,
            short_description=source.short_description,
            long_description=source.long_description,
            category=source.category,
            color=source.color,
            icon=source.icon,
            min_age_years=source.min_age_years,
            max_age_years=source.max_age_years,
            min_grade_level=source.min_grade_level,
            max_grade_level=source.max_grade_level,
            default_session_duration_minutes=source.default_session_duration_minutes,
            default_weekly_frequency=source.default_weekly_frequency,
            learning_objectives=list(source.learning_objectives) if source.learning_objectives else [],
            skills_targeted=list(source.skills_targeted) if source.skills_targeted else [],
            prerequisite_subject_ids=list(source.prerequisite_subject_ids) if source.prerequisite_subject_ids else [],
            is_platform_subject=False,
            is_public=False,
            created_by_user_id=user_id,
        )
        self.db.add(forked)
        await self.db.commit()
        await self.db.refresh(forked)
        return forked
