"""Append-only audit log writes. Always commits immediately."""
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.beta import AuditLog


async def write_audit(
    db: AsyncSession,
    *,
    actor_email: str,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    target_email: Optional[str] = None,
    reason: Optional[str] = None,
    snapshot: Optional[dict] = None,
) -> AuditLog:
    entry = AuditLog(
        actor_email=actor_email.lower(),
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        target_email=target_email.lower() if target_email else None,
        reason=reason,
        snapshot=snapshot,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry
