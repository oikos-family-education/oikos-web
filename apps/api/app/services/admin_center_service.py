"""Read-side helpers for the admin center: overview stats, families list/detail."""
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.beta import BetaApplication
from app.models.calendar import CalendarEvent
from app.models.child import Child
from app.models.curriculum import Curriculum
from app.models.family import Family
from app.models.family_member import FamilyMember
from app.models.lesson import Lesson
from app.models.note import Note
from app.models.project import Project
from app.models.resource import Resource
from app.models.subject import Subject
from app.models.teaching_log import TeachingLog
from app.models.user import User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _count(db: AsyncSession, model, since: Optional[datetime] = None) -> int:
    q = select(func.count()).select_from(model)
    if since is not None and hasattr(model, "created_at"):
        q = q.where(model.created_at >= since)
    return int((await db.execute(q)).scalar() or 0)


async def overview_counts(db: AsyncSession) -> dict:
    """Return total counts for families, users, children, etc., plus a 7-day delta."""
    week_ago = _utcnow() - timedelta(days=7)
    results = {}
    for label, model in [
        ("families", Family),
        ("users", User),
        ("children", Child),
        ("subjects", Subject),
        ("curriculums", Curriculum),
        ("lessons", Lesson),
        ("projects", Project),
        ("resources", Resource),
    ]:
        total = await _count(db, model)
        delta = await _count(db, model, since=week_ago)
        results[label] = {"label": label, "total": total, "delta_7d": delta}
    return results


async def beta_counts(db: AsyncSession) -> dict:
    from app.services.beta_service import BETA_CAP, count_by_status
    c = await count_by_status(db)
    return {**c, "cap": BETA_CAP}


async def trend_30d(db: AsyncSession) -> list:
    """One row per day for the last 30 days, with signups, applications, and approvals."""
    days = []
    start = (_utcnow() - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)
    for i in range(30):
        day = start + timedelta(days=i)
        next_day = day + timedelta(days=1)

        signups = int(
            (
                await db.execute(
                    select(func.count(User.id)).where(User.created_at >= day, User.created_at < next_day)
                )
            ).scalar()
            or 0
        )
        apps = int(
            (
                await db.execute(
                    select(func.count(BetaApplication.id)).where(
                        BetaApplication.applied_at >= day, BetaApplication.applied_at < next_day
                    )
                )
            ).scalar()
            or 0
        )
        approvals = int(
            (
                await db.execute(
                    select(func.count(BetaApplication.id)).where(
                        BetaApplication.decided_at >= day,
                        BetaApplication.decided_at < next_day,
                        BetaApplication.status == "approved",
                    )
                )
            ).scalar()
            or 0
        )
        days.append(
            {
                "date": day.date().isoformat(),
                "signups": signups,
                "beta_applications": apps,
                "beta_approvals": approvals,
            }
        )
    return days


async def _last_active_for_family(db: AsyncSession, family_id) -> Optional[datetime]:
    """Most recent timestamp across teaching logs / notes / lessons / projects / resources."""
    candidates = []
    for model, ts_col, fam_attr in [
        (TeachingLog, "created_at", "family_id"),
        (Note, "updated_at", "family_id"),
        (Lesson, "updated_at", "family_id"),
        (Project, "updated_at", "family_id"),
        (Resource, "created_at", "family_id"),
    ]:
        if not hasattr(model, fam_attr):
            continue
        col = getattr(model, ts_col, None)
        if col is None:
            continue
        q = select(func.max(col)).where(getattr(model, fam_attr) == family_id)
        ts = (await db.execute(q)).scalar()
        if ts:
            candidates.append(ts)
    return max(candidates) if candidates else None


