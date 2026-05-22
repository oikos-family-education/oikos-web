"""Moderation actions: block, unblock, ban, remove. All write to audit_log."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.beta import BetaApplication
from app.models.family import Family
from app.models.family_member import FamilyMember
from app.models.moderation import EmailBlacklist
from app.models.user import User
from app.services.audit_service import write_audit


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _user_by_id(db: AsyncSession, user_id: str) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def block_user(
    db: AsyncSession,
    *,
    user_id: str,
    admin_email: str,
    reason: str,
    expires_at: Optional[datetime],
) -> User:
    user = await _user_by_id(db, user_id)
    if user.email.lower() == admin_email.lower():
        raise HTTPException(status_code=400, detail="You cannot perform this action on your own account.")
    user.moderation_status = "blocked"
    user.moderation_reason = reason
    user.moderation_set_by = admin_email.lower()
    user.moderation_set_at = _utcnow()
    user.moderation_expires_at = expires_at
    await db.commit()
    await db.refresh(user)
    # Invalidate any active sessions for this user.
    try:
        from app.services.auth_service import revoke_all_refresh_tokens
        await revoke_all_refresh_tokens(str(user.id))
    except Exception:
        # Redis-only side effect; tolerate failures (e.g. tests with mocked Redis)
        pass

    await write_audit(
        db,
        actor_email=admin_email,
        action="user.block",
        target_type="user",
        target_id=str(user.id),
        target_email=user.email,
        reason=reason,
        snapshot={"expires_at": expires_at.isoformat() if expires_at else None},
    )
    return user


async def unblock_user(db: AsyncSession, *, user_id: str, admin_email: str, reason: Optional[str] = None) -> User:
    user = await _user_by_id(db, user_id)
    if user.moderation_status != "blocked":
        raise HTTPException(status_code=409, detail="User is not currently blocked")
    user.moderation_status = "active"
    user.moderation_reason = None
    user.moderation_set_by = admin_email.lower()
    user.moderation_set_at = _utcnow()
    user.moderation_expires_at = None
    await db.commit()
    await db.refresh(user)

    await write_audit(
        db,
        actor_email=admin_email,
        action="user.unblock",
        target_type="user",
        target_id=str(user.id),
        target_email=user.email,
        reason=reason,
    )
    return user


async def ban_user(db: AsyncSession, *, user_id: str, admin_email: str, reason: str) -> User:
    user = await _user_by_id(db, user_id)
    if user.email.lower() == admin_email.lower():
        raise HTTPException(status_code=400, detail="You cannot perform this action on your own account.")
    user.moderation_status = "banned"
    user.moderation_reason = reason
    user.moderation_set_by = admin_email.lower()
    user.moderation_set_at = _utcnow()
    user.moderation_expires_at = None

    # Add to email blacklist (idempotent)
    existing = await db.execute(select(EmailBlacklist).where(EmailBlacklist.email == user.email))
    if existing.scalars().first() is None:
        db.add(
            EmailBlacklist(
                email=user.email.lower(),
                source_action="user.ban",
                source_actor_email=admin_email.lower(),
                reason=reason,
            )
        )

    await db.commit()
    await db.refresh(user)
    try:
        from app.services.auth_service import revoke_all_refresh_tokens
        await revoke_all_refresh_tokens(str(user.id))
    except Exception:
        pass

    await write_audit(
        db,
        actor_email=admin_email,
        action="user.ban",
        target_type="user",
        target_id=str(user.id),
        target_email=user.email,
        reason=reason,
    )
    return user


async def remove_user(db: AsyncSession, *, user_id: str, admin_email: str, reason: str) -> dict:
    """Hard-delete a user. If they own a family, the family and dependent rows
    are removed via CASCADE foreign keys. Returns a snapshot of what was deleted."""
    user = await _user_by_id(db, user_id)
    if user.email.lower() == admin_email.lower():
        raise HTTPException(status_code=400, detail="You cannot perform this action on your own account.")

    # Find any family this user owns to capture in the snapshot.
    fam_result = await db.execute(select(Family).where(Family.account_id == user.id))
    owned_family = fam_result.scalars().first()

    snapshot = {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
        },
        "family": None,
    }
    if owned_family:
        snapshot["family"] = {
            "id": str(owned_family.id),
            "family_name": owned_family.family_name,
        }

    target_email = user.email
    target_id = str(user.id)

    # Delete the user. CASCADE on family.account_id and related tables removes the rest.
    await db.delete(user)
    await db.commit()

    await write_audit(
        db,
        actor_email=admin_email,
        action="user.remove",
        target_type="user",
        target_id=target_id,
        target_email=target_email,
        reason=reason,
        snapshot=snapshot,
    )
    return snapshot


async def auto_lift_expired_blocks(db: AsyncSession) -> int:
    """Lift any expired blocks. Called opportunistically from list endpoints. Returns N affected."""
    now = _utcnow()
    result = await db.execute(
        select(User).where(
            User.moderation_status == "blocked",
            User.moderation_expires_at.is_not(None),
            User.moderation_expires_at < now,
        )
    )
    users = result.scalars().all()
    for u in users:
        u.moderation_status = "active"
        u.moderation_reason = None
        u.moderation_expires_at = None
    if users:
        await db.commit()
    return len(users)


async def is_email_blacklisted(db: AsyncSession, email: str) -> bool:
    result = await db.execute(select(EmailBlacklist).where(EmailBlacklist.email == email.lower()))
    return result.scalars().first() is not None
