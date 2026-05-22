"""Public beta endpoints — no auth required. Mounted at /api/v1/beta."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.beta import (
    BetaApplicationCreate,
    BetaApplicationPublicAck,
    InviteTokenValidationResponse,
)
from app.services.auth_service import check_rate_limit
from app.services.beta_service import find_application_by_invite_token, submit_application

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/beta", tags=["beta-public"])


@router.post("/applications", response_model=BetaApplicationPublicAck, status_code=201)
async def public_submit(
    request: Request,
    payload: BetaApplicationCreate,
    db: AsyncSession = Depends(get_db),
):
    # Honeypot: silently accept and discard
    if payload.website:
        logger.info("[beta] honeypot tripped from ip=%s", request.client.host if request.client else "?")
        return BetaApplicationPublicAck(received=True, duplicate=False)

    ip = request.client.host if request.client else "127.0.0.1"
    await check_rate_limit(f"ratelimit:beta:{ip}", 5, 3600)

    _, duplicate = await submit_application(db, payload)
    return BetaApplicationPublicAck(received=True, duplicate=duplicate)


@router.get("/invite/validate", response_model=InviteTokenValidationResponse)
async def validate_invite(
    token: str = Query(..., min_length=8),
    db: AsyncSession = Depends(get_db),
):
    """Used by /register?invite=... to pre-fill and lock the email."""
    from datetime import datetime, timezone

    app = await find_application_by_invite_token(db, token)
    if not app:
        return InviteTokenValidationResponse(valid=False, reason="unknown")
    if app.invite_consumed_at is not None:
        return InviteTokenValidationResponse(valid=False, reason="used")
    if app.invite_token_expires_at and app.invite_token_expires_at < datetime.now(timezone.utc):
        return InviteTokenValidationResponse(valid=False, reason="expired")
    return InviteTokenValidationResponse(
        valid=True,
        email=app.email,
        first_name=app.first_name,
        last_name=app.last_name,
    )
