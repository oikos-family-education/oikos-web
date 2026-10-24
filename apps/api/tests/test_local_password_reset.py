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


@pytest.mark.asyncio
@pytest.mark.parametrize("origin", [None, "https://evil.example"])
async def test_reset_refuses_requests_from_other_origins(desktop_client, make_user, fresh_session, origin):
    """CSRF: a page on another site must not be able to take over an account."""
    await make_user(email="eve@example.com")
    headers = {"Origin": origin} if origin else {}
    if origin is None:
        del desktop_client.headers["Origin"]
    res = await desktop_client.post(URL, headers=headers, json={
        "email": "eve@example.com", "new_password": "NewPassword1!", "confirm_password": "NewPassword1!",
    })
    assert res.status_code == 403 and res.json()["detail"]["code"] == "bad_origin"
    assert "access_token" not in res.cookies
    session = await fresh_session()
    user = (await session.execute(select(User).where(User.email == "eve@example.com"))).scalars().first()
    assert verify_password("Password123!", user.hashed_password)


@pytest.mark.asyncio
async def test_reset_accepts_localhost_origin(desktop_client, make_user):
    await make_user(email="lou@example.com")
    res = await desktop_client.post(URL, headers={"Origin": "http://localhost:47321"}, json={
        "email": "lou@example.com", "new_password": "NewPassword1!", "confirm_password": "NewPassword1!",
    })
    assert res.status_code == 200, res.text


@pytest.mark.asyncio
async def test_bad_origin_is_refused_before_the_body_is_validated(desktop_client):
    desktop_client.headers["Origin"] = "https://evil.example"
    res = await desktop_client.post(URL, json={"email": "not-an-email"})
    assert res.status_code == 403 and res.json()["detail"]["code"] == "bad_origin"
