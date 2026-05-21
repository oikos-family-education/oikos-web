"""Tests for the closed-beta program: public funnel, admin actions, audit log,
and invite-token consumption on registration.
"""
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.future import select

from app.core.admin_auth import create_admin_access_token
from app.core.security import get_password_hash, hash_token
from app.main import app
from app.models.beta import AdminAllowlist, AuditLog, BetaApplication
from app.models.user import User


VALID_REASON = "I am a homeschooling parent looking for a tool to plan and track lessons for my three children, ages 6, 9, and 12."


# ───────────────────────── helpers ─────────────────────────


@pytest_asyncio.fixture
async def admin_client(db):
    # Seed an admin user + add them to the DB allowlist
    admin_user = User(
        email="admin@oikos.test",
        first_name="Admin",
        last_name="Person",
        hashed_password=get_password_hash("Password123!"),
    )
    db.add(admin_user)
    db.add(AdminAllowlist(email="admin@oikos.test"))
    await db.commit()

    token = create_admin_access_token("admin@oikos.test")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.cookies.set("admin_access_token", token)
        yield ac


async def _make_application(client: AsyncClient, **overrides) -> dict:
    payload = {
        "first_name": overrides.get("first_name", "Jane"),
        "last_name": overrides.get("last_name", "Doe"),
        "email": overrides.get("email", f"jane-{uuid.uuid4().hex[:6]}@example.com"),
        "reason": overrides.get("reason", VALID_REASON),
    }
    res = await client.post("/api/v1/beta/applications", json=payload)
    assert res.status_code == 201
    return payload


# ───────────────────────── public funnel ─────────────────────────


@pytest.mark.asyncio
async def test_public_submission_creates_application(client, db):
    payload = {
        "first_name": "Jane",
        "last_name": "Doe",
        "email": "jane@example.com",
        "reason": VALID_REASON,
    }
    res = await client.post("/api/v1/beta/applications", json=payload)
    assert res.status_code == 201
    body = res.json()
    assert body == {"received": True, "duplicate": False}

    result = await db.execute(select(BetaApplication).where(BetaApplication.email == "jane@example.com"))
    app_row = result.scalars().first()
    assert app_row is not None
    assert app_row.status == "pending"
    assert app_row.reason == VALID_REASON


@pytest.mark.asyncio
async def test_duplicate_submission_is_idempotent(client, db):
    payload = {
        "first_name": "Jane",
        "last_name": "Doe",
        "email": "jane@example.com",
        "reason": VALID_REASON,
    }
    res1 = await client.post("/api/v1/beta/applications", json=payload)
    res2 = await client.post("/api/v1/beta/applications", json=payload)
    assert res1.status_code == 201
    assert res2.status_code == 201
    assert res2.json()["duplicate"] is True

    result = await db.execute(select(BetaApplication))
    rows = result.scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_honeypot_is_silently_dropped(client, db):
    payload = {
        "first_name": "Bot",
        "last_name": "Bot",
        "email": "bot@example.com",
        "reason": VALID_REASON,
        "website": "http://spam.example.com",
    }
    res = await client.post("/api/v1/beta/applications", json=payload)
    assert res.status_code == 201

    result = await db.execute(select(BetaApplication))
    assert result.scalars().first() is None


@pytest.mark.asyncio
async def test_reason_min_length_is_enforced(client):
    payload = {
        "first_name": "Jane",
        "last_name": "Doe",
        "email": "jane@example.com",
        "reason": "too short",
    }
    res = await client.post("/api/v1/beta/applications", json=payload)
    assert res.status_code == 422


# ───────────────────────── admin auth ─────────────────────────


@pytest.mark.asyncio
async def test_admin_endpoints_require_auth(client):
    res = await client.get("/api/v1/admin/beta/applications")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_admin_login_rejects_non_allowlisted_email(client, db):
    # Create a user but don't add them to the allowlist
    user = User(
        email="nobody@example.com",
        first_name="No",
        last_name="Body",
        hashed_password=get_password_hash("Password123!"),
    )
    db.add(user)
    await db.commit()

    res = await client.post(
        "/api/v1/admin/auth/login",
        json={"email": "nobody@example.com", "password": "Password123!"},
    )
    assert res.status_code == 401

    # And an audit_log row was written
    result = await db.execute(select(AuditLog).where(AuditLog.action == "admin.login_denied"))
    assert result.scalars().first() is not None


@pytest.mark.asyncio
async def test_admin_login_succeeds_for_allowlisted_user(client, db):
    user = User(
        email="admin@example.com",
        first_name="Admin",
        last_name="Person",
        hashed_password=get_password_hash("Password123!"),
    )
    db.add(user)
    db.add(AdminAllowlist(email="admin@example.com"))
    await db.commit()

    res = await client.post(
        "/api/v1/admin/auth/login",
        json={"email": "admin@example.com", "password": "Password123!"},
    )
    assert res.status_code == 200
    assert "admin_access_token" in res.cookies

    me = await client.get("/api/v1/admin/auth/me", cookies={"admin_access_token": res.cookies["admin_access_token"]})
    assert me.status_code == 200
    assert me.json()["email"] == "admin@example.com"


