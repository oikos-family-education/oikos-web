from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core.security import verify_password
from app.models.user import User

URL = "/api/v1/auth/local-reset-password"


@pytest.mark.asyncio
async def test_resets_and_logs_in(desktop_client, make_user, fresh_session):
    await make_user(email="ana@example.com")
    res = await desktop_client.post(URL, json={
        "email": "ANA@example.com", "new_password": "NewPassword1!", "confirm_password": "NewPassword1!",
    })
    assert res.status_code == 200
    assert "access_token" in res.cookies
    assert res.json()["user"]["email"] == "ana@example.com"

    session = await fresh_session()
    user = (await session.execute(select(User).where(User.email == "ana@example.com"))).scalars().first()
    assert verify_password("NewPassword1!", user.hashed_password)

    login = await desktop_client.post("/api/v1/auth/login", json={"email": "ana@example.com", "password": "NewPassword1!"})
    assert login.status_code == 200


@pytest.mark.asyncio
async def test_clears_lockout(desktop_client, make_user, fresh_session):
    await make_user(
        email="lock@example.com",
        failed_login_attempts=5,
        locked_until=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    res = await desktop_client.post(URL, json={
        "email": "lock@example.com", "new_password": "NewPassword1!", "confirm_password": "NewPassword1!",
    })
    assert res.status_code == 200

    session = await fresh_session()
    user = (await session.execute(select(User).where(User.email == "lock@example.com"))).scalars().first()
    assert user.failed_login_attempts == 0
    assert user.locked_until is None


@pytest.mark.asyncio
async def test_unknown_email_404(desktop_client):
    res = await desktop_client.post(URL, json={
        "email": "nobody@example.com", "new_password": "NewPassword1!", "confirm_password": "NewPassword1!",
    })
    assert res.status_code == 404 and res.json()["detail"]["code"] == "account_not_found"


@pytest.mark.asyncio
async def test_short_or_mismatched_password_422(desktop_client, make_user):
    await make_user(email="b@example.com")
    for body in (
        {"new_password": "short", "confirm_password": "short"},
        {"new_password": "NewPassword1!", "confirm_password": "Different1!!"},
    ):
        res = await desktop_client.post(URL, json={"email": "b@example.com", **body})
        assert res.status_code == 422


@pytest.mark.asyncio
async def test_absent_in_cloud(client):
    res = await client.post(URL, json={
        "email": "a@example.com", "new_password": "NewPassword1!", "confirm_password": "NewPassword1!",
    })
    assert res.status_code in (404, 405)
