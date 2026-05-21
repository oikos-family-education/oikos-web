"""Closed-beta program service. All admin actions write to the audit log."""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.security import hash_token
from app.models.beta import BetaApplication
from app.models.user import User
from app.schemas.beta import BetaApplicationCreate
from app.services.audit_service import write_audit
from app.services.email_service import render_beta_invite_email, send_email

BETA_CAP = 50
INVITE_TTL_DAYS = 30


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_invite_token() -> str:
    return secrets.token_urlsafe(32)


async def _approved_count(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count(BetaApplication.id)).where(BetaApplication.status == "approved")
    )
    return int(result.scalar() or 0)


async def count_by_status(db: AsyncSession) -> dict:
    """Return {'pending': N, 'approved': N, 'denied': N, 'total': N}."""
    result = await db.execute(
        select(BetaApplication.status, func.count(BetaApplication.id)).group_by(BetaApplication.status)
    )
    counts = {row[0]: int(row[1]) for row in result.all()}
    return {
        "pending": counts.get("pending", 0),
        "approved": counts.get("approved", 0),
        "denied": counts.get("denied", 0),
        "total": sum(counts.values()),
    }


# ---- Public flow ----


async def submit_application(db: AsyncSession, payload: BetaApplicationCreate) -> tuple[BetaApplication, bool]:
    """Create or return existing application for the email. Honeypot is enforced by the
    caller dropping submissions silently. Returns (app, is_duplicate)."""
    email = payload.email.lower().strip()
    existing = await db.execute(
        select(BetaApplication).where(BetaApplication.email == email)
    )
    existing_app = existing.scalars().first()
    if existing_app:
        return existing_app, True

    app = BetaApplication(
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        email=email,
        reason=payload.reason.strip(),
        status="pending",
    )
    db.add(app)
    await db.commit()
    await db.refresh(app)
    return app, False


# ---- Admin flow ----


