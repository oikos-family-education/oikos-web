import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException

from app.models.family import Family
from app.models.child import Child
from app.models.user import User
from app.schemas.family import FamilyCreate, FamilyUpdate
from app.schemas.child import ChildCreate, ChildUpdate

class FamilyService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _generate_slug(self, name: str) -> str:
        import re
        base_slug = re.sub(r"[^a-zA-Z0-9\s]", "", name).lower()
        base_slug = re.sub(r"\s+", "-", base_slug.strip())
        final_slug = base_slug
        counter = 0
        while True:
            result = await self.db.execute(select(Family.id).where(Family.family_name_slug == final_slug))
            if not result.scalars().first():
                break
            counter += 1
            final_slug = f"{base_slug}-{counter}"
        return final_slug

    async def get_family_by_account(self, account_id: uuid.UUID) -> Family | None:
        result = await self.db.execute(select(Family).where(Family.account_id == account_id))
        return result.scalars().first()

    async def create_family(self, account_id: uuid.UUID, data: FamilyCreate) -> Family:
        existing = await self.get_family_by_account(account_id)
        if existing:
            raise HTTPException(status_code=400, detail="Account already has a family.")

        slug = await self._generate_slug(data.family_name)
        shield = data.shield_config.model_dump() if data.shield_config else {}

        db_family = Family(
            account_id=account_id,
            family_name=data.family_name,
            family_name_slug=slug,
            shield_config=shield,
            location_city=data.location_city,
            location_region=data.location_region,
            location_country=data.location_country,
            location_country_code=data.location_country_code,
            faith_tradition=data.faith_tradition,
            faith_denomination=data.faith_denomination,
            faith_community_name=data.faith_community_name,
            worldview_notes=data.worldview_notes,
            education_purpose=data.education_purpose,
            education_methods=data.education_methods,
            current_curriculum=data.current_curriculum,
            diet=data.diet,
            screen_policy=data.screen_policy,
            outdoor_orientation=data.outdoor_orientation,
            home_languages=data.home_languages,
            family_culture=data.family_culture,
            visibility="private" if data.visibility is None else data.visibility.value,
        )
        self.db.add(db_family)

        # Update user.has_family = True
        result = await self.db.execute(select(User).where(User.id == account_id))
        user = result.scalars().first()
        if user:
            user.has_family = True

        await self.db.commit()
        await self.db.refresh(db_family)
        return db_family

    async def update_shield(self, account_id: uuid.UUID, shield_config: dict) -> Family:
        family = await self.get_family_by_account(account_id)
        if not family:
            raise HTTPException(status_code=404, detail="Family not configured yet.")

        family.shield_config = shield_config

        # Set has_coat_of_arms flag on user
        result = await self.db.execute(select(User).where(User.id == account_id))
        user = result.scalars().first()
        if user:
            user.has_coat_of_arms = True

        await self.db.commit()
        await self.db.refresh(family)
        return family

    async def get_children(self, family_id: uuid.UUID, include_archived: bool = False) -> list[Child]:
        query = select(Child).where(Child.family_id == family_id)
        if not include_archived:
            query = query.where(Child.archived_at.is_(None))
        query = query.order_by(Child.created_at.asc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_child(self, child_id: uuid.UUID, family_id: uuid.UUID) -> Child:
        result = await self.db.execute(
            select(Child).where(Child.id == child_id, Child.family_id == family_id)
        )
        child = result.scalars().first()
        if not child:
            raise HTTPException(status_code=404, detail="Child not found.")
        return child

    async def update_child(self, child_id: uuid.UUID, family_id: uuid.UUID, data: ChildUpdate) -> Child:
        child = await self.get_child(child_id, family_id)
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(child, key, value)
        await self.db.commit()
        await self.db.refresh(child)
        return child

    async def archive_child(self, child_id: uuid.UUID, family_id: uuid.UUID) -> Child:
        child = await self.get_child(child_id, family_id)
        if child.archived_at is not None:
            raise HTTPException(status_code=400, detail="Child is already archived.")
        child.archived_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(child)
        return child

    async def unarchive_child(self, child_id: uuid.UUID, family_id: uuid.UUID) -> Child:
        child = await self.get_child(child_id, family_id)
        if child.archived_at is None:
            raise HTTPException(status_code=400, detail="Child is not archived.")
        child.archived_at = None
        await self.db.commit()
        await self.db.refresh(child)
        return child

    async def add_child(self, family_id: uuid.UUID, data: ChildCreate) -> Child:
        db_child = Child(
            family_id=family_id,
            first_name=data.first_name,
            nickname=data.nickname,
            gender=data.gender,
            birthdate=data.birthdate,
            birth_year=data.birth_year,
            birth_month=data.birth_month,
            grade_level=data.grade_level,
            child_curriculum=data.child_curriculum,
            learning_styles=data.learning_styles,
            personality_description=data.personality_description,
            personality_tags=data.personality_tags,
            interests=data.interests,
            motivators=data.motivators,
            demotivators=data.demotivators,
            learning_differences=data.learning_differences,
            accommodations_notes=data.accommodations_notes,
            support_services=data.support_services,
        )
        self.db.add(db_child)
        await self.db.commit()
        await self.db.refresh(db_child)
        return db_child
