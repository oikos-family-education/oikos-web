"""Family-to-family messaging service.

Spec: docs/superpowers/specs/2026-05-28-family-messages-design.md

This module owns:
  - Thread creation / reopen with canonical pair invariant.
  - Per-thread read state via MessageThreadParticipant.
  - Mutual block enforcement (`is_blocked` checks both directions).
  - First-contact gate (discoverable OR shared community).
  - 5-new-threads-per-24h soft rate limit, in-DB (no Redis dep so tests stay
    deterministic without monkey-patching Redis).
  - Notification fan-out to the other side via NotificationService.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.community import CommunityMember, Notification
from app.models.family import Family
from app.models.family_member import FamilyMember
from app.models.message import (
    FamilyBlock,
    MessageItem,
    MessageReport,
    MessageThread,
    MessageThreadParticipant,
)


EXCERPT_LEN = 120
DEFAULT_INBOX_PAGE_SIZE = 25
MAX_INBOX_PAGE_SIZE = 100
DEFAULT_MESSAGES_PAGE_SIZE = 50
MAX_MESSAGES_PAGE_SIZE = 200
NEW_THREADS_PER_24H = 5


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _canonical_pair(a: uuid.UUID, b: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    """Order a pair of family ids lexicographically (a < b)."""
    if a == b:
        raise HTTPException(status_code=422, detail="Cannot message your own family.")
    if str(a) < str(b):
        return a, b
    return b, a


def _excerpt(text: str) -> str:
    text = (text or "").replace("\n", " ").strip()
    if len(text) <= EXCERPT_LEN:
        return text
    return text[: EXCERPT_LEN - 1].rstrip() + "…"


class MessageService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Family resolution ─────────────────────────────────────────────

    async def get_family_for_user(self, user_id: uuid.UUID) -> Family:
        res = await self.db.execute(
            select(Family).join(FamilyMember, FamilyMember.family_id == Family.id)
            .where(FamilyMember.user_id == user_id)
        )
        f = res.scalars().first()
        if not f:
            raise HTTPException(
                status_code=400,
                detail="You must have a family before using messages.",
            )
        return f

    async def _family_by_id(self, family_id: uuid.UUID) -> Family:
        res = await self.db.execute(select(Family).where(Family.id == family_id))
        f = res.scalars().first()
        if not f:
            raise HTTPException(status_code=404, detail="Family not found.")
        return f

    # ── Block checks ──────────────────────────────────────────────────

    async def is_blocked(self, a: uuid.UUID, b: uuid.UUID) -> tuple[bool, bool]:
        """Returns (a_blocked_b, b_blocked_a). Mutual enforcement uses `any`."""
        res = await self.db.execute(
            select(FamilyBlock.blocker_family_id, FamilyBlock.blocked_family_id).where(
                or_(
                    and_(
                        FamilyBlock.blocker_family_id == a,
                        FamilyBlock.blocked_family_id == b,
                    ),
                    and_(
                        FamilyBlock.blocker_family_id == b,
                        FamilyBlock.blocked_family_id == a,
                    ),
                )
            )
        )
        a_blocked_b = False
        b_blocked_a = False
        for blocker, blocked in res.all():
            if blocker == a and blocked == b:
                a_blocked_b = True
            elif blocker == b and blocked == a:
                b_blocked_a = True
        return a_blocked_b, b_blocked_a

    async def is_blocked_either_way(self, a: uuid.UUID, b: uuid.UUID) -> bool:
        a_b, b_a = await self.is_blocked(a, b)
        return a_b or b_a

    # ── Gate ──────────────────────────────────────────────────────────

    async def _shares_active_community(self, a: uuid.UUID, b: uuid.UUID) -> bool:
        res = await self.db.execute(
            select(CommunityMember.community_id).where(
                CommunityMember.family_id == a,
                CommunityMember.status == "active",
            )
        )
        a_set = {row[0] for row in res.all()}
        if not a_set:
            return False
        res = await self.db.execute(
            select(CommunityMember.community_id).where(
                CommunityMember.family_id == b,
                CommunityMember.status == "active",
                CommunityMember.community_id.in_(a_set),
            )
        )
        return res.first() is not None

    async def can_initiate(
        self, sender_family: Family, recipient: Family,
    ) -> bool:
        """First-contact gate (spec §4.1).

        Returns True iff the sender may *start* a new thread. Replies inside
        an existing thread don't need this check.
        """
        if sender_family.id == recipient.id:
            return False
        if await self.is_blocked_either_way(sender_family.id, recipient.id):
            return False
        # Discoverable (opt-in OR legacy visibility) — mirrors community_service
        is_discoverable = (
            bool(getattr(recipient, "discoverable", False))
            or (recipient.visibility in ("local", "public"))
        )
        if is_discoverable:
            return True
        return await self._shares_active_community(sender_family.id, recipient.id)

    # ── Thread plumbing ───────────────────────────────────────────────

    async def _get_thread_by_pair(
        self, a: uuid.UUID, b: uuid.UUID,
    ) -> Optional[MessageThread]:
        lo, hi = _canonical_pair(a, b)
        res = await self.db.execute(
            select(MessageThread).where(
                MessageThread.family_a_id == lo,
                MessageThread.family_b_id == hi,
            )
        )
        return res.scalars().first()

    async def _get_thread(self, thread_id: uuid.UUID) -> MessageThread:
        res = await self.db.execute(
            select(MessageThread).where(MessageThread.id == thread_id)
        )
        t = res.scalars().first()
        if not t:
            raise HTTPException(status_code=404, detail="Thread not found.")
        return t

    def _is_participant(self, thread: MessageThread, family_id: uuid.UUID) -> bool:
        return family_id in (thread.family_a_id, thread.family_b_id)

    def _other_side(self, thread: MessageThread, family_id: uuid.UUID) -> uuid.UUID:
        return thread.family_b_id if family_id == thread.family_a_id else thread.family_a_id

    async def _get_or_create_participant(
        self, thread_id: uuid.UUID, family_id: uuid.UUID,
    ) -> MessageThreadParticipant:
        res = await self.db.execute(
            select(MessageThreadParticipant).where(
                MessageThreadParticipant.thread_id == thread_id,
                MessageThreadParticipant.family_id == family_id,
            )
        )
        p = res.scalars().first()
        if p:
            return p
        p = MessageThreadParticipant(thread_id=thread_id, family_id=family_id)
        self.db.add(p)
        await self.db.flush()
        return p

    async def _identity_for(self, family_id: uuid.UUID) -> dict:
        f = await self._family_by_id(family_id)
        return {
            "id": f.id,
            "family_name": f.family_name,
            "family_name_slug": f.family_name_slug,
            "shield_config": f.shield_config or None,
        }

    # ── Rate limit (in-DB, no Redis) ──────────────────────────────────

    async def _enforce_new_thread_rate_limit(self, family_id: uuid.UUID) -> None:
        since = utcnow() - timedelta(hours=24)
        res = await self.db.execute(
            select(func.count()).select_from(MessageThread).where(
                MessageThread.started_by_family_id == family_id,
                MessageThread.created_at >= since,
            )
        )
        n = int(res.scalar_one() or 0)
        if n >= NEW_THREADS_PER_24H:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"You've reached the limit of {NEW_THREADS_PER_24H} new "
                    "conversations per day. Try again later."
                ),
            )

    # ── Notification fan-out helper ───────────────────────────────────

    def _add_message_notification(
        self,
        recipient_family_id: uuid.UUID,
        thread_id: uuid.UUID,
        actor_family_id: uuid.UUID,
        event_type: str,
    ) -> None:
        self.db.add(Notification(
            recipient_family_id=recipient_family_id,
            actor_family_id=actor_family_id,
            thread_id=thread_id,
            event_type=event_type,
            created_at=utcnow(),
        ))

    # ── Create / reopen + post ────────────────────────────────────────

    async def start_or_get_thread(
        self,
        sender_family: Family,
        recipient_family_id: uuid.UUID,
        body: str,
    ) -> tuple[MessageThread, MessageItem]:
        if sender_family.id == recipient_family_id:
            raise HTTPException(status_code=422, detail="Cannot message your own family.")

        recipient = await self._family_by_id(recipient_family_id)

        # Gate: hidden recipients return 404 — never leak existence.
        if not await self.can_initiate(sender_family, recipient):
            # Block leads to 403 to give the *sender* a clearer signal in the UI.
            blocked = await self.is_blocked_either_way(sender_family.id, recipient.id)
            if blocked:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can no longer message this family.",
                )
            raise HTTPException(status_code=404, detail="Family not found.")

        existing = await self._get_thread_by_pair(sender_family.id, recipient.id)
        is_new = existing is None
        if is_new:
            await self._enforce_new_thread_rate_limit(sender_family.id)
            lo, hi = _canonical_pair(sender_family.id, recipient.id)
            thread = MessageThread(
                family_a_id=lo,
                family_b_id=hi,
                started_by_family_id=sender_family.id,
            )
            self.db.add(thread)
            await self.db.flush()
            # Ensure both participant rows exist
            self.db.add(MessageThreadParticipant(thread_id=thread.id, family_id=lo))
            self.db.add(MessageThreadParticipant(thread_id=thread.id, family_id=hi))
            await self.db.flush()
        else:
            thread = existing

        msg = await self._post_message_inner(
            thread, sender_family.id, body, is_first_in_thread=is_new,
        )
        await self.db.commit()
        await self.db.refresh(thread)
        await self.db.refresh(msg)
        return thread, msg

    async def post_reply(
        self, sender_family: Family, thread_id: uuid.UUID, body: str,
    ) -> MessageItem:
        thread = await self._get_thread(thread_id)
        if not self._is_participant(thread, sender_family.id):
            raise HTTPException(status_code=404, detail="Thread not found.")
        other_id = self._other_side(thread, sender_family.id)
        if await self.is_blocked_either_way(sender_family.id, other_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can no longer post in this conversation.",
            )
        msg = await self._post_message_inner(
            thread, sender_family.id, body, is_first_in_thread=False,
        )
        await self.db.commit()
        await self.db.refresh(msg)
        return msg

    async def _post_message_inner(
        self,
        thread: MessageThread,
        author_family_id: uuid.UUID,
        body: str,
        is_first_in_thread: bool,
    ) -> MessageItem:
        body = (body or "").strip()
        if not body:
            raise HTTPException(status_code=422, detail="Message body is required.")
        if len(body) > 4000:
            raise HTTPException(status_code=422, detail="Message is too long (max 4000).")

        now = utcnow()
        msg = MessageItem(
            thread_id=thread.id,
            author_family_id=author_family_id,
            body=body,
            created_at=now,
        )
        self.db.add(msg)
        await self.db.flush()

        thread.last_message_at = now
        thread.last_message_excerpt = _excerpt(body)
        thread.last_message_author_family_id = author_family_id
        thread.updated_at = now

        # Author's own side becomes implicitly read up to "now"; un-delete it
        # if they had soft-deleted it.
        author_part = await self._get_or_create_participant(thread.id, author_family_id)
        author_part.last_read_at = now
        author_part.deleted_at = None

        # Recipient: clear soft-delete so the thread reappears. Notification
        # fan-out unless they muted.
        other_id = self._other_side(thread, author_family_id)
        recip_part = await self._get_or_create_participant(thread.id, other_id)
        recip_part.deleted_at = None
        if not recip_part.notifications_muted:
            self._add_message_notification(
                recipient_family_id=other_id,
                thread_id=thread.id,
                actor_family_id=author_family_id,
                event_type=(
                    "message_thread_started" if is_first_in_thread else "message_received"
                ),
            )
        return msg

    # ── Inbox / detail ────────────────────────────────────────────────

    async def list_threads(
        self,
        family: Family,
        filter_: str = "all",
        page: int = 1,
        page_size: int = DEFAULT_INBOX_PAGE_SIZE,
    ) -> dict:
        page_size = max(1, min(page_size, MAX_INBOX_PAGE_SIZE))
        page = max(1, page)

        q = (
            select(MessageThread, MessageThreadParticipant)
            .join(
                MessageThreadParticipant,
                and_(
                    MessageThreadParticipant.thread_id == MessageThread.id,
                    MessageThreadParticipant.family_id == family.id,
                ),
            )
            .where(
                or_(
                    MessageThread.family_a_id == family.id,
                    MessageThread.family_b_id == family.id,
                )
            )
        )

        if filter_ == "archived":
            q = q.where(MessageThreadParticipant.deleted_at.is_not(None))
        else:
            q = q.where(MessageThreadParticipant.deleted_at.is_(None))

        if filter_ == "unread":
            q = q.where(
                MessageThread.last_message_at.is_not(None),
                MessageThread.last_message_author_family_id != family.id,
                or_(
                    MessageThreadParticipant.last_read_at.is_(None),
                    MessageThreadParticipant.last_read_at < MessageThread.last_message_at,
                ),
            )

        count_q = select(func.count()).select_from(q.subquery())
        total = int((await self.db.execute(count_q)).scalar_one())

        q = q.order_by(
            MessageThread.last_message_at.desc().nulls_last(),
            MessageThread.created_at.desc(),
        ).offset((page - 1) * page_size).limit(page_size)

        rows = list((await self.db.execute(q)).all())
        items = []
        for thread, part in rows:
            other_id = self._other_side(thread, family.id)
            other_identity = await self._identity_for(other_id)
            blocked = await self.is_blocked_either_way(family.id, other_id)
            unread = (
                thread.last_message_at is not None
                and thread.last_message_author_family_id != family.id
                and (
                    part.last_read_at is None
                    or part.last_read_at < thread.last_message_at
                )
            )
            items.append({
                "id": thread.id,
                "other_family": other_identity,
                "last_message_excerpt": thread.last_message_excerpt,
                "last_message_at": thread.last_message_at,
                "last_message_author_family_id": thread.last_message_author_family_id,
                "unread": unread,
                "is_blocked": blocked,
                "notifications_muted": part.notifications_muted,
                "deleted_on_my_side": part.deleted_at is not None,
            })

        total_pages = (total + page_size - 1) // page_size
        return {
            "items": items,
            "page": page,
            "total": total,
            "total_pages": total_pages,
        }

    async def get_thread_detail(
        self,
        family: Family,
        thread_id: uuid.UUID,
        before: Optional[datetime] = None,
        after: Optional[datetime] = None,
        limit: int = DEFAULT_MESSAGES_PAGE_SIZE,
    ) -> dict:
        thread = await self._get_thread(thread_id)
        if not self._is_participant(thread, family.id):
            raise HTTPException(status_code=404, detail="Thread not found.")

        limit = max(1, min(limit, MAX_MESSAGES_PAGE_SIZE))
        part = await self._get_or_create_participant(thread.id, family.id)
        other_id = self._other_side(thread, family.id)
        other_identity = await self._identity_for(other_id)

        a_blocked_b, b_blocked_a = await self.is_blocked(family.id, other_id)
        # blocked_by_me is "I blocked them"
        blocked_by_me = a_blocked_b
        blocked_by_them = b_blocked_a
        can_send = not (blocked_by_me or blocked_by_them)

        # `after` is the polling delta cursor — fetch strictly-newer messages,
        # ascending, no history pagination. `after` takes precedence over
        # `before` if both are somehow passed (callers should send one).
        if after is not None:
            q = (
                select(MessageItem)
                .where(
                    MessageItem.thread_id == thread.id,
                    MessageItem.created_at > after,
                )
                .order_by(MessageItem.created_at.asc())
                .limit(limit)
            )
            rows = list((await self.db.execute(q)).scalars().all())
            # No history-direction cursor when polling forward.
            next_cursor = None
        else:
            q = select(MessageItem).where(MessageItem.thread_id == thread.id)
            if before is not None:
                q = q.where(MessageItem.created_at < before)
            q = q.order_by(MessageItem.created_at.desc()).limit(limit + 1)
            rows = list((await self.db.execute(q)).scalars().all())
            has_more = len(rows) > limit
            rows = rows[:limit]
            # Return chronological (oldest first) for the UI
            rows.reverse()
            next_cursor = rows[0].created_at if has_more and rows else None

        messages = [
            {
                "id": m.id,
                "thread_id": m.thread_id,
                "author_family_id": m.author_family_id,
                "body": m.body,
                "created_at": m.created_at,
            }
            for m in rows
        ]

        return {
            "id": thread.id,
            "other_family": other_identity,
            "can_send": can_send,
            "blocked_by_me": blocked_by_me,
            "blocked_by_them": blocked_by_them,
            "notifications_muted": part.notifications_muted,
            "last_read_at": part.last_read_at,
            "messages": messages,
            "next_cursor": next_cursor,
        }

    async def mark_read(self, family: Family, thread_id: uuid.UUID) -> None:
        thread = await self._get_thread(thread_id)
        if not self._is_participant(thread, family.id):
            raise HTTPException(status_code=404, detail="Thread not found.")
        part = await self._get_or_create_participant(thread.id, family.id)
        now = utcnow()
        part.last_read_at = now
        # Sweep matching unread message notifications for this side+thread.
        await self.db.execute(
            update(Notification)
            .where(
                Notification.recipient_family_id == family.id,
                Notification.thread_id == thread.id,
                Notification.read_at.is_(None),
                Notification.event_type.in_(["message_received", "message_thread_started"]),
            )
            .values(read_at=now)
        )
        await self.db.commit()

    async def set_mute(self, family: Family, thread_id: uuid.UUID, muted: bool) -> None:
        thread = await self._get_thread(thread_id)
        if not self._is_participant(thread, family.id):
            raise HTTPException(status_code=404, detail="Thread not found.")
        part = await self._get_or_create_participant(thread.id, family.id)
        part.notifications_muted = muted
        await self.db.commit()

    async def delete_for_me(self, family: Family, thread_id: uuid.UUID) -> None:
        thread = await self._get_thread(thread_id)
        if not self._is_participant(thread, family.id):
            raise HTTPException(status_code=404, detail="Thread not found.")
        part = await self._get_or_create_participant(thread.id, family.id)
        part.deleted_at = utcnow()
        await self.db.commit()

    # ── Blocks ────────────────────────────────────────────────────────

    async def block_family(
        self, blocker: Family, blocked_family_id: uuid.UUID, reason: Optional[str] = None,
    ) -> FamilyBlock:
        if blocker.id == blocked_family_id:
            raise HTTPException(status_code=422, detail="Cannot block your own family.")
        # Idempotent — return existing row if present.
        res = await self.db.execute(
            select(FamilyBlock).where(
                FamilyBlock.blocker_family_id == blocker.id,
                FamilyBlock.blocked_family_id == blocked_family_id,
            )
        )
        existing = res.scalars().first()
        if existing:
            return existing
        # The blocked family must actually exist.
        await self._family_by_id(blocked_family_id)
        block = FamilyBlock(
            blocker_family_id=blocker.id,
            blocked_family_id=blocked_family_id,
            reason=(reason or None),
        )
        self.db.add(block)
        await self.db.commit()
        await self.db.refresh(block)
        return block

    async def unblock_family(self, blocker: Family, blocked_family_id: uuid.UUID) -> None:
        res = await self.db.execute(
            select(FamilyBlock).where(
                FamilyBlock.blocker_family_id == blocker.id,
                FamilyBlock.blocked_family_id == blocked_family_id,
            )
        )
        b = res.scalars().first()
        if b:
            await self.db.delete(b)
            await self.db.commit()

    async def list_blocks(self, blocker: Family) -> list[dict]:
        res = await self.db.execute(
            select(FamilyBlock).where(FamilyBlock.blocker_family_id == blocker.id)
            .order_by(FamilyBlock.created_at.desc())
        )
        out = []
        for b in res.scalars().all():
            out.append({
                "family": await self._identity_for(b.blocked_family_id),
                "created_at": b.created_at,
                "reason": b.reason,
            })
        return out

    # ── Reports ───────────────────────────────────────────────────────

    async def report_thread(
        self,
        reporter: Family,
        thread_id: uuid.UUID,
        reason: str,
        also_block: bool = True,
    ) -> MessageReport:
        thread = await self._get_thread(thread_id)
        if not self._is_participant(thread, reporter.id):
            raise HTTPException(status_code=404, detail="Thread not found.")
        other_id = self._other_side(thread, reporter.id)
        rep = MessageReport(
            thread_id=thread.id,
            reporter_family_id=reporter.id,
            reported_family_id=other_id,
            reason=reason.strip()[:500],
        )
        self.db.add(rep)
        if also_block:
            # Inline so it's one transaction.
            res = await self.db.execute(
                select(FamilyBlock).where(
                    FamilyBlock.blocker_family_id == reporter.id,
                    FamilyBlock.blocked_family_id == other_id,
                )
            )
            if not res.scalars().first():
                self.db.add(FamilyBlock(
                    blocker_family_id=reporter.id,
                    blocked_family_id=other_id,
                    reason="Auto-block on report",
                ))
        await self.db.commit()
        await self.db.refresh(rep)
        return rep

    # ── Unread summary ────────────────────────────────────────────────

    async def unread_thread_count(self, family: Family) -> int:
        q = (
            select(func.count())
            .select_from(MessageThread)
            .join(
                MessageThreadParticipant,
                and_(
                    MessageThreadParticipant.thread_id == MessageThread.id,
                    MessageThreadParticipant.family_id == family.id,
                ),
            )
            .where(
                or_(
                    MessageThread.family_a_id == family.id,
                    MessageThread.family_b_id == family.id,
                ),
                MessageThreadParticipant.deleted_at.is_(None),
                MessageThread.last_message_at.is_not(None),
                MessageThread.last_message_author_family_id != family.id,
                or_(
                    MessageThreadParticipant.last_read_at.is_(None),
                    MessageThreadParticipant.last_read_at < MessageThread.last_message_at,
                ),
            )
        )
        return int((await self.db.execute(q)).scalar_one() or 0)