async def list_applications(
    db: AsyncSession,
    *,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
):
    q = select(BetaApplication)
    if status_filter and status_filter != "all":
        q = q.where(BetaApplication.status == status_filter)
    if search:
        like = f"%{search.lower()}%"
        q = q.where(
            (func.lower(BetaApplication.email).like(like))
            | (func.lower(BetaApplication.first_name).like(like))
            | (func.lower(BetaApplication.last_name).like(like))
        )
    q = q.order_by(BetaApplication.applied_at.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    items = result.scalars().all()

    total_q = select(func.count(BetaApplication.id))
    if status_filter and status_filter != "all":
        total_q = total_q.where(BetaApplication.status == status_filter)
    total_result = await db.execute(total_q)
    total = int(total_result.scalar() or 0)

    return items, total


async def get_application(db: AsyncSession, app_id: str) -> BetaApplication:
    result = await db.execute(select(BetaApplication).where(BetaApplication.id == app_id))
    app = result.scalars().first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


async def approve(
    db: AsyncSession,
    *,
    app_id: str,
    admin_email: str,
    over_cap_confirmed: bool = False,
    note: Optional[str] = None,
) -> tuple[BetaApplication, str]:
    """Approve an application, generate a fresh invite token, and queue the email.

    Returns (application, raw_invite_token). The raw token is also implicitly emailed —
    we return it primarily for test introspection.
    """
    app = await get_application(db, app_id)
    if app.status == "approved":
        raise HTTPException(status_code=409, detail="Application is already approved")

    approved_count = await _approved_count(db)
    over_cap = approved_count >= BETA_CAP
    if over_cap and not over_cap_confirmed:
        raise HTTPException(
            status_code=409,
            detail={"detail": "Approving would exceed the beta cap. Confirm to proceed.",
                    "code": "over_cap_confirmation_required",
                    "approved_count": approved_count,
                    "cap": BETA_CAP},
        )

    raw_token = _new_invite_token()
    app.status = "approved"
    app.decided_at = _utcnow()
    app.decided_by_admin_email = admin_email.lower()
    app.invite_token_hash = hash_token(raw_token)
    app.invite_token_expires_at = _utcnow() + timedelta(days=INVITE_TTL_DAYS)
    app.invite_sent_at = _utcnow()
    app.invite_consumed_at = None
    if note is not None:
        app.internal_note = note
    await db.commit()
    await db.refresh(app)

    await write_audit(
        db,
        actor_email=admin_email,
        action="beta.approve_over_cap" if over_cap else "beta.approve",
        target_type="beta_application",
        target_id=str(app.id),
        target_email=app.email,
        reason=note,
        snapshot={"approved_count_before": approved_count, "cap": BETA_CAP},
    )

    invite_url = f"{settings.APP_BASE_URL}/register?invite={raw_token}"
    subject, html, text = render_beta_invite_email(first_name=app.first_name, invite_url=invite_url)
    await send_email(to=app.email, subject=subject, html=html, text=text)

    return app, raw_token


async def deny(db: AsyncSession, *, app_id: str, admin_email: str, note: Optional[str] = None) -> BetaApplication:
    app = await get_application(db, app_id)
    app.status = "denied"
    app.decided_at = _utcnow()
    app.decided_by_admin_email = admin_email.lower()
    if note is not None:
        app.internal_note = note
    await db.commit()
    await db.refresh(app)

    await write_audit(
        db,
        actor_email=admin_email,
        action="beta.deny",
        target_type="beta_application",
        target_id=str(app.id),
        target_email=app.email,
        reason=note,
    )
    return app


async def reopen(db: AsyncSession, *, app_id: str, admin_email: str) -> BetaApplication:
    app = await get_application(db, app_id)
    if app.status != "denied":
        raise HTTPException(status_code=409, detail="Only denied applications can be re-opened")
    app.status = "pending"
    app.decided_at = None
    app.decided_by_admin_email = None
    await db.commit()
    await db.refresh(app)

    await write_audit(
        db,
        actor_email=admin_email,
        action="beta.reopen",
        target_type="beta_application",
        target_id=str(app.id),
        target_email=app.email,
    )
    return app


async def resend_invite(db: AsyncSession, *, app_id: str, admin_email: str) -> tuple[BetaApplication, str]:
    app = await get_application(db, app_id)
    if app.status != "approved":
        raise HTTPException(status_code=409, detail="Application is not approved")
    if app.invite_consumed_at is not None:
        raise HTTPException(status_code=409, detail="Invite has already been used to register")

    raw_token = _new_invite_token()
    app.invite_token_hash = hash_token(raw_token)
    app.invite_token_expires_at = _utcnow() + timedelta(days=INVITE_TTL_DAYS)
    app.invite_sent_at = _utcnow()
    await db.commit()
    await db.refresh(app)

    await write_audit(
        db,
        actor_email=admin_email,
        action="beta.resend_invite",
        target_type="beta_application",
        target_id=str(app.id),
        target_email=app.email,
    )

    invite_url = f"{settings.APP_BASE_URL}/register?invite={raw_token}"
    subject, html, text = render_beta_invite_email(first_name=app.first_name, invite_url=invite_url)
    await send_email(to=app.email, subject=subject, html=html, text=text)

    return app, raw_token


async def update_internal_note(db: AsyncSession, *, app_id: str, note: Optional[str]) -> BetaApplication:
    app = await get_application(db, app_id)
    app.internal_note = note
    await db.commit()
    await db.refresh(app)
    return app


# ---- Invite token validation (used by /register) ----


async def find_application_by_invite_token(db: AsyncSession, raw_token: str) -> Optional[BetaApplication]:
    if not raw_token:
        return None
    hashed = hash_token(raw_token)
    result = await db.execute(
        select(BetaApplication).where(BetaApplication.invite_token_hash == hashed)
    )
    return result.scalars().first()


async def consume_invite_token(db: AsyncSession, *, raw_token: str, user: User) -> Optional[BetaApplication]:
    """Mark the invite as consumed and link it to the user. Idempotent — if the token
    can't be found, returns None (caller decides what to do)."""
    app = await find_application_by_invite_token(db, raw_token)
    if not app:
        return None
    app.invite_consumed_at = _utcnow()
    app.registered_user_id = user.id
    # Invalidate the token after consumption.
    app.invite_token_hash = None
    await db.commit()
    await db.refresh(app)
    return app
