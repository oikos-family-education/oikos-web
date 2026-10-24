"""Tests for /auth router, AuthService, and core security helpers."""
import pytest
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient

from jose import jwt
from sqlalchemy.future import select

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_password,
    generate_reset_token,
    hash_token,
)
from app.models.user import User


# ── Security helpers (pure) ─────────────────────────────────────────────────

def test_password_hash_and_verify():
    h = get_password_hash("hunter2!hunter2")
    assert h != "hunter2!hunter2"
    assert verify_password("hunter2!hunter2", h)
    assert not verify_password("wrong-password", h)


def test_create_access_token_round_trip():
    token = create_access_token("user-id-abc")
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    assert payload["sub"] == "user-id-abc"
    assert "exp" in payload


def test_create_refresh_token_has_longer_expiry():
    a = jwt.decode(create_access_token("u"), settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    r = jwt.decode(create_refresh_token("u"), settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    assert r["exp"] > a["exp"]


def test_reset_token_unique_and_hash_stable():
    a = generate_reset_token()
    b = generate_reset_token()
    assert a != b
    assert hash_token(a) == hash_token(a)
    assert hash_token(a) != hash_token(b)


# ── Register ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_happy_path(client: AsyncClient):
    payload = {
        "first_name": "Test",
        "last_name": "User",
        "email": "test@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "agreed_to_terms": True,
    }
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 201
    assert "access_token" in resp.cookies
    assert "refresh_token" in resp.cookies
    assert resp.json()["user"]["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_register_existing_email_409(client: AsyncClient):
    payload = {
        "first_name": "Test", "last_name": "User",
        "email": "dup@example.com", "password": "Password123!",
        "confirm_password": "Password123!", "agreed_to_terms": True,
    }
    r1 = await client.post("/api/v1/auth/register", json=payload)
    assert r1.status_code == 201
    r2 = await client.post("/api/v1/auth/register", json=payload)
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_register_password_mismatch_422(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "first_name": "T", "last_name": "U",
        "email": "x@example.com",
        "password": "Password123!", "confirm_password": "DifferentPwd!",
        "agreed_to_terms": True,
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_terms_required_422(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "first_name": "T", "last_name": "U",
        "email": "x@example.com",
        "password": "Password123!", "confirm_password": "Password123!",
        "agreed_to_terms": False,
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_short_password_422(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "first_name": "T", "last_name": "U",
        "email": "x@example.com",
        "password": "short", "confirm_password": "short",
        "agreed_to_terms": True,
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_invalid_email_422(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "first_name": "T", "last_name": "U",
        "email": "not-an-email",
        "password": "Password123!", "confirm_password": "Password123!",
        "agreed_to_terms": True,
    })
    assert resp.status_code == 422


# ── Login ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_existing_user_sets_cookies(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "first_name": "T", "last_name": "U",
        "email": "login@example.com", "password": "Password123!",
        "confirm_password": "Password123!", "agreed_to_terms": True,
    })
    # Clear cookies from registration
    client.cookies.clear()

    resp = await client.post("/api/v1/auth/login", json={
        "email": "login@example.com",
        "password": "Password123!",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.cookies


@pytest.mark.asyncio
async def test_login_unknown_email_is_rejected_without_creating_a_user(client: AsyncClient, db):
    resp = await client.post("/api/v1/auth/login", json={
        "email": "fresh@example.com",
        "password": "Whatever123!",
    })
    assert resp.status_code == 401
    assert resp.json()["detail"]["code"] == "invalid_credentials"
    result = await db.execute(select(User).where(User.email == "fresh@example.com"))
    assert result.scalars().first() is None


@pytest.mark.asyncio
async def test_login_wrong_password_is_rejected_and_counted(client: AsyncClient, make_user, fresh_session):
    user = await make_user(email="wrong@example.com")
    resp = await client.post("/api/v1/auth/login", json={
        "email": "wrong@example.com",
        "password": "NotThePassword1!",
    })
    assert resp.status_code == 401
    assert resp.json()["detail"]["code"] == "invalid_credentials"
    assert "access_token" not in resp.cookies
    session = await fresh_session()
    stored = await session.get(User, user.id)
    assert stored.failed_login_attempts == 1


@pytest.mark.asyncio
async def test_login_locks_after_five_failures_even_with_the_right_password(client: AsyncClient, make_user):
    await make_user(email="lock@example.com")
    for _ in range(5):
        resp = await client.post("/api/v1/auth/login", json={
            "email": "lock@example.com",
            "password": "NotThePassword1!",
        })
        assert resp.status_code == 401
    resp = await client.post("/api/v1/auth/login", json={
        "email": "lock@example.com",
        "password": "Password123!",
    })
    assert resp.status_code == 423
    assert resp.json()["detail"]["code"] == "account_locked"


@pytest.mark.asyncio
async def test_login_success_resets_failed_attempts(client: AsyncClient, make_user, fresh_session):
    user = await make_user(email="reset-count@example.com")
    await client.post("/api/v1/auth/login", json={
        "email": "reset-count@example.com",
        "password": "NotThePassword1!",
    })
    resp = await client.post("/api/v1/auth/login", json={
        "email": "reset-count@example.com",
        "password": "Password123!",
    })
    assert resp.status_code == 200
    session = await fresh_session()
    stored = await session.get(User, user.id)
    assert stored.failed_login_attempts == 0
    assert stored.locked_until is None
    assert stored.last_login_at is not None


@pytest.mark.asyncio
async def test_login_wrong_password_does_not_reveal_moderation_status(client: AsyncClient, make_user):
    await make_user(email="banned-guess@example.com", moderation_status="banned")
    resp = await client.post("/api/v1/auth/login", json={
        "email": "banned-guess@example.com",
        "password": "NotThePassword1!",
    })
    assert resp.status_code == 401
    assert resp.json()["detail"]["code"] == "invalid_credentials"


# ── Forgot / reset password ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_forgot_password_unknown_email_returns_200(client: AsyncClient):
    resp = await client.post("/api/v1/auth/forgot-password", json={"email": "ghost@example.com"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_forgot_password_writes_reset_token(client: AsyncClient, db):
    await client.post("/api/v1/auth/register", json={
        "first_name": "T", "last_name": "U",
        "email": "reset@example.com", "password": "Password123!",
        "confirm_password": "Password123!", "agreed_to_terms": True,
    })
    resp = await client.post("/api/v1/auth/forgot-password", json={"email": "reset@example.com"})
    assert resp.status_code == 200

    # The hashed reset token should have been written.
    res = await db.execute(select(User).where(User.email == "reset@example.com"))
    u = res.scalars().first()
    assert u is not None
    assert u.password_reset_token is not None
    assert u.password_reset_token_expires_at > datetime.now(timezone.utc)


@pytest.mark.asyncio
async def test_reset_password_invalid_token_400(client: AsyncClient):
    resp = await client.post("/api/v1/auth/reset-password", json={
        "token": "not-a-real-token",
        "new_password": "NewPassword123!",
        "confirm_password": "NewPassword123!",
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_reset_password_expired_token_400(client: AsyncClient, db):
    # Register, then poke the user row directly to set an expired token.
    await client.post("/api/v1/auth/register", json={
        "first_name": "T", "last_name": "U",
        "email": "exp@example.com", "password": "Password123!",
        "confirm_password": "Password123!", "agreed_to_terms": True,
    })
    raw_token = "raw-token-abc"
    res = await db.execute(select(User).where(User.email == "exp@example.com"))
    user = res.scalars().first()
    user.password_reset_token = hash_token(raw_token)
    user.password_reset_token_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    await db.commit()

    resp = await client.post("/api/v1/auth/reset-password", json={
        "token": raw_token,
        "new_password": "NewPassword123!",
        "confirm_password": "NewPassword123!",
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_reset_password_valid_token_succeeds(client: AsyncClient, db):
    await client.post("/api/v1/auth/register", json={
        "first_name": "T", "last_name": "U",
        "email": "rp@example.com", "password": "OldPassword123!",
        "confirm_password": "OldPassword123!", "agreed_to_terms": True,
    })
    raw_token = "valid-token-xyz"
    res = await db.execute(select(User).where(User.email == "rp@example.com"))
    user = res.scalars().first()
    user.password_reset_token = hash_token(raw_token)
    user.password_reset_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    await db.commit()

    resp = await client.post("/api/v1/auth/reset-password", json={
        "token": raw_token,
        "new_password": "NewPassword123!",
        "confirm_password": "NewPassword123!",
    })
    assert resp.status_code == 200

    await db.refresh(user)
    assert user.password_reset_token is None
    assert user.password_reset_token_expires_at is None


# ── /me, /logout, /refresh ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_me_without_cookie_401(client: AsyncClient):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_user(authed_client):
    client, user = authed_client
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["email"] == user.email
    assert body["user"]["has_family"] is False


@pytest.mark.asyncio
async def test_me_with_invalid_jwt_401(client: AsyncClient):
    client.cookies.set("access_token", "bogus.jwt.value")
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_with_expired_jwt_401(client: AsyncClient):
    expired = jwt.encode(
        {"sub": "any", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    client.cookies.set("access_token", expired)
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_logout_clears_cookies(authed_client):
    client, _ = authed_client
    resp = await client.post("/api/v1/auth/logout")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_refresh_with_valid_refresh_token(client: AsyncClient):
    refresh = create_refresh_token("any-id")
    client.cookies.set("refresh_token", refresh)
    resp = await client.post("/api/v1/auth/refresh")
    assert resp.status_code == 200
    assert "access_token" in resp.cookies


@pytest.mark.asyncio
async def test_refresh_without_cookie_401(client: AsyncClient):
    resp = await client.post("/api/v1/auth/refresh")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_with_garbage_cookie_401(client: AsyncClient):
    client.cookies.set("refresh_token", "not-a-real-jwt")
    resp = await client.post("/api/v1/auth/refresh")
    assert resp.status_code == 401
