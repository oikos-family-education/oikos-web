"""Lesson service — CRUD, block management, status transitions, link preview.

Lessons are anchored only to a Subject. Children, curricula, and projects are
derived at query time from the subject's existing relationships:
  * children      — subject → curriculum_subjects → child_curriculums → children
  * curricula     — subject → curriculum_subjects → curriculums
  * projects      — subject → project_subjects → projects
"""
import re
import uuid
from datetime import date
from typing import Optional, Iterable
from urllib.parse import urlparse

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.child import Child
from app.models.curriculum import ChildCurriculum, Curriculum, CurriculumSubject
from app.models.lesson import (
    Lesson, LessonBlock, VALID_BLOCK_TYPES, VALID_LESSON_STATUSES,
)
from app.models.project import Project, ProjectSubject
from app.models.subject import Subject
from app.models.teaching_log import TeachingLog
from app.schemas.lesson import (
    LessonBlockCreate, LessonBlockUpdate, LessonCreate, LessonStatusUpdate,
    LessonUpdate,
)


# Allowed transitions — lessons are linear; cancelled/completed are terminal.
_ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"draft", "scheduled", "in_progress", "completed", "cancelled"},
    "scheduled": {"scheduled", "in_progress", "completed", "cancelled", "draft"},
    "in_progress": {"in_progress", "completed", "cancelled", "scheduled"},
    "completed": {"completed"},
    "cancelled": {"cancelled"},
}


