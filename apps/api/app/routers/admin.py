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
from app.models.moderation import EmailBlacklist
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
from app.schemas.admin_center import (
    AddAdminRequest,
    BannedUserItem,
    BlockedUserItem,
    EmailBlacklistItem,
    FamilyDetailResponse,
    FamilyListItem,
    ModerationActionRequest,
    ModerationOverviewResponse,
    OverviewResponse,
    TrendPoint,
)
from app.services.admin_center_service import (
    beta_counts as svc_beta_counts,
    family_detail as svc_family_detail,
    list_families as svc_list_families,
    most_active_families,
    overview_counts,
    trend_30d,
)
from app.services.audit_service import write_audit
from app.services.auth_service import check_rate_limit
from app.services.moderation_service import (
    auto_lift_expired_blocks,
    ban_user as svc_ban,
    block_user as svc_block,
    remove_user as svc_remove,
    unblock_user as svc_unblock,
)
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


# ───────────────────────── Admin Center (#18) ─────────────────────────


@router.get("/overview", response_model=OverviewResponse)
async def overview(
    db: AsyncSession = Depends(get_db),
    admin_email: str = Depends(get_current_admin),
):
    counts = await overview_counts(db)
    beta = await svc_beta_counts(db)
    trend = await trend_30d(db)
    families = await most_active_families(db)
    return OverviewResponse(
        counts=counts,
        beta=beta,
        trend=[TrendPoint(**t) for t in trend],
        most_active_families=families,
    )


@router.get("/families", response_model=dict)
async def families_list(
    search: str | None = None,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    admin_email: str = Depends(get_current_admin),
):
    await auto_lift_expired_blocks(db)
    items, total = await svc_list_families(db, search=search, limit=limit, offset=offset)
    return {"items": [FamilyListItem(**i).model_dump(mode="json") for i in items], "total": total}


@router.get("/families/{family_id}", response_model=FamilyDetailResponse)
async def family_detail_view(
    family_id: str,
    db: AsyncSession = Depends(get_db),
    admin_email: str = Depends(get_current_admin),
):
    return await svc_family_detail(db, family_id=family_id)


# ---- Moderation ----


@router.get("/moderation", response_model=ModerationOverviewResponse)
async def moderation_overview(
    db: AsyncSession = Depends(get_db),
    admin_email: str = Depends(get_current_admin),
):
    await auto_lift_expired_blocks(db)

    blocked_rows = (
        await db.execute(select(User).where(User.moderation_status == "blocked"))
    ).scalars().all()
    banned_rows = (
        await db.execute(select(User).where(User.moderation_status == "banned"))
    ).scalars().all()
    blacklist_rows = (
        await db.execute(select(EmailBlacklist).order_by(EmailBlacklist.created_at.desc()))
    ).scalars().all()

    return ModerationOverviewResponse(
        blocked=[
            BlockedUserItem(
                user_id=u.id,
                email=u.email,
                reason=u.moderation_reason,
                set_by=u.moderation_set_by,
                set_at=u.moderation_set_at,
                expires_at=u.moderation_expires_at,
            )
            for u in blocked_rows
        ],
        banned=[
            BannedUserItem(
                user_id=u.id,
                email=u.email,
                reason=u.moderation_reason,
                set_by=u.moderation_set_by,
                set_at=u.moderation_set_at,
            )
            for u in banned_rows
        ],
        blacklist=[
            EmailBlacklistItem(
                email=b.email,
                source_action=b.source_action,
                source_actor_email=b.source_actor_email,
                created_at=b.created_at,
            )
            for b in blacklist_rows
        ],
    )


@router.post("/users/{user_id}/block")
async def block_endpoint(
    user_id: str,
    req: ModerationActionRequest,
    db: AsyncSession = Depends(get_db),
    admin_email: str = Depends(get_current_admin),
):
    await svc_block(db, user_id=user_id, admin_email=admin_email, reason=req.reason, expires_at=req.expires_at)
    return {"ok": True}


@router.post("/users/{user_id}/unblock")
async def unblock_endpoint(
    user_id: str,
    req: ModerationActionRequest | None = None,
    db: AsyncSession = Depends(get_db),
    admin_email: str = Depends(get_current_admin),
):
    reason = req.reason if req else None
    await svc_unblock(db, user_id=user_id, admin_email=admin_email, reason=reason)
    return {"ok": True}


@router.post("/users/{user_id}/ban")
async def ban_endpoint(
    user_id: str,
    req: ModerationActionRequest,
    db: AsyncSession = Depends(get_db),
    admin_email: str = Depends(get_current_admin),
):
    await svc_ban(db, user_id=user_id, admin_email=admin_email, reason=req.reason)
    return {"ok": True}


@router.post("/users/{user_id}/remove")
async def remove_endpoint(
    user_id: str,
    req: ModerationActionRequest,
    db: AsyncSession = Depends(get_db),
    admin_email: str = Depends(get_current_admin),
):
    snapshot = await svc_remove(db, user_id=user_id, admin_email=admin_email, reason=req.reason)
    return {"ok": True, "snapshot": snapshot}


# ---- Admin allowlist CRUD (UI) ----


@router.post("/allowlist", response_model=AdminAllowlistEntry)
async def add_admin_to_allowlist(
    req: AddAdminRequest,
    db: AsyncSession = Depends(get_db),
    admin_email: str = Depends(get_current_admin),
):
    email = req.email.lower()

    # The user must already exist with this email
    user_result = await db.execute(select(User).where(User.email == email))
    if not user_result.scalars().first():
        raise HTTPException(
            status_code=400, detail="No Oikos user found with this email — they must register first."
        )

    existing = await db.execute(select(AdminAllowlist).where(AdminAllowlist.email == email))
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="Email already in allowlist")

    entry = AdminAllowlist(email=email, added_by_admin_email=admin_email.lower())
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    await write_audit(
        db, actor_email=admin_email, action="admin.add", target_email=email
    )
    return AdminAllowlistEntry(
        id=entry.id,
        email=entry.email,
        added_by_admin_email=entry.added_by_admin_email,
        added_at=entry.added_at,
        source="db",
    )


@router.delete("/allowlist/{email}")
async def remove_admin_from_allowlist(
    email: str,
    db: AsyncSession = Depends(get_db),
    admin_email: str = Depends(get_current_admin),
):
    email_l = email.lower()
    if email_l in env_admin_emails():
        raise HTTPException(
            status_code=400,
            detail="This admin was added via environment variable and cannot be removed from the UI.",
        )

    # Prevent last-admin removal if no env admins exist
    if not env_admin_emails():
        remaining_q = await db.execute(select(func.count(AdminAllowlist.id)))
        remaining = int(remaining_q.scalar() or 0)
        if remaining <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot remove the last admin — add another admin first, or bootstrap one via OIKOS_ADMIN_EMAILS.",
            )

    result = await db.execute(select(AdminAllowlist).where(AdminAllowlist.email == email_l))
    entry = result.scalars().first()
    if not entry:
        raise HTTPException(status_code=404, detail="Allowlist entry not found")

    await db.delete(entry)
    await db.commit()

    await write_audit(
        db, actor_email=admin_email, action="admin.remove", target_email=email_l
    )
    return {"ok": True}
