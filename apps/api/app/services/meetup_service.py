"""Community meetups service (v2 spec §5).

Recurrence is computed on read — no row-per-occurrence storage. A meetup
defines `starts_at` + `recurrence` + optional `recurrence_until` and we expand
it into occurrence dates within a query window when the UI asks.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.community import (
    Community,
    CommunityMeetup,
    CommunityMeetupRsvp,
    CommunityMember,
)
from app.models.family import Family
from app.models.family_member import FamilyMember
from app.schemas.meetup import (
    MeetupCreate,
    MeetupUpdate,
    Recurrence,
    RsvpResponse,
)


DEFAULT_WINDOW_DAYS = 56  # 8 weeks


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def expand_occurrences(
    meetup: CommunityMeetup,
    window_start: date,
    window_end: date,
) -> list[date]:
    """Pure helper: returns the occurrence dates of ``meetup`` within
    [window_start, window_end] inclusive.

    DST: stored as TIMESTAMPTZ; for the purposes of computing the *date* of a
    weekly meetup we use UTC date arithmetic. That means a Sunday-evening
    meetup in a timezone west of UTC may shift to Monday across DST, which
    is acceptable for v2 — documented in spec §17 open question 1.
    """
    if meetup.cancelled_at is not None:
        return []

    anchor = meetup.starts_at.date()
    rec = meetup.recurrence
    upper = meetup.recurrence_until.date() if meetup.recurrence_until else None

    def in_window(d: date) -> bool:
        if d < window_start or d > window_end:
            return False
        if upper is not None and d > upper:
            return False
        return True

    if rec == "none":
        return [anchor] if in_window(anchor) else []

    step = {"weekly": 7, "biweekly": 14, "monthly": None}[rec]

    out: list[date] = []
    if step is not None:
        # Walk forward from the anchor (skipping past occurrences before window)
        # but never backwards — anchor is the first occurrence by definition.
        d = anchor
        # Fast-forward to the first occurrence inside or after window_start
        if d < window_start:
            delta = (window_start - d).days
            jumps = delta // step
            d = d + timedelta(days=jumps * step)
            if d < window_start:
                d = d + timedelta(days=step)
        while d <= window_end and (upper is None or d <= upper):
            out.append(d)
            d = d + timedelta(days=step)
        return out

    # monthly — same day-of-month, falling back to last day of the month
    # when the source day doesn't exist (e.g. anchor on the 31st). Always
    # clamp against the original anchor day so Feb 28 → Mar 31 (not Mar 28).
    def month_offset(anchor_d: date, n: int) -> date:
        m = anchor_d.month - 1 + n
        y = anchor_d.year + m // 12
        m = m % 12 + 1
        if m == 12:
            last = 31
        else:
            last = (date(y, m + 1, 1) - timedelta(days=1)).day
        return date(y, m, min(anchor_d.day, last))

    n = 0
    while True:
        d = month_offset(anchor, n)
        if d > window_end or (upper is not None and d > upper):
            break
        if window_start <= d <= window_end:
            out.append(d)
        n += 1
    return out


class MeetupService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_family_for_user(self, user_id: uuid.UUID) -> Family:
        res = await self.db.execute(
            select(Family).join(FamilyMember, FamilyMember.family_id == Family.id)
            .where(FamilyMember.user_id == user_id)
        )
        family = res.scalars().first()
        if not family:
            raise HTTPException(status_code=400, detail="No family configured.")
        return family

    async def _community_by_slug(self, slug: str) -> Community:
        res = await self.db.execute(
            select(Community).where(Community.slug == slug, Community.deleted_at.is_(None))
        )
        c = res.scalars().first()
        if not c:
            raise HTTPException(status_code=404, detail="Community not found.")
        return c

    async def _require_member(
        self, user_id: uuid.UUID, slug: str,
    ) -> tuple[Family, Community, CommunityMember]:
        family = await self._get_family_for_user(user_id)
        c = await self._community_by_slug(slug)
        res = await self.db.execute(
            select(CommunityMember).where(
                CommunityMember.community_id == c.id,
                CommunityMember.family_id == family.id,
            )
        )
        m = res.scalars().first()
        if not m or m.status != "active":
            raise HTTPException(status_code=403, detail="Members only.")
        return family, c, m

    # ── CRUD ──────────────────────────────────────────────────────────

    async def create_meetup(
        self, user_id: uuid.UUID, slug: str, data: MeetupCreate,
    ) -> CommunityMeetup:
        family, c, _ = await self._require_member(user_id, slug)
        m = CommunityMeetup(
            community_id=c.id,
            created_by_family_id=family.id,
            title=data.title.strip(),
            description=data.description,
            starts_at=data.starts_at,
            duration_minutes=data.duration_minutes,
            recurrence=data.recurrence.value,
            recurrence_until=(
                datetime.combine(data.recurrence_until, datetime.min.time(), tzinfo=timezone.utc)
                if data.recurrence_until else None
            ),
            location_text=data.location_text,
            meeting_url=str(data.meeting_url) if data.meeting_url else None,
        )
        if not m.location_text and not m.meeting_url:
            raise HTTPException(
                status_code=422,
                detail="A meetup needs at least one of: location or meeting URL.",
            )
        self.db.add(m)
        await self.db.commit()
        await self.db.refresh(m)
        return m

    async def update_meetup(
        self, user_id: uuid.UUID, slug: str, meetup_id: uuid.UUID, data: MeetupUpdate,
    ) -> CommunityMeetup:
        family, c, me = await self._require_member(user_id, slug)
        m = await self._fetch_meetup(c.id, meetup_id)
        self._require_editor(m, family.id, me.role)

        upd = data.model_dump(exclude_unset=True)
        if "recurrence" in upd and upd["recurrence"] is not None:
            v = upd["recurrence"]
            upd["recurrence"] = v.value if hasattr(v, "value") else v
        if "recurrence_until" in upd and upd["recurrence_until"] is not None:
            d = upd["recurrence_until"]
            upd["recurrence_until"] = datetime.combine(d, datetime.min.time(), tzinfo=timezone.utc)
        if "meeting_url" in upd and upd["meeting_url"] is not None:
            upd["meeting_url"] = str(upd["meeting_url"])

        for k, v in upd.items():
            setattr(m, k, v)

        if not m.location_text and not m.meeting_url:
            raise HTTPException(
                status_code=422,
                detail="A meetup needs at least one of: location or meeting URL.",
            )
        await self.db.commit()
        await self.db.refresh(m)
        return m

    async def cancel_meetup(
        self, user_id: uuid.UUID, slug: str, meetup_id: uuid.UUID,
    ) -> None:
        family, c, me = await self._require_member(user_id, slug)
        m = await self._fetch_meetup(c.id, meetup_id)
        self._require_editor(m, family.id, me.role)
        if m.cancelled_at is None:
            m.cancelled_at = utcnow()
            await self.db.commit()

    def _require_editor(self, m: CommunityMeetup, family_id: uuid.UUID, role: str) -> None:
        is_owner = m.created_by_family_id == family_id
        is_admin = role in ("admin", "co_admin")
        if not (is_owner or is_admin):
            raise HTTPException(
                status_code=403,
                detail="Only the meetup creator or a community admin can change this.",
            )

    async def _fetch_meetup(self, community_id: uuid.UUID, meetup_id: uuid.UUID) -> CommunityMeetup:
        res = await self.db.execute(
            select(CommunityMeetup).where(
                CommunityMeetup.id == meetup_id,
                CommunityMeetup.community_id == community_id,
            )
        )
        m = res.scalars().first()
        if not m:
            raise HTTPException(status_code=404, detail="Meetup not found.")
        return m

    # ── Listings ──────────────────────────────────────────────────────

    async def list_occurrences(
        self,
        user_id: uuid.UUID,
        slug: str,
        window_from: Optional[date],
        window_to: Optional[date],
    ) -> list[dict]:
        family, c, _ = await self._require_member(user_id, slug)
        today = utcnow().date()
        window_from = window_from or today - timedelta(days=1)
        window_to = window_to or today + timedelta(days=DEFAULT_WINDOW_DAYS)

        res = await self.db.execute(
            select(CommunityMeetup).where(
                CommunityMeetup.community_id == c.id,
                CommunityMeetup.cancelled_at.is_(None),
            )
        )
        meetups = list(res.scalars().all())

        # Gather RSVPs across all the meetups in window in a single query.
        meetup_ids = [m.id for m in meetups]
        rsvp_rows: list[tuple[CommunityMeetupRsvp]] = []
        viewer_rsvps: dict[tuple[uuid.UUID, date], str] = {}
        rsvp_counts: dict[tuple[uuid.UUID, date], dict[str, int]] = {}
        if meetup_ids:
            rres = await self.db.execute(
                select(CommunityMeetupRsvp).where(
                    CommunityMeetupRsvp.meetup_id.in_(meetup_ids),
                )
            )
            for r in rres.scalars().all():
                d = r.occurrence_date.date() if isinstance(r.occurrence_date, datetime) else r.occurrence_date
                key = (r.meetup_id, d)
                rsvp_counts.setdefault(key, {"going": 0, "maybe": 0, "not_going": 0})[r.response] += 1
                if r.family_id == family.id:
                    viewer_rsvps[key] = r.response

        out: list[dict] = []
        for m in meetups:
            for d in expand_occurrences(m, window_from, window_to):
                key = (m.id, d)
                counts = rsvp_counts.get(key, {"going": 0, "maybe": 0, "not_going": 0})
                # Combine the anchor time-of-day with this occurrence's date
                tod = m.starts_at.timetz()
                starts_at = datetime.combine(d, tod)
                out.append({
                    "meetup_id": m.id,
                    "occurrence_date": d,
                    "starts_at": starts_at,
                    "title": m.title,
                    "description": m.description,
                    "duration_minutes": m.duration_minutes,
                    "location_text": m.location_text,
                    "meeting_url": m.meeting_url,
                    "created_by_family_id": m.created_by_family_id,
                    "rsvp_counts": counts,
                    "viewer_rsvp": viewer_rsvps.get(key),
                })
        out.sort(key=lambda r: r["starts_at"])
        return out

    async def meetup_detail(
        self, user_id: uuid.UUID, slug: str, meetup_id: uuid.UUID,
    ) -> tuple[CommunityMeetup, str]:
        _, c, _ = await self._require_member(user_id, slug)
        m = await self._fetch_meetup(c.id, meetup_id)
        res = await self.db.execute(
            select(Family.family_name).where(Family.id == m.created_by_family_id)
        )
        name = res.scalar_one_or_none() or ""
        return m, name

    # ── RSVP ──────────────────────────────────────────────────────────

    async def rsvp(
        self,
        user_id: uuid.UUID,
        slug: str,
        meetup_id: uuid.UUID,
        occurrence_date: date,
        response: RsvpResponse,
    ) -> CommunityMeetupRsvp:
        family, c, _ = await self._require_member(user_id, slug)
        m = await self._fetch_meetup(c.id, meetup_id)
        if m.cancelled_at is not None:
            raise HTTPException(status_code=400, detail="Meetup is cancelled.")

        # Confirm the date is a valid occurrence (defends against forged dates).
        valid_dates = set(expand_occurrences(
            m,
            occurrence_date - timedelta(days=1),
            occurrence_date + timedelta(days=1),
        ))
        if occurrence_date not in valid_dates:
            raise HTTPException(status_code=400, detail="That date is not an occurrence of this meetup.")

        as_dt = datetime.combine(occurrence_date, datetime.min.time())
        res = await self.db.execute(
            select(CommunityMeetupRsvp).where(
                CommunityMeetupRsvp.meetup_id == m.id,
                CommunityMeetupRsvp.family_id == family.id,
                CommunityMeetupRsvp.occurrence_date == as_dt,
            )
        )
        existing = res.scalars().first()
        if existing:
            existing.response = response.value
            await self.db.commit()
            await self.db.refresh(existing)
            return existing

        row = CommunityMeetupRsvp(
            meetup_id=m.id,
            family_id=family.id,
            occurrence_date=as_dt,
            response=response.value,
        )
        self.db.add(row)
        await self.db.commit()
        await self.db.refresh(row)
        return row
