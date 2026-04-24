import uuid
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_, and_, cast, String as SAString
from fastapi import HTTPException

from app.models.note import Note
from app.models.user import User
from app.models.child import Child
from app.models.subject import Subject
from app.models.resource import Resource
from app.models.project import Project
from app.models.calendar import CalendarEvent
from app.schemas.note import (
    NoteCreate, NoteUpdate, VALID_STATUSES, VALID_ENTITY_TYPES,
)


class NoteService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Helpers ──

    def _validate_status(self, status: str | None):
        if status is None:
            return
        if status not in VALID_STATUSES:
            raise HTTPException(status_code=422, detail=f"Invalid status: {status}")

    def _validate_entity_type(self, entity_type: str | None):
        if entity_type is None:
            return
        if entity_type not in VALID_ENTITY_TYPES:
            raise HTTPException(status_code=422, detail=f"Invalid entity_type: {entity_type}")

    async def _validate_entity_exists(
        self, entity_type: str | None, entity_id: uuid.UUID | None, family_id: uuid.UUID
    ):
        """Ensure the referenced entity exists AND belongs to the same family."""
        if entity_type is None and entity_id is None:
            return
        if entity_id is None:
            # entity_type set but no id -> store as general link (shouldn't really happen)
            return
        if entity_type is None:
            raise HTTPException(status_code=422, detail="entity_type required when entity_id is given.")

        model_by_type = {
            "child": Child,
            "subject": Subject,
            "resource": Resource,
            "project": Project,
            "event": CalendarEvent,
        }
        model = model_by_type.get(entity_type)
        if model is None:
            raise HTTPException(status_code=422, detail=f"Invalid entity_type: {entity_type}")

        result = await self.db.execute(
            select(model).where(model.id == entity_id, model.family_id == family_id)
        )
        entity = result.scalars().first()
        if entity is None:
            raise HTTPException(status_code=404, detail=f"{entity_type} not found in your family.")

    async def _resolve_labels(self, notes: list[Note]) -> tuple[dict, dict]:
        """Return (user_id -> display_name, (entity_type, entity_id) -> label)."""
        user_ids = {n.author_user_id for n in notes if n.author_user_id is not None}
        user_map: dict[uuid.UUID, str] = {}
        if user_ids:
            ures = await self.db.execute(select(User).where(User.id.in_(user_ids)))
            for u in ures.scalars().all():
                parts = [p for p in [u.first_name, u.last_name] if p]
                user_map[u.id] = " ".join(parts) if parts else (u.email or "")

        # Group entity_ids by type so we only do one query per type
        by_type: dict[str, set[uuid.UUID]] = {}
        for n in notes:
            if n.entity_type and n.entity_id:
                by_type.setdefault(n.entity_type, set()).add(n.entity_id)

        model_by_type = {
            "child": Child,
            "subject": Subject,
            "resource": Resource,
            "project": Project,
            "event": CalendarEvent,
        }
        label_map: dict[tuple[str, uuid.UUID], str] = {}
        for etype, ids in by_type.items():
            model = model_by_type.get(etype)
            if not model or not ids:
                continue
            res = await self.db.execute(select(model).where(model.id.in_(ids)))
            for item in res.scalars().all():
                if etype == "child":
                    lbl = item.nickname or item.first_name or ""
                elif etype in ("subject",):
                    lbl = item.name or ""
                else:
                    lbl = getattr(item, "title", None) or getattr(item, "name", None) or ""
                label_map[(etype, item.id)] = lbl

        return user_map, label_map

    def _to_response(self, note: Note, user_map: dict, label_map: dict) -> dict:
        entity_label = None
        if note.entity_type and note.entity_id:
            entity_label = label_map.get((note.entity_type, note.entity_id))
        return {
            "id": note.id,
            "family_id": note.family_id,
            "author_user_id": note.author_user_id,
            "author_name": user_map.get(note.author_user_id) if note.author_user_id else None,
            "title": note.title,
            "content": note.content,
            "status": note.status,
            "entity_type": note.entity_type,
            "entity_id": note.entity_id,
            "entity_label": entity_label,
            "tags": list(note.tags or []),
            "is_pinned": note.is_pinned,
            "due_date": note.due_date,
            "created_at": note.created_at,
            "updated_at": note.updated_at,
        }

    async def _get_owned(self, note_id: uuid.UUID, family_id: uuid.UUID) -> Note:
        result = await self.db.execute(select(Note).where(Note.id == note_id))
        note = result.scalars().first()
        if not note or note.family_id != family_id:
            raise HTTPException(status_code=404, detail="Note not found.")
        return note

    # ── Queries ──

    async def list_notes(
        self,
        family_id: uuid.UUID,
        *,
        statuses: list[str] | None = None,
        entity_type: str | None = None,
        entity_id: uuid.UUID | None = None,
        author_user_id: uuid.UUID | None = None,
        tags: list[str] | None = None,
        pinned: bool | None = None,
        due_before: date | None = None,
        overdue: bool = False,
        q: str | None = None,
        sort: str = "created_at_desc",
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        if statuses:
            for s in statuses:
                self._validate_status(s)
        self._validate_entity_type(entity_type)

        query = select(Note).where(Note.family_id == family_id)

        if statuses:
            query = query.where(Note.status.in_(statuses))
        if entity_type:
            query = query.where(Note.entity_type == entity_type)
        if entity_id:
            query = query.where(Note.entity_id == entity_id)
        if author_user_id:
            query = query.where(Note.author_user_id == author_user_id)
        if pinned is True:
            query = query.where(Note.is_pinned.is_(True))
        if due_before:
            query = query.where(Note.due_date.is_not(None)).where(Note.due_date <= due_before)
        if overdue:
            today = date.today()
            query = query.where(
                Note.due_date.is_not(None),
                Note.due_date < today,
                Note.status.in_(["todo", "in_progress"]),
            )
        if tags:
            # ALL tags must be present
            for tag in tags:
                query = query.where(Note.tags.any(tag))
        if q:
            like = f"%{q}%"
            query = query.where(or_(Note.title.ilike(like), Note.content.ilike(like)))

        # Count for pagination
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_query)).scalar_one()

        # Sort: pinned always first
        sort_map = {
            "created_at_desc": Note.created_at.desc(),
            "created_at_asc": Note.created_at.asc(),
            "updated_at_desc": Note.updated_at.desc(),
            "due_date_asc": Note.due_date.asc().nullslast() if hasattr(Note.due_date.asc(), "nullslast") else Note.due_date.asc(),
        }
        order = sort_map.get(sort, Note.created_at.desc())
        query = query.order_by(Note.is_pinned.desc(), order).limit(limit).offset(offset)

        result = await self.db.execute(query)
        notes = list(result.scalars().all())

        user_map, label_map = await self._resolve_labels(notes)
        return {
            "items": [self._to_response(n, user_map, label_map) for n in notes],
            "total": total,
        }

    async def get_note(self, note_id: uuid.UUID, family_id: uuid.UUID) -> dict:
        note = await self._get_owned(note_id, family_id)
        user_map, label_map = await self._resolve_labels([note])
        return self._to_response(note, user_map, label_map)

    async def upcoming_count(self, family_id: uuid.UUID, days_ahead: int = 3) -> int:
        from datetime import timedelta
        cutoff = date.today() + timedelta(days=days_ahead)
        result = await self.db.execute(
            select(func.count()).select_from(Note).where(
                Note.family_id == family_id,
                Note.status.in_(["todo", "in_progress"]),
                Note.due_date.is_not(None),
                Note.due_date <= cutoff,
            )
        )
        return int(result.scalar_one() or 0)

    async def list_tags(self, family_id: uuid.UUID) -> list[str]:
        """Return the distinct set of tags used by this family."""
        result = await self.db.execute(
            select(Note.tags).where(Note.family_id == family_id)
        )
        seen: set[str] = set()
        for row in result.scalars().all():
            for t in (row or []):
                if t:
                    seen.add(t)
        return sorted(seen)

    # ── Mutations ──

    async def create_note(
        self, family_id: uuid.UUID, author_user_id: uuid.UUID, data: NoteCreate
    ) -> dict:
        self._validate_status(data.status)
        self._validate_entity_type(data.entity_type)
        await self._validate_entity_exists(data.entity_type, data.entity_id, family_id)

        note = Note(
            family_id=family_id,
            author_user_id=author_user_id,
            title=data.title,
            content=data.content,
            status=data.status or "draft",
            entity_type=data.entity_type,
            entity_id=data.entity_id,
            tags=list(data.tags or []),
            is_pinned=bool(data.is_pinned),
            due_date=data.due_date,
        )
        self.db.add(note)
        await self.db.commit()
        await self.db.refresh(note)

        user_map, label_map = await self._resolve_labels([note])
        return self._to_response(note, user_map, label_map)

    async def update_note(
        self, note_id: uuid.UUID, family_id: uuid.UUID, data: NoteUpdate
    ) -> dict:
        note = await self._get_owned(note_id, family_id)
        update_data = data.model_dump(exclude_unset=True)

        if "status" in update_data:
            self._validate_status(update_data["status"])

        # Validate entity linking
        new_type = update_data.get("entity_type", note.entity_type) if "entity_type" in update_data or "entity_id" in update_data else note.entity_type
        new_id = update_data.get("entity_id", note.entity_id) if "entity_type" in update_data or "entity_id" in update_data else note.entity_id

        if "entity_type" in update_data or "entity_id" in update_data:
            self._validate_entity_type(new_type)
            if new_id is not None:
                await self._validate_entity_exists(new_type, new_id, family_id)

        for key, value in update_data.items():
            setattr(note, key, value)

        await self.db.commit()
        await self.db.refresh(note)

        user_map, label_map = await self._resolve_labels([note])
        return self._to_response(note, user_map, label_map)

    async def delete_note(self, note_id: uuid.UUID, family_id: uuid.UUID) -> None:
        note = await self._get_owned(note_id, family_id)
        await self.db.delete(note)
        await self.db.commit()
