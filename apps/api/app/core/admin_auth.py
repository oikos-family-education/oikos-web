"""Admin authentication primitives for the admin app.

Admin sessions are independent from regular user sessions:
  * Separate cookie: `admin_access_token`
  * Shorter TTL: 4 hours (vs 60min access + 365d refresh for regular users)
  * Allowlist enforcement: must be in env-var bootstrap list OR admin_allowlist DB table

The dependency `get_current_admin` returns the admin email (str).
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Set

from fastapi import Cookie, Depends, HTTPException, status
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.database import get_db
from app.models.beta import AdminAllowlist

ADMIN_ACCESS_TOKEN_TTL_HOURS = 4
ADMIN_COOKIE_NAME = "admin_access_token"


def env_admin_emails() -> Set[str]:
    """Bootstrap admin allowlist from OIKOS_ADMIN_EMAILS env var (comma-separated)."""
    raw = os.getenv("OIKOS_ADMIN_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


async def is_email_allowed(email: str, db: AsyncSession) -> bool:
    email_l = email.lower()
    if email_l in env_admin_emails():
        return True
    result = await db.execute(select(AdminAllowlist).where(AdminAllowlist.email == email_l))
    return result.scalars().first() is not None


def create_admin_access_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ADMIN_ACCESS_TOKEN_TTL_HOURS)
    to_encode = {"exp": expire, "sub": email.lower(), "scope": "admin"}
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


async def get_current_admin(
    admin_access_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> str:
    """Validate admin cookie and re-check allowlist on every request.

    Returns the admin email.
    """
    if not admin_access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = jwt.decode(
            admin_access_token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        email = payload.get("sub")
        scope = payload.get("scope")
        if not email or scope != "admin":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if not await is_email_allowed(email, db):
        # Allowlist removed mid-session — kick them out.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authorised")

    return email
