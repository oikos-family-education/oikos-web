import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from fastapi import HTTPException

from app.models.resource import Resource, SubjectResource
from app.models.subject import Subject
from app.schemas.resource import ResourceCreate, ResourceUpdate


def _escape_like(value: str) -> str:
    """Escape special SQL LIKE characters to prevent wildcard injection."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class ResourceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_resources(
        self,
        family_id: uuid.UUID,
        resource_type: str | None = None,
        subject_id: uuid.UUID | None = None,
        search: str | None = None,
    ) -> list[dict]:
        query = select(Resource).where(Resource.family_id == family_id)

        if resource_type:
            query = query.where(Resource.type == resource_type)

        if search:
            query = query.where(
                Resource.title.ilike(f"%{_escape_like(search)}%") | Resource.author.ilike(f"%{_escape_like(search)}%")
            )

        query = query.order_by(Resource.title)
        result = await self.db.execute(query)
        resources = list(result.scalars().all())

        # If filtering by subject, narrow down via junction table
        if subject_id:
            sr_result = await self.db.execute(
                select(SubjectResource.resource_id).where(SubjectResource.subject_id == subject_id)
            )
            linked_ids = {row for row in sr_result.scalars().all()}
            resources = [r for r in resources if r.id in linked_ids]

        # Attach subject links to each resource
        return [await self._enrich_resource(r) for r in resources]

    async def get_resource(self, resource_id: uuid.UUID, family_id: uuid.UUID) -> dict:
        result = await self.db.execute(
            select(Resource).where(Resource.id == resource_id, Resource.family_id == family_id)
        )
        resource = result.scalars().first()
        if not resource:
            raise HTTPException(status_code=404, detail="Resource not found.")
        return await self._enrich_resource(resource)

    async def create_resource(self, family_id: uuid.UUID, data: ResourceCreate) -> dict:
        db_resource = Resource(
            family_id=family_id,
            title=data.title,
            type=data.type.value,
            author=data.author,
            description=data.description,
            url=data.url,
        )
        self.db.add(db_resource)
        await self.db.flush()

        # Create subject links
        for sid in data.subject_ids:
            self.db.add(SubjectResource(subject_id=sid, resource_id=db_resource.id))

        await self.db.commit()
        await self.db.refresh(db_resource)
        return await self._enrich_resource(db_resource)

    async def update_resource(
        self,
        resource_id: uuid.UUID,
        family_id: uuid.UUID,
        data: ResourceUpdate,
    ) -> dict:
        result = await self.db.execute(
            select(Resource).where(Resource.id == resource_id, Resource.family_id == family_id)
        )
        resource = result.scalars().first()
        if not resource:
            raise HTTPException(status_code=404, detail="Resource not found.")

        update_data = data.model_dump(exclude_unset=True)

        # Handle subject_ids separately
        subject_ids = update_data.pop("subject_ids", None)

        if "type" in update_data and update_data["type"]:
            update_data["type"] = update_data["type"].value

        for key, value in update_data.items():
            setattr(resource, key, value)

        # Sync subject links if provided
        if subject_ids is not None:
            await self.db.execute(
                delete(SubjectResource).where(SubjectResource.resource_id == resource_id)
            )
            for sid in subject_ids:
                self.db.add(SubjectResource(subject_id=sid, resource_id=resource_id))

        await self.db.commit()
        await self.db.refresh(resource)
        return await self._enrich_resource(resource)

    async def delete_resource(self, resource_id: uuid.UUID, family_id: uuid.UUID) -> None:
        result = await self.db.execute(
            select(Resource).where(Resource.id == resource_id, Resource.family_id == family_id)
        )
        resource = result.scalars().first()
        if not resource:
            raise HTTPException(status_code=404, detail="Resource not found.")

        await self.db.delete(resource)
        await self.db.commit()

    async def update_progress(
        self,
        resource_id: uuid.UUID,
        subject_id: uuid.UUID,
        family_id: uuid.UUID,
        progress_notes: str | None,
    ) -> dict:
        # Verify resource belongs to family
        res_result = await self.db.execute(
            select(Resource).where(Resource.id == resource_id, Resource.family_id == family_id)
        )
        if not res_result.scalars().first():
            raise HTTPException(status_code=404, detail="Resource not found.")

        result = await self.db.execute(
            select(SubjectResource).where(
                SubjectResource.subject_id == subject_id,
                SubjectResource.resource_id == resource_id,
            )
        )
        link = result.scalars().first()
        if not link:
            raise HTTPException(status_code=404, detail="Subject-resource link not found.")

        link.progress_notes = progress_notes
        await self.db.commit()
        await self.db.refresh(link)
        return {"subject_id": subject_id, "resource_id": resource_id, "progress_notes": link.progress_notes, "updated_at": link.updated_at}

    async def list_resources_for_subject(self, subject_id: uuid.UUID, family_id: uuid.UUID) -> list[dict]:
        result = await self.db.execute(
            select(SubjectResource, Resource)
            .join(Resource, SubjectResource.resource_id == Resource.id)
            .where(SubjectResource.subject_id == subject_id, Resource.family_id == family_id)
            .order_by(Resource.title)
        )
        rows = result.all()
        items = []
        for sr, resource in rows:
            items.append({
                "id": resource.id,
                "title": resource.title,
                "type": resource.type,
                "author": resource.author,
                "url": resource.url,
                "progress_notes": sr.progress_notes,
                "progress_updated_at": sr.updated_at,
            })
        return items

    async def add_resource_to_subject(
        self, resource_id: uuid.UUID, subject_id: uuid.UUID, family_id: uuid.UUID
    ) -> None:
        # Verify resource belongs to family
        res_result = await self.db.execute(
            select(Resource).where(Resource.id == resource_id, Resource.family_id == family_id)
        )
        if not res_result.scalars().first():
            raise HTTPException(status_code=404, detail="Resource not found.")

        # Check not already linked
        existing = await self.db.execute(
            select(SubjectResource).where(
                SubjectResource.subject_id == subject_id,
                SubjectResource.resource_id == resource_id,
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=409, detail="Resource already linked to this subject.")

        self.db.add(SubjectResource(subject_id=subject_id, resource_id=resource_id))
        await self.db.commit()

    async def remove_resource_from_subject(
        self, resource_id: uuid.UUID, subject_id: uuid.UUID, family_id: uuid.UUID
    ) -> None:
        # Verify resource belongs to family
        res_result = await self.db.execute(
            select(Resource).where(Resource.id == resource_id, Resource.family_id == family_id)
        )
        if not res_result.scalars().first():
            raise HTTPException(status_code=404, detail="Resource not found.")

        await self.db.execute(
            delete(SubjectResource).where(
                SubjectResource.subject_id == subject_id,
                SubjectResource.resource_id == resource_id,
            )
        )
        await self.db.commit()

    async def _enrich_resource(self, resource: Resource) -> dict:
        """Attach subject links with names to a resource."""
        sr_result = await self.db.execute(
            select(SubjectResource, Subject.name)
            .join(Subject, SubjectResource.subject_id == Subject.id)
            .where(SubjectResource.resource_id == resource.id)
            .order_by(Subject.name)
        )
        subjects = []
        for sr, subject_name in sr_result.all():
            subjects.append({
                "subject_id": sr.subject_id,
                "subject_name": subject_name,
                "progress_notes": sr.progress_notes,
                "updated_at": sr.updated_at,
            })

        return {
            "id": resource.id,
            "family_id": resource.family_id,
            "title": resource.title,
            "type": resource.type,
            "author": resource.author,
            "description": resource.description,
            "url": resource.url,
            "subjects": subjects,
            "created_at": resource.created_at,
            "updated_at": resource.updated_at,
        }
