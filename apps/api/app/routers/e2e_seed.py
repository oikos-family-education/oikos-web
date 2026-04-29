"""
E2E test seeding endpoint.

Mounted from `app/main.py` ONLY when the `E2E_SEED_SECRET` environment variable
is set. Never include this router in a production image — guard the include
call, not just this file.

Authentication is a static shared secret passed via `x-e2e-secret`. JWT auth
is deliberately not used here: the seed endpoint runs before any user exists,
and we want the ability to reset state from a clean slate.

See doc/12-e2e-testing-plan.md §4 for the test-account strategy.
"""
from __future__ import annotations

import os
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.e2e_seed_service import reset_e2e_data, seed_e2e_data


router = APIRouter(prefix="/api/v1/e2e", tags=["e2e"])


def _require_secret(
    x_e2e_secret: Annotated[str | None, Header(alias="x-e2e-secret")] = None,
) -> None:
    """Verify the shared secret on every e2e route.

    The env var is read on each call (not at import) so test runners can rotate
    it without restarting the API process. An empty server-side secret means
    "deny all" — never accept the empty string from a client.
    """
    expected = os.getenv("E2E_SEED_SECRET", "")
    if not expected or x_e2e_secret != expected:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="forbidden",
        )


@router.post(
    "/seed",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(_require_secret)],
)
async def seed(db: AsyncSession = Depends(get_db)) -> dict:
    """Wipe the database and create the standard E2E fixture dataset.

    Returns a manifest with credentials and IDs that tests can use without
    hardcoding values.
    """
    return await seed_e2e_data(db)


@router.post(
    "/reset",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(_require_secret)],
)
async def reset(db: AsyncSession = Depends(get_db)) -> dict:
    """Truncate every table without reseeding.

    Pair with a follow-up POST /seed call (or use the reseed endpoint) when the
    test needs the standard dataset back. Useful in `test.beforeEach` for specs
    that mutate data and want a clean slate.
    """
    await reset_e2e_data(db)
    return {"ok": True}


@router.post(
    "/reseed",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(_require_secret)],
)
async def reseed(db: AsyncSession = Depends(get_db)) -> dict:
    """Convenience: truncate + seed in one call.

    Equivalent to POST /reset followed by POST /seed but cheaper because it
    avoids round-tripping through the test runner. Returns the same manifest
    as /seed.
    """
    return await seed_e2e_data(db)