class LessonService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Helpers ──────────────────────────────────────────────────────────

    async def _get_owned(self, lesson_id: uuid.UUID, family_id: uuid.UUID) -> Lesson:
        result = await self.db.execute(select(Lesson).where(Lesson.id == lesson_id))
        lesson = result.scalars().first()
        if not lesson or lesson.family_id != family_id:
            raise HTTPException(status_code=404, detail="Lesson not found.")
        return lesson

    async def _validate_subject(
        self, subject_id: uuid.UUID, family_id: uuid.UUID
    ) -> Subject:
        result = await self.db.execute(select(Subject).where(Subject.id == subject_id))
        subject = result.scalars().first()
        if subject is None:
            raise HTTPException(status_code=404, detail="Subject not found.")
        # Allow either family-owned subjects or platform/public subjects.
        if subject.family_id is not None and subject.family_id != family_id:
            if not (subject.is_platform_subject or subject.is_public):
                raise HTTPException(
                    status_code=403, detail="Subject not accessible by this family."
                )
        return subject

    async def _resolve_subject_relations(
        self, subject_ids: Iterable[uuid.UUID], family_id: uuid.UUID
    ) -> dict[uuid.UUID, dict[str, list[uuid.UUID]]]:
        """For each subject id, find the family-scoped curricula, children, projects."""
        sub_ids = list({s for s in subject_ids if s is not None})
        out: dict[uuid.UUID, dict[str, list[uuid.UUID]]] = {
            sid: {"curriculum_ids": [], "child_ids": [], "project_ids": []}
            for sid in sub_ids
        }
        if not sub_ids:
            return out

        # Curricula (family-scoped). Use CurriculumSubject → Curriculum, filter by family.
        cs_q = (
            select(CurriculumSubject.subject_id, Curriculum.id)
            .join(Curriculum, Curriculum.id == CurriculumSubject.curriculum_id)
            .where(
                CurriculumSubject.subject_id.in_(sub_ids),
                Curriculum.family_id == family_id,
            )
        )
        cs_rows = (await self.db.execute(cs_q)).all()
        # Group curriculum ids per subject.
        sub_to_curr: dict[uuid.UUID, list[uuid.UUID]] = {}
        for sid, cid in cs_rows:
            sub_to_curr.setdefault(sid, []).append(cid)
            out[sid]["curriculum_ids"].append(cid)

        # Children — join through child_curriculums → children to enforce family scope.
        all_curr_ids = {cid for cids in sub_to_curr.values() for cid in cids}
        if all_curr_ids:
            cc_q = (
                select(
                    CurriculumSubject.subject_id,
                    ChildCurriculum.curriculum_id,
                    ChildCurriculum.child_id,
                )
                .join(
                    ChildCurriculum,
                    ChildCurriculum.curriculum_id == CurriculumSubject.curriculum_id,
                )
                .join(Child, Child.id == ChildCurriculum.child_id)
                .where(
                    CurriculumSubject.subject_id.in_(sub_ids),
                    ChildCurriculum.curriculum_id.in_(all_curr_ids),
                    Child.family_id == family_id,
                )
            )
            cc_rows = (await self.db.execute(cc_q)).all()
            for sid, _cid, child_id in cc_rows:
                if child_id not in out[sid]["child_ids"]:
                    out[sid]["child_ids"].append(child_id)

        # Projects (family-scoped) via project_subjects.
        ps_q = (
            select(ProjectSubject.subject_id, Project.id)
            .join(Project, Project.id == ProjectSubject.project_id)
            .where(
                ProjectSubject.subject_id.in_(sub_ids),
                Project.family_id == family_id,
            )
        )
        ps_rows = (await self.db.execute(ps_q)).all()
        for sid, pid in ps_rows:
            if pid not in out[sid]["project_ids"]:
                out[sid]["project_ids"].append(pid)

        return out

    async def _build_subject_minimal(
        self, subject: Subject, family_id: uuid.UUID
    ) -> dict:
        rels = await self._resolve_subject_relations([subject.id], family_id)
        r = rels[subject.id]
        return {
            "id": subject.id,
            "name": subject.name,
            "color": subject.color,
            "icon": subject.icon,
            "curriculum_ids": r["curriculum_ids"],
            "child_ids": r["child_ids"],
            "project_ids": r["project_ids"],
        }

    async def _to_summary(
        self, lesson: Lesson, subject: Subject, family_id: uuid.UUID,
        rels: Optional[dict] = None,
    ) -> dict:
        if rels is None:
            rels = (await self._resolve_subject_relations([subject.id], family_id))[
                subject.id
            ]
        return {
            "id": lesson.id,
            "title": lesson.title,
            "status": lesson.status,
            "scheduled_for": lesson.scheduled_for,
            "estimated_duration_minutes": lesson.estimated_duration_minutes,
            "subject": {
                "id": subject.id,
                "name": subject.name,
                "color": subject.color,
                "icon": subject.icon,
                "curriculum_ids": rels["curriculum_ids"],
                "child_ids": rels["child_ids"],
                "project_ids": rels["project_ids"],
            },
            "tags": list(lesson.tags or []),
        }

    async def _to_response(
        self, lesson: Lesson, subject: Subject, family_id: uuid.UUID,
    ) -> dict:
        # Eager-load blocks ordered by sort_order.
        blocks_q = (
            select(LessonBlock)
            .where(LessonBlock.lesson_id == lesson.id)
            .order_by(LessonBlock.sort_order.asc(), LessonBlock.created_at.asc())
        )
        blocks = (await self.db.execute(blocks_q)).scalars().all()
        summary = await self._to_summary(lesson, subject, family_id)
        summary.update({
            "objectives": list(lesson.objectives or []),
            "actual_duration_minutes": lesson.actual_duration_minutes,
            "completion_notes": lesson.completion_notes,
            "taught_on": lesson.taught_on,
            "blocks": [
                {
                    "id": b.id,
                    "lesson_id": b.lesson_id,
                    "type": b.type,
                    "content": b.content or {},
                    "sort_order": b.sort_order,
                    "created_at": b.created_at,
                    "updated_at": b.updated_at,
                }
                for b in blocks
            ],
            "created_by_user_id": lesson.created_by_user_id,
            "family_id": lesson.family_id,
            "created_at": lesson.created_at,
            "updated_at": lesson.updated_at,
        })
        return summary

    async def _hydrate_summaries(
        self, lessons: list[Lesson], family_id: uuid.UUID
    ) -> list[dict]:
        if not lessons:
            return []
        subj_ids = list({l.subject_id for l in lessons})
        sres = await self.db.execute(select(Subject).where(Subject.id.in_(subj_ids)))
        subjects = {s.id: s for s in sres.scalars().all()}
        rels = await self._resolve_subject_relations(subj_ids, family_id)
        return [
            await self._to_summary(l, subjects[l.subject_id], family_id, rels.get(l.subject_id))
            for l in lessons
            if l.subject_id in subjects
        ]

    # ── Queries ──────────────────────────────────────────────────────────

    async def list_lessons(
        self,
        family_id: uuid.UUID,
        *,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        subject_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
        child_id: Optional[uuid.UUID] = None,
        curriculum_id: Optional[uuid.UUID] = None,
        project_id: Optional[uuid.UUID] = None,
        q: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        if status is not None and status not in VALID_LESSON_STATUSES:
            raise HTTPException(status_code=422, detail=f"Invalid status: {status}")

        query = select(Lesson).where(Lesson.family_id == family_id)
        if from_date:
            query = query.where(Lesson.scheduled_for >= from_date)
        if to_date:
            query = query.where(Lesson.scheduled_for <= to_date)
        if subject_id:
            query = query.where(Lesson.subject_id == subject_id)
        if status:
            query = query.where(Lesson.status == status)
        if q:
            like = f"%{q}%"
            query = query.where(Lesson.title.ilike(like))

        # Indirect filters via subject joins
        if curriculum_id:
            sub_q = (
                select(CurriculumSubject.subject_id)
                .where(CurriculumSubject.curriculum_id == curriculum_id)
            )
            query = query.where(Lesson.subject_id.in_(sub_q))
        if project_id:
            sub_q = (
                select(ProjectSubject.subject_id)
                .where(ProjectSubject.project_id == project_id)
            )
            query = query.where(Lesson.subject_id.in_(sub_q))
        if child_id:
            sub_q = (
                select(CurriculumSubject.subject_id)
                .join(
                    ChildCurriculum,
                    ChildCurriculum.curriculum_id == CurriculumSubject.curriculum_id,
                )
                .where(ChildCurriculum.child_id == child_id)
            )
            query = query.where(Lesson.subject_id.in_(sub_q))

        # Total
        count_query = select(func.count()).select_from(query.subquery())
        total = int((await self.db.execute(count_query)).scalar_one() or 0)

        query = (
            query
            .order_by(Lesson.scheduled_for.asc(), Lesson.created_at.asc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(query)
        lessons = list(result.scalars().all())
        items = await self._hydrate_summaries(lessons, family_id)
        return {"items": items, "total": total}

    async def list_today(self, family_id: uuid.UUID) -> list[dict]:
        today = date.today()
        result = await self.db.execute(
            select(Lesson)
            .where(
                Lesson.family_id == family_id,
                Lesson.scheduled_for == today,
                Lesson.status != "cancelled",
            )
            .order_by(Lesson.created_at.asc())
        )
        lessons = list(result.scalars().all())
        return await self._hydrate_summaries(lessons, family_id)

    async def list_week(
        self, family_id: uuid.UUID, week_start: date
    ) -> dict[str, list[dict]]:
        from datetime import timedelta
        week_end = week_start + timedelta(days=6)
        result = await self.db.execute(
            select(Lesson)
            .where(
                Lesson.family_id == family_id,
                Lesson.scheduled_for >= week_start,
                Lesson.scheduled_for <= week_end,
            )
            .order_by(Lesson.scheduled_for.asc(), Lesson.created_at.asc())
        )
        lessons = list(result.scalars().all())
        summaries = await self._hydrate_summaries(lessons, family_id)
        out: dict[str, list[dict]] = {}
        for i in range(7):
            d = week_start + timedelta(days=i)
            out[d.isoformat()] = []
        for s in summaries:
            key = s["scheduled_for"].isoformat() if hasattr(s["scheduled_for"], "isoformat") else str(s["scheduled_for"])
            out.setdefault(key, []).append(s)
        return out

    async def get_lesson(self, lesson_id: uuid.UUID, family_id: uuid.UUID) -> dict:
        lesson = await self._get_owned(lesson_id, family_id)
        sres = await self.db.execute(select(Subject).where(Subject.id == lesson.subject_id))
        subject = sres.scalars().first()
        if not subject:
            raise HTTPException(status_code=404, detail="Lesson subject not found.")
        return await self._to_response(lesson, subject, family_id)

    # ── Mutations ────────────────────────────────────────────────────────

    async def create_lesson(
        self, family_id: uuid.UUID, user_id: uuid.UUID, data: LessonCreate
    ) -> dict:
        subject = await self._validate_subject(data.subject_id, family_id)
        lesson = Lesson(
            family_id=family_id,
            subject_id=subject.id,
            created_by_user_id=user_id,
            title=data.title,
            scheduled_for=data.scheduled_for,
            estimated_duration_minutes=data.estimated_duration_minutes,
            objectives=list(data.objectives or []),
            tags=list(data.tags or []),
            status="draft",
        )
        self.db.add(lesson)
        await self.db.commit()
        await self.db.refresh(lesson)
        return await self._to_response(lesson, subject, family_id)

    async def update_lesson(
        self, lesson_id: uuid.UUID, family_id: uuid.UUID, data: LessonUpdate
    ) -> dict:
        lesson = await self._get_owned(lesson_id, family_id)
        update = data.model_dump(exclude_unset=True)
        for key, value in update.items():
            setattr(lesson, key, value)
        await self.db.commit()
        await self.db.refresh(lesson)
        sres = await self.db.execute(select(Subject).where(Subject.id == lesson.subject_id))
        subject = sres.scalars().first()
        return await self._to_response(lesson, subject, family_id)

    async def update_status(
        self,
        lesson_id: uuid.UUID,
        family_id: uuid.UUID,
        user_id: uuid.UUID,
        data: LessonStatusUpdate,
    ) -> dict:
        lesson = await self._get_owned(lesson_id, family_id)
        if data.status not in _ALLOWED_TRANSITIONS.get(lesson.status, set()):
            raise HTTPException(
                status_code=422,
                detail=f"Cannot transition from {lesson.status} to {data.status}.",
            )
        lesson.status = data.status
        if data.actual_duration_minutes is not None:
            lesson.actual_duration_minutes = data.actual_duration_minutes
        if data.completion_notes is not None:
            lesson.completion_notes = data.completion_notes
        if data.taught_on is not None:
            lesson.taught_on = data.taught_on
        elif data.status == "completed" and lesson.taught_on is None:
            lesson.taught_on = date.today()

        # Side effect: optional teaching log creation on completion.
        if (
            data.create_teaching_log
            and data.status == "completed"
        ):
            sres = await self.db.execute(
                select(Subject).where(Subject.id == lesson.subject_id)
            )
            subject = sres.scalars().first()
            if subject:
                rels = (await self._resolve_subject_relations(
                    [subject.id], family_id
                ))[subject.id]
                child_ids = rels["child_ids"]
                taught_on = lesson.taught_on or date.today()
                minutes = (
                    lesson.actual_duration_minutes
                    or lesson.estimated_duration_minutes
                    or None
                )
                if child_ids:
                    for cid in child_ids:
                        log = TeachingLog(
                            family_id=family_id,
                            taught_on=taught_on,
                            child_id=cid,
                            subject_id=subject.id,
                            lesson_id=lesson.id,
                            minutes=minutes,
                            notes=lesson.completion_notes,
                            logged_by_user_id=user_id,
                        )
                        self.db.add(log)
                else:
                    log = TeachingLog(
                        family_id=family_id,
                        taught_on=taught_on,
                        child_id=None,
                        subject_id=subject.id,
                        lesson_id=lesson.id,
                        minutes=minutes,
                        notes=lesson.completion_notes,
                        logged_by_user_id=user_id,
                    )
                    self.db.add(log)

        await self.db.commit()
        await self.db.refresh(lesson)
        sres = await self.db.execute(select(Subject).where(Subject.id == lesson.subject_id))
        subject = sres.scalars().first()
        return await self._to_response(lesson, subject, family_id)

    async def delete_lesson(self, lesson_id: uuid.UUID, family_id: uuid.UUID) -> None:
        lesson = await self._get_owned(lesson_id, family_id)
        await self.db.delete(lesson)
        await self.db.commit()

    async def duplicate_lesson(
        self,
        lesson_id: uuid.UUID,
        family_id: uuid.UUID,
        user_id: uuid.UUID,
        scheduled_for: date,
    ) -> dict:
        original = await self._get_owned(lesson_id, family_id)
        new_lesson = Lesson(
            family_id=family_id,
            subject_id=original.subject_id,
            created_by_user_id=user_id,
            title=original.title,
            scheduled_for=scheduled_for,
            estimated_duration_minutes=original.estimated_duration_minutes,
            objectives=list(original.objectives or []),
            tags=list(original.tags or []),
            status="draft",
        )
        self.db.add(new_lesson)
        await self.db.flush()

        # Copy blocks
        bres = await self.db.execute(
            select(LessonBlock)
            .where(LessonBlock.lesson_id == original.id)
            .order_by(LessonBlock.sort_order.asc())
        )
        for b in bres.scalars().all():
            self.db.add(LessonBlock(
                lesson_id=new_lesson.id,
                sort_order=b.sort_order,
                type=b.type,
                content=dict(b.content or {}),
            ))
        await self.db.commit()
        await self.db.refresh(new_lesson)
        sres = await self.db.execute(select(Subject).where(Subject.id == new_lesson.subject_id))
        subject = sres.scalars().first()
        return await self._to_response(new_lesson, subject, family_id)

    # ── Blocks ───────────────────────────────────────────────────────────

    def _validate_block_content(self, block_type: str, content: dict) -> None:
        if block_type == "link":
            url = (content or {}).get("url", "")
            self._validate_url_scheme(url)
        elif block_type in ("image_url", "video_embed"):
            url = (content or {}).get("url", "")
            self._validate_url_scheme(url)

    def _validate_url_scheme(self, url: str) -> None:
        if not url:
            return
        try:
            parsed = urlparse(url)
        except Exception:
            raise HTTPException(status_code=422, detail="Invalid URL.")
        if parsed.scheme.lower() not in ("http", "https"):
            raise HTTPException(
                status_code=422, detail=f"URL scheme not allowed: {parsed.scheme}"
            )

    async def list_blocks(
        self, lesson_id: uuid.UUID, family_id: uuid.UUID
    ) -> list[dict]:
        await self._get_owned(lesson_id, family_id)
        result = await self.db.execute(
            select(LessonBlock)
            .where(LessonBlock.lesson_id == lesson_id)
            .order_by(LessonBlock.sort_order.asc(), LessonBlock.created_at.asc())
        )
        return [
            {
                "id": b.id,
                "lesson_id": b.lesson_id,
                "type": b.type,
                "content": b.content or {},
                "sort_order": b.sort_order,
                "created_at": b.created_at,
                "updated_at": b.updated_at,
            }
            for b in result.scalars().all()
        ]

    async def create_block(
        self, lesson_id: uuid.UUID, family_id: uuid.UUID, data: LessonBlockCreate
    ) -> dict:
        await self._get_owned(lesson_id, family_id)
        if data.type not in VALID_BLOCK_TYPES:
            raise HTTPException(status_code=422, detail=f"Invalid block type: {data.type}")
        self._validate_block_content(data.type, data.content)

        # Auto-assign sort_order if missing → max + 1.
        if data.sort_order is None:
            max_q = select(func.coalesce(func.max(LessonBlock.sort_order), -1)).where(
                LessonBlock.lesson_id == lesson_id
            )
            raw = (await self.db.execute(max_q)).scalar_one()
            current_max = -1 if raw is None else int(raw)
            sort_order = current_max + 1
        else:
            sort_order = int(data.sort_order)

        block = LessonBlock(
            lesson_id=lesson_id,
            sort_order=sort_order,
            type=data.type,
            content=dict(data.content or {}),
        )
        self.db.add(block)
        await self.db.commit()
        await self.db.refresh(block)
        return {
            "id": block.id,
            "lesson_id": block.lesson_id,
            "type": block.type,
            "content": block.content or {},
            "sort_order": block.sort_order,
            "created_at": block.created_at,
            "updated_at": block.updated_at,
        }

    async def update_block(
        self,
        lesson_id: uuid.UUID,
        block_id: uuid.UUID,
        family_id: uuid.UUID,
        data: LessonBlockUpdate,
    ) -> dict:
        await self._get_owned(lesson_id, family_id)
        bres = await self.db.execute(select(LessonBlock).where(LessonBlock.id == block_id))
        block = bres.scalars().first()
        if not block or block.lesson_id != lesson_id:
            raise HTTPException(status_code=404, detail="Block not found.")
        update = data.model_dump(exclude_unset=True)
        if "content" in update and update["content"] is not None:
            self._validate_block_content(block.type, update["content"])
            block.content = dict(update["content"])
        if "sort_order" in update and update["sort_order"] is not None:
            block.sort_order = int(update["sort_order"])
        await self.db.commit()
        await self.db.refresh(block)
        return {
            "id": block.id,
            "lesson_id": block.lesson_id,
            "type": block.type,
            "content": block.content or {},
            "sort_order": block.sort_order,
            "created_at": block.created_at,
            "updated_at": block.updated_at,
        }

    async def reorder_blocks(
        self,
        lesson_id: uuid.UUID,
        family_id: uuid.UUID,
        order: list[uuid.UUID],
    ) -> list[dict]:
        await self._get_owned(lesson_id, family_id)
        # Load all blocks for the lesson.
        bres = await self.db.execute(
            select(LessonBlock).where(LessonBlock.lesson_id == lesson_id)
        )
        blocks = {b.id: b for b in bres.scalars().all()}
        if set(order) != set(blocks.keys()):
            raise HTTPException(
                status_code=422, detail="Reorder list does not match block ids."
            )
        for idx, bid in enumerate(order):
            blocks[bid].sort_order = idx
        await self.db.commit()
        # Return ordered list.
        return await self.list_blocks(lesson_id, family_id)

    async def delete_block(
        self, lesson_id: uuid.UUID, block_id: uuid.UUID, family_id: uuid.UUID
    ) -> None:
        await self._get_owned(lesson_id, family_id)
        bres = await self.db.execute(select(LessonBlock).where(LessonBlock.id == block_id))
        block = bres.scalars().first()
        if not block or block.lesson_id != lesson_id:
            raise HTTPException(status_code=404, detail="Block not found.")
        await self.db.delete(block)
        await self.db.commit()

    # ── Link preview ────────────────────────────────────────────────────

    async def link_preview(self, url: str) -> dict:
        """Server-side fetch and parse Open Graph / <title> metadata.

        Returns empty strings rather than 5xx so the frontend always renders.
        """
        self._validate_url_scheme(url)
        try:
            import httpx  # local import: optional dependency surface
        except Exception:
            return {"url": url, "title": None, "description": None, "favicon_url": None}

        title: Optional[str] = None
        description: Optional[str] = None
        favicon_url: Optional[str] = None
        try:
            async with httpx.AsyncClient(
                timeout=5.0, follow_redirects=True,
                headers={"User-Agent": "Oikos-LinkPreview/1.0"},
            ) as client:
                resp = await client.get(url)
                if resp.status_code >= 400:
                    return {"url": url, "title": None, "description": None, "favicon_url": None}
                html = resp.text[:200_000]
                title = self._extract_title(html)
                description = self._extract_description(html)
                favicon_url = self._extract_favicon(html, url)
        except Exception:
            return {"url": url, "title": None, "description": None, "favicon_url": None}
        return {
            "url": url,
            "title": title,
            "description": description,
            "favicon_url": favicon_url,
        }

    @staticmethod
    def _extract_title(html: str) -> Optional[str]:
        # Try og:title first
        og = re.search(
            r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']',
            html, flags=re.I,
        )
        if og:
            return og.group(1).strip()
        m = re.search(r"<title>([^<]+)</title>", html, flags=re.I | re.S)
        return m.group(1).strip() if m else None

    @staticmethod
    def _extract_description(html: str) -> Optional[str]:
        og = re.search(
            r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)["\']',
            html, flags=re.I,
        )
        if og:
            return og.group(1).strip()
        m = re.search(
            r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']',
            html, flags=re.I,
        )
        return m.group(1).strip() if m else None

    @staticmethod
    def _extract_favicon(html: str, source_url: str) -> Optional[str]:
        m = re.search(
            r'<link[^>]+rel=["\'](?:shortcut )?icon["\'][^>]+href=["\']([^"\']+)["\']',
            html, flags=re.I,
        )
        if not m:
            return None
        href = m.group(1).strip()
        if href.startswith("http://") or href.startswith("https://"):
            return href
        # Resolve relative to source URL origin.
        try:
            parsed = urlparse(source_url)
            origin = f"{parsed.scheme}://{parsed.netloc}"
            if href.startswith("/"):
                return f"{origin}{href}"
            return f"{origin}/{href}"
        except Exception:
            return None
