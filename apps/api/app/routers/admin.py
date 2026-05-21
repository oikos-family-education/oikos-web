"""Admin app endpoints — separate auth (admin_access_token cookie + allowlist).

This spec covers the beta-applications screen. The follow-on Admin Center spec extends
this router with overview, families, moderation, audit log viewer, and admins management.
"""
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.admin_auth import (
    ADMIN_COOKIE_NAME,
    ADMIN_ACCESS_TOKEN_TTL_HOURS,
    create_admin_access_token,
    env_admin_emails,
    get_current_admin,
    is_email_allowed,
)
from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_password
from app.models.beta import AdminAllowlist, AuditLog, BetaApplication
from app.models.user import User
from app.schemas.beta import (
    AdminAllowlistEntry,
    AdminLoginRequest,
    AdminMeResponse,
    AuditLogEntry,
    AuditLogList,
    BetaApplicationDetail,
    BetaApplicationList,
    BetaApplicationListItem,
    BetaDecisionRequest,
    BetaInternalNoteUpdate,
)
from app.services.audit_service import write_audit
from app.services.auth_service import check_rate_limit
from app.services.beta_service import (
    BETA_CAP,
    approve as svc_approve,
    count_by_status,
    deny as svc_deny,
    get_application,
    list_applications,
    reopen as svc_reopen,
    resend_invite as svc_resend,
    update_internal_note,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


def _is_secure() -> bool:
    return settings.APP_BASE_URL.startswith("https")


def _set_admin_cookie(response: Response, email: str) -> None:
    token = create_admin_access_token(email)
    response.set_cookie(
        key=ADMIN_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=_is_secure(),
        samesite="strict",
        max_age=ADMIN_ACCESS_TOKEN_TTL_HOURS * 60 * 60,
        path="/",
    )


# ---- Auth ----


@router.post("/auth/login", response_model=AdminMeResponse)
async def admin_login(
    request: Request,
    response: Response,
    req: AdminLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    ip = request.client.host if request.client else "127.0.0.1"
    await check_rate_limit(f"ratelimit:admin_login:{ip}", 10, 900)

    email = req.email.lower().strip()
    if not await is_email_allowed(email, db):
        # Generic message — don't leak the allowlist.
        await write_audit(
            db,
            actor_email=email,
            action="admin.login_denied",
            target_email=email,
            reason="not in allowlist",
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access denied")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    if not user or not verify_password(req.password, user.hashed_password):
        await write_audit(
            db,
            actor_email=email,
            action="admin.login_denied",
            target_email=email,
            reason="invalid credentials",
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access denied")

    _set_admin_cookie(response, email)
    await write_audit(db, actor_email=email, action="admin.login", target_email=email)
    return AdminMeResponse(email=email)


@router.post("/auth/logout")
async def admin_logout(response: Response, admin_email: str = Depends(get_current_admin)):
    response.delete_cookie(
        ADMIN_COOKIE_NAME, path="/", samesite="strict", secure=_is_secure(), httponly=True
    )
    return {"message": "Logged out"}


@router.get("/auth/me", response_model=AdminMeResponse)
async def admin_me(admin_email: str = Depends(get_current_admin)):
    return AdminMeResponse(email=admin_email)


# ---- Beta applications ----


@router.get("/beta/applications", response_model=BetaApplicationList)
async def list_beta_applications(
    status_filter: str | None = Query(default="pending", alias="status"),
    search: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    admin_email: str = Depends(get_current_admin),
):
    items, total = await list_applications(
        db, status_filter=status_filter, search=search, limit=limit, offset=offset
    )
    counts = await count_by_status(db)
    return BetaApplicationList(
        items=[BetaApplicationListItem.model_validate(i) for i in items],
        total=total,
        approved_count=counts["approved"],
        pending_count=counts["pending"],
        denied_count=counts["denied"],
        cap=BETA_CAP,
    )


@router.get("/beta/applications/{app_id}", response_model=BetaApplicationDetail)
async def get_beta_application(
    app_id: str,
    db: AsyncSession = Depends(get_db),
    admin_email: str = Depends(get_current_admin),
):
    app = await get_application(db, app_id)
    return BetaApplicationDetail.model_validate(app)


@router.post("/beta/applications/{app_id}/approve", response_model=BetaApplicationDetail)
async def approve_beta_application(
    app_id: str,
    req: BetaDecisionRequest,
    db: AsyncSession = Depends(get_db),
    admin_email: str = Depends(get_current_admin),
):
    app, _ = await svc_approve(
        db,
        app_id=app_id,
        admin_email=admin_email,
        over_cap_confirmed=req.over_cap_confirmed,
        note=req.note,
    )
    return BetaApplicationDetail.model_validate(app)


@router.post("/beta/applications/{app_id}/deny", response_model=BetaApplicationDetail)
async def deny_beta_application(
    app_id: str,
    req: BetaDecisionRequest,
    db: AsyncSession = Depends(get_db),
    admin_email: str = Depends(get_current_admin),
):
    app = await svc_deny(db, app_id=app_id, admin_email=admin_email, note=req.note)
    return BetaApplicationDetail.model_validate(app)


@router.post("/beta/applications/{app_id}/reopen", response_model=BetaApplicationDetail)
async def reopen_beta_application(
    app_id: str,
    db: AsyncSession = Depends(get_db),
    admin_email: str = Depends(get_current_admin),
):
    app = await svc_reopen(db, app_id=app_id, admin_email=admin_email)
    return BetaApplicationDetail.model_validate(app)


@router.post("/beta/applications/{app_id}/resend-invite", response_model=BetaApplicationDetail)
async def resend_beta_invite(
    app_id: str,
    db: AsyncSession = Depends(get_db),
    admin_email: str = Depends(get_current_admin),
):
    app, _ = await svc_resend(db, app_id=app_id, admin_email=admin_email)
    return BetaApplicationDetail.model_validate(app)


@router.patch("/beta/applications/{app_id}/note", response_model=BetaApplicationDetail)
async def update_beta_note(
    app_id: str,
    req: BetaInternalNoteUpdate,
    db: AsyncSession = Depends(get_db),
    admin_email: str = Depends(get_current_admin),
):
    app = await update_internal_note(db, app_id=app_id, note=req.note)
    return BetaApplicationDetail.model_validate(app)


# ---- Allowlist (read-only here; UI mutations live in the follow-on Admin Center spec) ----


@router.get("/allowlist", response_model=list[AdminAllowlistEntry])
async def list_allowlist(
    db: AsyncSession = Depends(get_db),
    admin_email: str = Depends(get_current_admin),
):
    result = await db.execute(select(AdminAllowlist).order_by(AdminAllowlist.added_at.desc()))
    db_entries = result.scalars().all()
    out = [
        AdminAllowlistEntry(
            id=e.id,
            email=e.email,
            added_by_admin_email=e.added_by_admin_email,
            added_at=e.added_at,
            source="db",
        )
        for e in db_entries
    ]
    # Also include env-var entries (no UUID — synthesise one for the response)
    import uuid as _uuid
    from datetime import timezone as _tz

    for ev_email in sorted(env_admin_emails()):
        out.append(
            AdminAllowlistEntry(
                id=_uuid.uuid5(_uuid.NAMESPACE_DNS, ev_email),
                email=ev_email,
                added_by_admin_email=None,
                added_at=datetime.fromtimestamp(0, tz=_tz.utc),
                source="env",
            )
        )
    return out


# ---- Audit log (read-only view; viewer UI is in the follow-on Admin Center spec) ----


@router.get("/audit-log", response_model=AuditLogList)
async def list_audit_log(
    action: list[str] | None = Query(default=None),
    actor_email: str | None = Query(default=None),
    target: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    admin_email: str = Depends(get_current_admin),
):
    q = select(AuditLog)
    if action:
        q = q.where(AuditLog.action.in_(action))
    if actor_email:
        q = q.where(AuditLog.actor_email == actor_email.lower())
    if target:
        like = f"%{target.lower()}%"
        q = q.where(func.lower(AuditLog.target_email).like(like))
    q = q.order_by(AuditLog.ts.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    items = result.scalars().all()

    total_q = select(func.count(AuditLog.id))
    if action:
        total_q = total_q.where(AuditLog.action.in_(action))
    if actor_email:
        total_q = total_q.where(AuditLog.actor_email == actor_email.lower())
    total_result = await db.execute(total_q)
    total = int(total_result.scalar() or 0)

    return AuditLogList(items=[AuditLogEntry.model_validate(i) for i in items], total=total)