# ───────────────────────── admin actions ─────────────────────────


@pytest.mark.asyncio
async def test_admin_lists_pending_applications(admin_client, client):
    await _make_application(client, email="a@example.com")
    await _make_application(client, email="b@example.com")

    res = await admin_client.get("/api/v1/admin/beta/applications?status=pending")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 2
    assert body["pending_count"] == 2
    assert body["cap"] == 50
    assert len(body["items"]) == 2


@pytest.mark.asyncio
async def test_admin_approves_pending_application_and_writes_audit(admin_client, client, db):
    await _make_application(client, email="alice@example.com")
    result = await db.execute(select(BetaApplication))
    app_row = result.scalars().first()

    res = await admin_client.post(
        f"/api/v1/admin/beta/applications/{app_row.id}/approve", json={}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "approved"
    assert body["decided_by_admin_email"] == "admin@oikos.test"
    assert body["invite_sent_at"] is not None
    assert body["invite_token_expires_at"] is not None

    # Audit log written
    audit_result = await db.execute(
        select(AuditLog).where(AuditLog.action == "beta.approve")
    )
    assert audit_result.scalars().first() is not None


@pytest.mark.asyncio
async def test_admin_denies_application(admin_client, client, db):
    await _make_application(client, email="bob@example.com")
    result = await db.execute(select(BetaApplication))
    app_row = result.scalars().first()

    res = await admin_client.post(
        f"/api/v1/admin/beta/applications/{app_row.id}/deny", json={"note": "not a fit"}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "denied"
    assert body["internal_note"] == "not a fit"

    audit_result = await db.execute(select(AuditLog).where(AuditLog.action == "beta.deny"))
    assert audit_result.scalars().first() is not None


@pytest.mark.asyncio
async def test_admin_reopens_denied_application(admin_client, client, db):
    await _make_application(client, email="carol@example.com")
    result = await db.execute(select(BetaApplication))
    app_row = result.scalars().first()
    await admin_client.post(f"/api/v1/admin/beta/applications/{app_row.id}/deny", json={})

    res = await admin_client.post(f"/api/v1/admin/beta/applications/{app_row.id}/reopen", json={})
    assert res.status_code == 200
    assert res.json()["status"] == "pending"


@pytest.mark.asyncio
async def test_admin_approve_over_cap_requires_confirmation(admin_client, client, db):
    # Manually create 50 approved applications by going through the API
    for i in range(50):
        app_row = BetaApplication(
            first_name=f"User{i}",
            last_name="X",
            email=f"u{i}@example.com",
            reason=VALID_REASON,
            status="approved",
        )
        db.add(app_row)
    await db.commit()

    # And one pending one we'll try to approve
    await _make_application(client, email="overcap@example.com")
    result = await db.execute(select(BetaApplication).where(BetaApplication.email == "overcap@example.com"))
    overcap_app = result.scalars().first()

    # First attempt: no confirmation → 409
    res = await admin_client.post(
        f"/api/v1/admin/beta/applications/{overcap_app.id}/approve", json={}
    )
    assert res.status_code == 409
    assert res.json()["detail"]["code"] == "over_cap_confirmation_required"

    # Second attempt: with confirmation → 200, special audit action
    res = await admin_client.post(
        f"/api/v1/admin/beta/applications/{overcap_app.id}/approve",
        json={"over_cap_confirmed": True},
    )
    assert res.status_code == 200

    audit_result = await db.execute(
        select(AuditLog).where(AuditLog.action == "beta.approve_over_cap")
    )
    assert audit_result.scalars().first() is not None


@pytest.mark.asyncio
async def test_admin_resends_invite_with_fresh_token(admin_client, client, db):
    await _make_application(client, email="dan@example.com")
    result = await db.execute(select(BetaApplication))
    app_row = result.scalars().first()
    await admin_client.post(f"/api/v1/admin/beta/applications/{app_row.id}/approve", json={})

    await db.refresh(app_row)
    old_hash = app_row.invite_token_hash

    res = await admin_client.post(
        f"/api/v1/admin/beta/applications/{app_row.id}/resend-invite", json={}
    )
    assert res.status_code == 200

    await db.refresh(app_row)
    assert app_row.invite_token_hash != old_hash


@pytest.mark.asyncio
async def test_admin_updates_internal_note(admin_client, client, db):
    await _make_application(client, email="ellen@example.com")
    result = await db.execute(select(BetaApplication))
    app_row = result.scalars().first()

    res = await admin_client.patch(
        f"/api/v1/admin/beta/applications/{app_row.id}/note",
        json={"note": "follow up next week"},
    )
    assert res.status_code == 200
    assert res.json()["internal_note"] == "follow up next week"


# ───────────────────────── invite token + registration ─────────────────────────


@pytest.mark.asyncio
async def test_invite_token_validation_endpoint(admin_client, client, db):
    await _make_application(client, email="frank@example.com")
    result = await db.execute(select(BetaApplication))
    app_row = result.scalars().first()

    # Approve to generate a token; intercept the raw token via the service
    from app.services import beta_service
    _, raw_token = await beta_service.approve(
        db, app_id=str(app_row.id), admin_email="admin@oikos.test"
    )

    res = await client.get(f"/api/v1/beta/invite/validate?token={raw_token}")
    assert res.status_code == 200
    body = res.json()
    assert body["valid"] is True
    assert body["email"] == "frank@example.com"
    assert body["first_name"] == "Jane"  # default from _make_application

    # Unknown token → invalid
    res = await client.get("/api/v1/beta/invite/validate?token=" + "x" * 40)
    assert res.json()["valid"] is False


@pytest.mark.asyncio
async def test_register_with_invite_token_links_application(client, db):
    # Create + approve application
    payload = {
        "first_name": "Grace",
        "last_name": "Hopper",
        "email": "grace@example.com",
        "reason": VALID_REASON,
    }
    await client.post("/api/v1/beta/applications", json=payload)
    result = await db.execute(select(BetaApplication))
    app_row = result.scalars().first()
    from app.services import beta_service
    _, raw_token = await beta_service.approve(
        db, app_id=str(app_row.id), admin_email="admin@oikos.test"
    )

    # Register using the invite
    res = await client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Grace",
            "last_name": "Hopper",
            "email": "grace@example.com",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "agreed_to_terms": True,
            "invite_token": raw_token,
        },
    )
    assert res.status_code == 201

    await db.refresh(app_row)
    assert app_row.invite_consumed_at is not None
    assert app_row.registered_user_id is not None
    assert app_row.invite_token_hash is None  # invalidated after use


