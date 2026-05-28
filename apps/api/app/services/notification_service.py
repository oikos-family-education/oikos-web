"""In-app notification service (v2 spec §6).

Fan-out is called from CommunityService.create_topic / create_reply within
the same DB transaction, so we never end up with the post but no notifications
or vice versa.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.community import (
    Community,
    CommunityMember,
    CommunityReply,
    CommunityTopic,
    Notification,
)
from app.models.family import Family
from app.models.family_member import FamilyMember


DEFAULT_LIST_LIMIT = 25
MAX_LIST_LIMIT = 100


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Fan-out (called inline from community_service) ────────────────

    async def fanout_topic_created(
        self,
        community_id: uuid.UUID,
        topic_id: uuid.UUID,
        actor_family_id: uuid.UUID,
    ) -> None:
        await self._fanout(
            community_id=community_id,
            event_type="topic_created",
            topic_id=topic_id,
            reply_id=None,
            actor_family_id=actor_family_id,
        )

    async def fanout_reply_created(
        self,
        community_id: uuid.UUID,
        topic_id: uuid.UUID,
        reply_id: uuid.UUID,
        actor_family_id: uuid.UUID,
    ) -> None:
        await self._fanout(
            community_id=community_id,
            event_type="reply_created",
            topic_id=topic_id,
            reply_id=reply_id,
            actor_family_id=actor_family_id,
        )

    async def _fanout(
        self,
        community_id: uuid.UUID,
        event_type: str,
        topic_id: uuid.UUID,
        reply_id: Optional[uuid.UUID],
        actor_family_id: uuid.UUID,
    ) -> None:
        """One notification row per active, non-actor, non-muted member."""
        res = await self.db.execute(
            select(CommunityMember.family_id).where(
                CommunityMember.community_id == community_id,
                CommunityMember.status == "active",
                CommunityMember.family_id != actor_family_id,
                CommunityMember.notifications_muted.is_(False),
            )
        )
        recipients = [row[0] for row in res.all()]
        if not recipients:
            return
        now = utcnow()
        rows = [
            Notification(
                recipient_family_id=rid,
                community_id=community_id,
                event_type=event_type,
                topic_id=topic_id,
                reply_id=reply_id,
                actor_family_id=actor_family_id,
                created_at=now,
            )
            for rid in recipients
        ]
        self.db.add_all(rows)
        # No commit here — caller controls the transaction.

    # ── Family resolution ─────────────────────────────────────────────

    async def _get_family_for_user(self, user_id: uuid.UUID) -> Family:
        res = await self.db.execute(
            select(Family).join(FamilyMember, FamilyMember.family_id == Family.id)
            .where(FamilyMember.user_id == user_id)
        )
        f = res.scalars().first()
        if not f:
            raise HTTPException(status_code=400, detail="No family configured.")
        return f

    # ── List + unread count + read ────────────────────────────────────

    async def list_notifications(
        self,
        user_id: uuid.UUID,
        unread_only: bool,
        limit: int,
    ) -> dict:
        family = await self._get_family_for_user(user_id)
        limit = max(1, min(limit, MAX_LIST_LIMIT))

        q = (
            select(
                Notification,
                Community.slug, Community.name,
                CommunityTopic.title,
                Family.family_name, Family.shield_config,
            )
            .outerjoin(Community, Community.id == Notification.community_id)
            .outerjoin(CommunityTopic, CommunityTopic.id == Notification.topic_id)
            .outerjoin(Family, Family.id == Notification.actor_family_id)
            .where(Notification.recipient_family_id == family.id)
        )
        if unread_only:
            q = q.where(Notification.read_at.is_(None))
        q = q.order_by(
            Notification.read_at.asc().nulls_first(),
            Notification.created_at.desc(),
        ).limit(limit)

        rows = list((await self.db.execute(q)).all())

        items = []
        for n, slug, cname, topic_title, actor_name, actor_shield in rows:
            items.append({
                "id": n.id,
                "event_type": n.event_type,
                "community_id": n.community_id,
                "community_slug": slug,
                "community_name": cname,
                "topic_id": n.topic_id,
                "topic_title": topic_title,
                "reply_id": n.reply_id,
                "actor_family_id": n.actor_family_id,
                "actor_family_name": actor_name,
                "actor_shield_config": actor_shield,
                "read_at": n.read_at,
                "created_at": n.created_at,
            })

        unread = (await self.db.execute(
            select(func.count()).select_from(Notification).where(
                Notification.recipient_family_id == family.id,
                Notification.read_at.is_(None),
            )
        )).scalar_one()

        return {"items": items, "unread_count": int(unread)}

    async def unread_count(self, user_id: uuid.UUID) -> int:
        family = await self._get_family_for_user(user_id)
        res = await self.db.execute(
            select(func.count()).select_from(Notification).where(
                Notification.recipient_family_id == family.id,
                Notification.read_at.is_(None),
            )
        )
        return int(res.scalar_one() or 0)

    async def mark_read(self, user_id: uuid.UUID, notification_id: uuid.UUID) -> None:
        family = await self._get_family_for_user(user_id)
        res = await self.db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.recipient_family_id == family.id,
            )
        )
        n = res.scalars().first()
        if not n:
            raise HTTPException(status_code=404, detail="Notification not found.")
        if n.read_at is None:
            n.read_at = utcnow()
            await self.db.commit()

    async def mark_all_read(self, user_id: uuid.UUID) -> int:
        family = await self._get_family_for_user(user_id)
        now = utcnow()
        res = await self.db.execute(
            update(Notification)
            .where(
                Notification.recipient_family_id == family.id,
                Notification.read_at.is_(None),
            )
            .values(read_at=now)
        )
        await self.db.commit()
        return res.rowcount or 0
