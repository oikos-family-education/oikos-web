import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from fastapi import HTTPException

from app.models.curriculum import Curriculum, CurriculumSubject, ChildCurriculum
from app.schemas.curriculum import (
    CurriculumCreate, CurriculumUpdate, CurriculumSubjectCreate,
    CurriculumSubjectUpdate,
)


class CurriculumService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _eager_query(self):
        return select(Curriculum).options(
            selectinload(Curriculum.curriculum_subjects),
            selectinload(Curriculum.child_curriculums),
        )

    async def list_curriculums(self, family_id: uuid.UUID) -> list[Curriculum]:
        query = self._eager_query().where(Curriculum.family_id == family_id).order_by(Curriculum.created_at.desc())
        result = await self.db.execute(query)
        return list(result.scalars().unique().all())

    async def list_templates(self, family_id: uuid.UUID | None = None) -> list[Curriculum]:
        """List platform templates and optionally family templates."""
        query = self._eager_query().where(Curriculum.status == "template")
        if family_id:
            query = query.where(
                (Curriculum.family_id == None) | (Curriculum.family_id == family_id)
            )
        else:
            query = query.where(Curriculum.family_id == None)
        query = query.order_by(Curriculum.name)
        result = await self.db.execute(query)
        return list(result.scalars().unique().all())

    async def get_curriculum(self, curriculum_id: uuid.UUID) -> Curriculum | None:
        result = await self.db.execute(
            self._eager_query().where(Curriculum.id == curriculum_id)
        )
        return result.scalars().unique().first()

    async def create_curriculum(
        self,
        family_id: uuid.UUID,
        user_id: uuid.UUID,
        data: CurriculumCreate,
    ) -> Curriculum:
        db_curriculum = Curriculum(
            family_id=family_id,
            name=data.name,
            description=data.description,
            period_type=data.period_type.value,
            start_date=data.start_date,
            end_date=data.end_date,
            academic_year=data.academic_year,
            term_name=data.term_name,
            education_philosophy=data.education_philosophy,
            status="draft",
            overall_goals=data.overall_goals,
            notes=data.notes,
            created_by_user_id=user_id,
        )
        self.db.add(db_curriculum)
        await self.db.flush()

        # Add subjects
        for i, subj_data in enumerate(data.subjects):
            cs = CurriculumSubject(
                curriculum_id=db_curriculum.id,
                subject_id=subj_data.subject_id,
                weekly_frequency=subj_data.weekly_frequency,
                session_duration_minutes=subj_data.session_duration_minutes,
                scheduled_days=subj_data.scheduled_days,
                preferred_time_slot=subj_data.preferred_time_slot.value,
                goals_for_period=subj_data.goals_for_period,
                sort_order=subj_data.sort_order if subj_data.sort_order else i,
                notes=subj_data.notes,
            )
            self.db.add(cs)

        # Assign children
        for child_id in data.child_ids:
            cc = ChildCurriculum(
                child_id=child_id,
                curriculum_id=db_curriculum.id,
            )
            self.db.add(cc)

        await self.db.commit()

        # Re-fetch with relationships
        return await self.get_curriculum(db_curriculum.id)

    async def update_curriculum(
        self,
        curriculum_id: uuid.UUID,
        family_id: uuid.UUID,
        data: CurriculumUpdate,
    ) -> Curriculum:
        curriculum = await self.get_curriculum(curriculum_id)
        if not curriculum:
            raise HTTPException(status_code=404, detail="Curriculum not found.")
        if curriculum.family_id != family_id:
            raise HTTPException(status_code=403, detail="You can only edit your own curriculums.")

        update_data = data.model_dump(exclude_unset=True)
        if "period_type" in update_data and update_data["period_type"]:
            update_data["period_type"] = update_data["period_type"].value

        for key, value in update_data.items():
            setattr(curriculum, key, value)

        await self.db.commit()
        return await self.get_curriculum(curriculum_id)

    async def update_status(
        self,
        curriculum_id: uuid.UUID,
        family_id: uuid.UUID,
        new_status: str,
        force: bool = False,
    ) -> Curriculum:
        curriculum = await self.get_curriculum(curriculum_id)
        if not curriculum:
            raise HTTPException(status_code=404, detail="Curriculum not found.")
        if curriculum.family_id != family_id:
            raise HTTPException(status_code=403, detail="You can only modify your own curriculums.")

        old_status = curriculum.status

        # Validate transitions
        valid_transitions = {
            "draft": ["active", "archived", "template"],
            "active": ["paused", "completed", "archived"],
            "paused": ["active", "completed", "archived"],
            "completed": ["archived"],
            "archived": ["draft"],
            "template": ["draft"],
        }
        allowed = valid_transitions.get(old_status, [])
        if new_status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition from '{old_status}' to '{new_status}'."
            )

        # Activate: check one-active-per-child constraint
        if new_status == "active":
            for cc in curriculum.child_curriculums:
                result = await self.db.execute(
                    select(ChildCurriculum).join(Curriculum).where(
                        ChildCurriculum.child_id == cc.child_id,
                        Curriculum.status == "active",
                        Curriculum.id != curriculum_id,
                    )
                )
                conflict = result.scalars().first()
                if conflict:
                    if force:
                        # Deactivate the conflicting curriculum by pausing it
                        conflict_curriculum = await self.get_curriculum(conflict.curriculum_id)
                        if conflict_curriculum:
                            conflict_curriculum.status = "paused"
                    else:
                        raise HTTPException(
                            status_code=409,
                            detail=f"Child {cc.child_id} already has an active curriculum."
                        )

        # Template: remove all child assignments
        if new_status == "template":
            for cc in list(curriculum.child_curriculums):
                await self.db.delete(cc)

        curriculum.status = new_status
        await self.db.commit()
        return await self.get_curriculum(curriculum_id)

    async def delete_curriculum(self, curriculum_id: uuid.UUID, family_id: uuid.UUID) -> None:
        curriculum = await self.get_curriculum(curriculum_id)
        if not curriculum:
            raise HTTPException(status_code=404, detail="Curriculum not found.")
        if curriculum.family_id != family_id:
            raise HTTPException(status_code=403, detail="You can only delete your own curriculums.")
        if curriculum.status not in ("draft", "template"):
            raise HTTPException(
                status_code=400,
                detail="Only draft or template curriculums can be deleted."
            )

        await self.db.delete(curriculum)
        await self.db.commit()

    async def apply_template(
        self,
        template_id: uuid.UUID,
        family_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Curriculum:
        """Create a new draft curriculum from a template, copying all subjects."""
        template = await self.get_curriculum(template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found.")
        if template.status != "template":
            raise HTTPException(status_code=400, detail="Only templates can be applied.")

        new_curriculum = Curriculum(
            family_id=family_id,
            name=template.name,
            description=template.description,
            period_type=template.period_type,
            start_date=template.start_date,
            end_date=template.end_date,
            academic_year=template.academic_year,
            term_name=template.term_name,
            education_philosophy=template.education_philosophy,
            status="draft",
            overall_goals=list(template.overall_goals) if template.overall_goals else [],
            notes=template.notes,
            created_by_user_id=user_id,
        )
        self.db.add(new_curriculum)
        await self.db.flush()

        # Copy subjects
        for cs in template.curriculum_subjects:
            new_cs = CurriculumSubject(
                curriculum_id=new_curriculum.id,
                subject_id=cs.subject_id,
                weekly_frequency=cs.weekly_frequency,
                session_duration_minutes=cs.session_duration_minutes,
                scheduled_days=list(cs.scheduled_days) if cs.scheduled_days else [],
                preferred_time_slot=cs.preferred_time_slot,
                goals_for_period=list(cs.goals_for_period) if cs.goals_for_period else [],
                sort_order=cs.sort_order,
                notes=cs.notes,
            )
            self.db.add(new_cs)

        await self.db.commit()
        return await self.get_curriculum(new_curriculum.id)

    # --- Curriculum Subject management ---

    async def add_subject_to_curriculum(
        self,
        curriculum_id: uuid.UUID,
        family_id: uuid.UUID,
        data: CurriculumSubjectCreate,
    ) -> CurriculumSubject:
        curriculum = await self.get_curriculum(curriculum_id)
        if not curriculum:
            raise HTTPException(status_code=404, detail="Curriculum not found.")
        if curriculum.family_id != family_id:
            raise HTTPException(status_code=403, detail="You can only modify your own curriculums.")

        # Check for duplicate
        result = await self.db.execute(
            select(CurriculumSubject).where(
                CurriculumSubject.curriculum_id == curriculum_id,
                CurriculumSubject.subject_id == data.subject_id,
            )
        )
        if result.scalars().first():
            raise HTTPException(status_code=409, detail="Subject already in this curriculum.")

        cs = CurriculumSubject(
            curriculum_id=curriculum_id,
            subject_id=data.subject_id,
            weekly_frequency=data.weekly_frequency,
            session_duration_minutes=data.session_duration_minutes,
            scheduled_days=data.scheduled_days,
            preferred_time_slot=data.preferred_time_slot.value,
            goals_for_period=data.goals_for_period,
            sort_order=data.sort_order,
            notes=data.notes,
        )
        self.db.add(cs)
        await self.db.commit()
        await self.db.refresh(cs)
        return cs

    async def update_curriculum_subject(
        self,
        curriculum_subject_id: uuid.UUID,
        family_id: uuid.UUID,
        data: CurriculumSubjectUpdate,
    ) -> CurriculumSubject:
        result = await self.db.execute(
            select(CurriculumSubject).where(CurriculumSubject.id == curriculum_subject_id)
        )
        cs = result.scalars().first()
        if not cs:
            raise HTTPException(status_code=404, detail="Curriculum subject not found.")

        # Verify ownership
        curriculum = await self.get_curriculum(cs.curriculum_id)
        if not curriculum or curriculum.family_id != family_id:
            raise HTTPException(status_code=403, detail="You can only modify your own curriculums.")

        update_data = data.model_dump(exclude_unset=True)
        if "preferred_time_slot" in update_data and update_data["preferred_time_slot"]:
            update_data["preferred_time_slot"] = update_data["preferred_time_slot"].value

        for key, value in update_data.items():
            setattr(cs, key, value)

        await self.db.commit()
        await self.db.refresh(cs)
        return cs

    async def remove_subject_from_curriculum(
        self,
        curriculum_subject_id: uuid.UUID,
        family_id: uuid.UUID,
    ) -> None:
        result = await self.db.execute(
            select(CurriculumSubject).where(CurriculumSubject.id == curriculum_subject_id)
        )
        cs = result.scalars().first()
        if not cs:
            raise HTTPException(status_code=404, detail="Curriculum subject not found.")

        curriculum = await self.get_curriculum(cs.curriculum_id)
        if not curriculum or curriculum.family_id != family_id:
            raise HTTPException(status_code=403, detail="You can only modify your own curriculums.")

        await self.db.delete(cs)
        await self.db.commit()

    # --- Child assignment ---

    async def assign_child(
        self,
        curriculum_id: uuid.UUID,
        child_id: uuid.UUID,
        family_id: uuid.UUID,
    ) -> ChildCurriculum:
        curriculum = await self.get_curriculum(curriculum_id)
        if not curriculum:
            raise HTTPException(status_code=404, detail="Curriculum not found.")
        if curriculum.family_id != family_id:
            raise HTTPException(status_code=403, detail="You can only modify your own curriculums.")
        if curriculum.status == "template":
            raise HTTPException(status_code=400, detail="Cannot assign children to a template.")

        # Check duplicate
        result = await self.db.execute(
            select(ChildCurriculum).where(
                ChildCurriculum.child_id == child_id,
                ChildCurriculum.curriculum_id == curriculum_id,
            )
        )
        if result.scalars().first():
            raise HTTPException(status_code=409, detail="Child already assigned to this curriculum.")

        # Check one-active constraint if curriculum is active
        if curriculum.status == "active":
            result = await self.db.execute(
                select(ChildCurriculum).join(Curriculum).where(
                    ChildCurriculum.child_id == child_id,
                    Curriculum.status == "active",
                )
            )
            if result.scalars().first():
                raise HTTPException(
                    status_code=409,
                    detail="Child already has an active curriculum. Resolve it first."
                )

        cc = ChildCurriculum(child_id=child_id, curriculum_id=curriculum_id)
        self.db.add(cc)
        await self.db.commit()
        await self.db.refresh(cc)
        return cc

    async def unassign_child(
        self,
        curriculum_id: uuid.UUID,
        child_id: uuid.UUID,
        family_id: uuid.UUID,
    ) -> None:
        curriculum = await self.get_curriculum(curriculum_id)
        if not curriculum:
            raise HTTPException(status_code=404, detail="Curriculum not found.")
        if curriculum.family_id != family_id:
            raise HTTPException(status_code=403, detail="You can only modify your own curriculums.")

        result = await self.db.execute(
            select(ChildCurriculum).where(
                ChildCurriculum.child_id == child_id,
                ChildCurriculum.curriculum_id == curriculum_id,
            )
        )
        cc = result.scalars().first()
        if not cc:
            raise HTTPException(status_code=404, detail="Child not assigned to this curriculum.")

        await self.db.delete(cc)
        await self.db.commit()