@pytest.mark.asyncio
async def test_register_rejects_mismatched_email_on_invite(client, db):
    await client.post(
        "/api/v1/beta/applications",
        json={
            "first_name": "Hannah",
            "last_name": "Test",
            "email": "hannah@example.com",
            "reason": VALID_REASON,
        },
    )
    result = await db.execute(select(BetaApplication))
    app_row = result.scalars().first()
    from app.services import beta_service
    _, raw_token = await beta_service.approve(
        db, app_id=str(app_row.id), admin_email="admin@oikos.test"
    )

    res = await client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Hannah",
            "last_name": "Test",
            "email": "not-hannah@example.com",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "agreed_to_terms": True,
            "invite_token": raw_token,
        },
    )
    assert res.status_code == 400
    assert res.json()["detail"]["code"] == "invite_email_mismatch"


@pytest.mark.asyncio
async def test_register_rejects_consumed_invite(client, db):
    # First registration succeeds
    payload = {
        "first_name": "Ivan",
        "last_name": "Test",
        "email": "ivan@example.com",
        "reason": VALID_REASON,
    }
    await client.post("/api/v1/beta/applications", json=payload)
    result = await db.execute(select(BetaApplication))
    app_row = result.scalars().first()
    from app.services import beta_service
    _, raw_token = await beta_service.approve(
        db, app_id=str(app_row.id), admin_email="admin@oikos.test"
    )

    res = await client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Ivan",
            "last_name": "Test",
            "email": "ivan@example.com",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "agreed_to_terms": True,
            "invite_token": raw_token,
        },
    )
    assert res.status_code == 201

    # Second attempt with same token → 400 (the token was invalidated after consume)
    res = await client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Ivan2",
            "last_name": "Test",
            "email": "ivan2@example.com",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "agreed_to_terms": True,
            "invite_token": raw_token,
        },
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_admin_audit_log_endpoint(admin_client, client, db):
    await _make_application(client, email="kate@example.com")
    result = await db.execute(select(BetaApplication))
    app_row = result.scalars().first()
    await admin_client.post(f"/api/v1/admin/beta/applications/{app_row.id}/deny", json={})

    res = await admin_client.get("/api/v1/admin/audit-log")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] >= 1
    actions = [e["action"] for e in body["items"]]
    assert "beta.deny" in actions


@pytest.mark.asyncio
async def test_admin_allowlist_endpoint_returns_db_and_env(admin_client, db, monkeypatch):
    db.add(AdminAllowlist(email="alice@example.com"))
    db.add(AdminAllowlist(email="bob@example.com"))
    await db.commit()

    monkeypatch.setenv("OIKOS_ADMIN_EMAILS", "boot@example.com,alice@example.com")

    res = await admin_client.get("/api/v1/admin/allowlist")
    assert res.status_code == 200
    items = res.json()
    emails_by_source = {(e["email"], e["source"]) for e in items}
    assert ("alice@example.com", "db") in emails_by_source
    assert ("bob@example.com", "db") in emails_by_source
    assert ("boot@example.com", "env") in emails_by_source