async def most_active_families(db: AsyncSession, limit: int = 10) -> list:
    """Top N families by recent activity. O(F) over family count — fine for admin use."""
    fam_result = await db.execute(select(Family))
    families = fam_result.scalars().all()
    items = []
    for fam in families:
        member_count = int(
            (
                await db.execute(
                    select(func.count(FamilyMember.id)).where(FamilyMember.family_id == fam.id)
                )
            ).scalar()
            or 0
        )
        child_count = int(
            (
                await db.execute(select(func.count(Child.id)).where(Child.family_id == fam.id))
            ).scalar()
            or 0
        )
        owner_result = await db.execute(select(User).where(User.id == fam.account_id))
        owner = owner_result.scalars().first()
        last_active = await _last_active_for_family(db, fam.id)
        items.append(
            {
                "family_id": fam.id,
                "family_name": fam.family_name,
                "owner_email": owner.email if owner else None,
                "member_count": member_count,
                "child_count": child_count,
                "last_active_at": last_active,
            }
        )
    items.sort(key=lambda x: x["last_active_at"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return items[:limit]


async def list_families(
    db: AsyncSession,
    *,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> Tuple[List[dict], int]:
    """All families with owner email and member/child counts."""
    q = select(Family)
    if search:
        like = f"%{search.lower()}%"
        # Join to find by owner email
        q = q.join(User, User.id == Family.account_id, isouter=True).where(
            (func.lower(Family.family_name).like(like)) | (func.lower(User.email).like(like))
        )
    total = int((await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0)
    q = q.order_by(desc(Family.created_at)).limit(limit).offset(offset)
    rows = (await db.execute(q)).scalars().all()

    out: List[dict] = []
    for fam in rows:
        owner_result = await db.execute(select(User).where(User.id == fam.account_id))
        owner = owner_result.scalars().first()
        member_count = int(
            (
                await db.execute(
                    select(func.count(FamilyMember.id)).where(FamilyMember.family_id == fam.id)
                )
            ).scalar()
            or 0
        )
        child_count = int(
            (
                await db.execute(select(func.count(Child.id)).where(Child.family_id == fam.id))
            ).scalar()
            or 0
        )
        last_active = await _last_active_for_family(db, fam.id)
        out.append(
            {
                "family_id": fam.id,
                "family_name": fam.family_name,
                "owner_email": owner.email if owner else None,
                "owner_user_id": owner.id if owner else None,
                "member_count": member_count,
                "child_count": child_count,
                "created_at": fam.created_at,
                "last_active_at": last_active,
                "owner_status": (owner.moderation_status if owner else "active"),
            }
        )
    return out, total


async def family_detail(db: AsyncSession, *, family_id: str) -> dict:
    from fastapi import HTTPException

    fam = (await db.execute(select(Family).where(Family.id == family_id))).scalars().first()
    if not fam:
        raise HTTPException(status_code=404, detail="Family not found")

    owner = (await db.execute(select(User).where(User.id == fam.account_id))).scalars().first()
    member_rows = (
        await db.execute(select(FamilyMember).where(FamilyMember.family_id == fam.id))
    ).scalars().all()
    member_user_ids = [m.user_id for m in member_rows]
    member_users = []
    if member_user_ids:
        member_users = (
            (
                await db.execute(select(User).where(User.id.in_(member_user_ids)))
            ).scalars().all()
        )
    user_by_id = {str(u.id): u for u in member_users}

    members = []
    for m in member_rows:
        u = user_by_id.get(str(m.user_id))
        if not u:
            continue
        members.append(
            {
                "user_id": u.id,
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "role": m.role,
                "moderation_status": u.moderation_status,
                "last_login_at": u.last_login_at,
            }
        )

    children = (
        await db.execute(select(Child).where(Child.family_id == fam.id))
    ).scalars().all()
    # Children's first names are PII for minors and intentionally omitted here.
    child_list = [{"child_id": c.id, "created_at": c.created_at} for c in children]

    content_counts = {}
    for label, model in [
        ("subjects", Subject),
        ("curriculums", Curriculum),
        ("lessons", Lesson),
        ("projects", Project),
        ("resources", Resource),
        ("notes", Note),
    ]:
        if hasattr(model, "family_id"):
            n = int(
                (
                    await db.execute(
                        select(func.count()).select_from(model).where(model.family_id == fam.id)
                    )
                ).scalar()
                or 0
            )
            content_counts[label] = n

    # Linked beta application (if any)
    beta_app = None
    if owner:
        beta_app = (
            (
                await db.execute(
                    select(BetaApplication).where(BetaApplication.registered_user_id == owner.id)
                )
            ).scalars().first()
        )

    # Recent activity (last 20 across a few entity types)
    activity = []
    for label, model, ts_col in [
        ("lesson", Lesson, "updated_at"),
        ("note", Note, "updated_at"),
        ("project", Project, "updated_at"),
        ("resource", Resource, "created_at"),
    ]:
        if not hasattr(model, "family_id"):
            continue
        col = getattr(model, ts_col)
        rows = (
            await db.execute(
                select(model).where(model.family_id == fam.id).order_by(col.desc()).limit(20)
            )
        ).scalars().all()
        for r in rows:
            activity.append(
                {
                    "type": label,
                    "id": str(r.id),
                    "title": getattr(r, "title", getattr(r, "name", None)),
                    "ts": getattr(r, ts_col).isoformat() if getattr(r, ts_col) else None,
                }
            )
    activity.sort(key=lambda a: a["ts"] or "", reverse=True)
    activity = activity[:20]

    return {
        "family_id": fam.id,
        "family_name": fam.family_name,
        "created_at": fam.created_at,
        "owner_email": owner.email if owner else None,
        "owner_user_id": owner.id if owner else None,
        "is_beta_approved": beta_app is not None,
        "members": members,
        "children": child_list,
        "content_counts": content_counts,
        "recent_activity": activity,
    }
