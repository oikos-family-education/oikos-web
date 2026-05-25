"""Tests for Admin Center features (#18): overview, families, moderation, allowlist CRUD."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.future import select

from app.core.admin_auth import create_admin_access_token
from app.core.security import get_password_hash
from app.main import app
from app.models.beta import AdminAllowlist, AuditLog
from app.models.family import Family
from app.models.family_member import FamilyMember
from app.models.moderation import EmailBlacklist
from app.models.user import User


@pytest_asyncio.fixture
async def admin_client(db):
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


async def _seed_family(db, owner_email: str):
    user = User(
        email=owner_email,
        first_name="O",
        last_name="W",
        hashed_password=get_password_hash("Password123!"),
    )
    db.add(user)
    await db.flush()
    family = Family(
        account_id=user.id,
        family_name=f"Family-{uuid.uuid4().hex[:6]}",
        family_name_slug=f"fam-{uuid.uuid4().hex[:6]}",
        shield_config={},
    )
    db.add(family)
    await db.flush()
    db.add(FamilyMember(family_id=family.id, user_id=user.id, role="primary"))
    await db.commit()
    await db.refresh(user)
    await db.refresh(family)
    return user, family


# ───────────────────────── Overview ─────────────────────────


@pytest.mark.asyncio
async def test_overview_returns_counts_trend_and_families(admin_client, db):
    await _seed_family(db, "owner1@example.com")
    await _seed_family(db, "owner2@example.com")

    res = await admin_client.get("/api/v1/admin/overview")
    assert res.status_code == 200
    body = res.json()
    assert body["counts"]["families"]["total"] >= 2
    assert "users" in body["counts"]
    assert body["beta"]["cap"] == 50
    assert len(body["trend"]) == 30
    assert len(body["most_active_families"]) >= 2


# ───────────────────────── Families ─────────────────────────


@pytest.mark.asyncio
async def test_families_list_and_search(admin_client, db):
    await _seed_family(db, "alpha@example.com")
    u, _ = await _seed_family(db, "bravo@example.com")

    res = await admin_client.get("/api/v1/admin/families")
    assert res.status_code == 200
    assert res.json()["total"] >= 2

    res = await admin_client.get("/api/v1/admin/families?search=bravo")
    items = res.json()["items"]
    assert all("bravo" in (i["owner_email"] or "") for i in items)


@pytest.mark.asyncio
async def test_family_detail(admin_client, db):
    user, fam = await _seed_family(db, "owner@example.com")

    res = await admin_client.get(f"/api/v1/admin/families/{fam.id}")
    assert res.status_code == 200
    body = res.json()
    assert body["family_name"] == fam.family_name
    assert body["owner_email"] == "owner@example.com"
    assert len(body["members"]) == 1
    assert body["content_counts"]["subjects"] == 0


@pytest.mark.asyncio
async def test_family_detail_does_not_leak_children_names(admin_client, db):
    """Admins should not see children's first names or nicknames — children are minors."""
    from app.models.child import Child

    user, fam = await _seed_family(db, "owner-with-kids@example.com")

    db.add(
        Child(
            family_id=fam.id,
            first_name="Alice",
            nickname="Ally",
        )
    )
    db.add(
        Child(
            family_id=fam.id,
            first_name="Bobby",
        )
    )
    await db.commit()

    res = await admin_client.get(f"/api/v1/admin/families/{fam.id}")
    assert res.status_code == 200
    body = res.json()

    assert len(body["children"]) == 2
    payload = res.text
    for forbidden in ("Alice", "Ally", "Bobby"):
        assert forbidden not in payload, (
            f"Children PII '{forbidden}' was leaked in admin family detail response"
        )

    for child in body["children"]:
        assert "first_name" not in child
        assert "nickname" not in child
        assert "child_id" in child
        assert "created_at" in child


# ───────────────────────── Moderation: block ─────────────────────────


@pytest.mark.asyncio
async def test_block_user_sets_status_and_writes_audit(admin_client, db):
    user, _ = await _seed_family(db, "target@example.com")

    res = await admin_client.post(
        f"/api/v1/admin/users/{user.id}/block",
        json={"reason": "violated terms", "expires_at": None},
    )
    assert res.status_code == 200

    await db.refresh(user)
    assert user.moderation_status == "blocked"
    assert user.moderation_reason == "violated terms"

    log = (
        await db.execute(select(AuditLog).where(AuditLog.action == "user.block"))
    ).scalars().first()
    assert log is not None


@pytest.mark.asyncio
async def test_blocked_user_cannot_log_in(client, db):
    user = User(
        email="blocked@example.com",
        first_name="B",
        last_name="L",
        hashed_password=get_password_hash("Password123!"),
        moderation_status="blocked",
        moderation_reason="too noisy",
    )
    db.add(user)
    await db.commit()

    res = await client.post(
        "/api/v1/auth/login",
        json={"email": "blocked@example.com", "password": "Password123!"},
    )
    assert res.status_code == 403
    assert res.json()["detail"]["code"] == "account_blocked"


@pytest.mark.asyncio
async def test_expired_block_auto_lifts_on_login(client, db):
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    user = User(
        email="lifted@example.com",
        first_name="L",
        last_name="L",
        hashed_password=get_password_hash("Password123!"),
        moderation_status="blocked",
        moderation_reason="cooling off",
        moderation_expires_at=yesterday,
    )
    db.add(user)
    await db.commit()

    res = await client.post(
        "/api/v1/auth/login",
        json={"email": "lifted@example.com", "password": "Password123!"},
    )
    assert res.status_code == 200
    await db.refresh(user)
    assert user.moderation_status == "active"


@pytest.mark.asyncio
async def test_unblock_user(admin_client, db):
    user, _ = await _seed_family(db, "u@example.com")
    user.moderation_status = "blocked"
    user.moderation_reason = "test"
    await db.commit()

    res = await admin_client.post(
        f"/api/v1/admin/users/{user.id}/unblock",
        json={"reason": "appeal accepted"},
    )
    assert res.status_code == 200
    await db.refresh(user)
    assert user.moderation_status == "active"


# ───────────────────────── Moderation: ban ─────────────────────────


@pytest.mark.asyncio
async def test_ban_user_adds_email_to_blacklist(admin_client, db):
    user, _ = await _seed_family(db, "spammer@example.com")

    res = await admin_client.post(
        f"/api/v1/admin/users/{user.id}/ban", json={"reason": "spam"}
    )
    assert res.status_code == 200

    await db.refresh(user)
    assert user.moderation_status == "banned"

    bl = (
        await db.execute(select(EmailBlacklist).where(EmailBlacklist.email == "spammer@example.com"))
    ).scalars().first()
    assert bl is not None
    assert bl.source_action == "user.ban"


@pytest.mark.asyncio
async def test_banned_email_cannot_register(client, db):
    db.add(EmailBlacklist(email="banned@example.com", source_action="user.ban"))
    await db.commit()

    res = await client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Re",
            "last_name": "Try",
            "email": "banned@example.com",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "agreed_to_terms": True,
        },
    )
    assert res.status_code == 400
    assert res.json()["detail"]["code"] == "email_blocked"


@pytest.mark.asyncio
async def test_banned_user_cannot_log_in(client, db):
    user = User(
        email="banned-user@example.com",
        first_name="B",
        last_name="U",
        hashed_password=get_password_hash("Password123!"),
        moderation_status="banned",
        moderation_reason="bad behavior",
    )
    db.add(user)
    await db.commit()

    res = await client.post(
        "/api/v1/auth/login",
        json={"email": "banned-user@example.com", "password": "Password123!"},
    )
    assert res.status_code == 403
    assert res.json()["detail"]["code"] == "account_banned"


# ───────────────────────── Moderation: remove ─────────────────────────


@pytest.mark.asyncio
async def test_remove_user_deletes_account_and_family(admin_client, db):
    user, fam = await _seed_family(db, "doomed@example.com")
    user_id = user.id
    fam_id = fam.id

    res = await admin_client.post(
        f"/api/v1/admin/users/{user_id}/remove", json={"reason": "user requested"}
    )
    assert res.status_code == 200
    assert res.json()["snapshot"]["user"]["email"] == "doomed@example.com"

    # User and family gone
    assert (await db.execute(select(User).where(User.id == user_id))).scalars().first() is None
    assert (await db.execute(select(Family).where(Family.id == fam_id))).scalars().first() is None

    log = (
        await db.execute(select(AuditLog).where(AuditLog.action == "user.remove"))
    ).scalars().first()
    assert log is not None
    assert log.snapshot["family"]["id"] == str(fam_id)


@pytest.mark.asyncio
async def test_admin_cannot_act_on_self(admin_client, db):
    me = (await db.execute(select(User).where(User.email == "admin@oikos.test"))).scalars().first()

    res = await admin_client.post(
        f"/api/v1/admin/users/{me.id}/block", json={"reason": "test"}
    )
    assert res.status_code == 400


# ───────────────────────── Moderation overview screen ─────────────────────────


@pytest.mark.asyncio
async def test_moderation_overview_lists_all_three(admin_client, db):
    u1, _ = await _seed_family(db, "b1@example.com")
    u2, _ = await _seed_family(db, "b2@example.com")
    u1.moderation_status = "blocked"
    u1.moderation_reason = "x"
    u2.moderation_status = "banned"
    u2.moderation_reason = "y"
    db.add(EmailBlacklist(email="ghost@example.com", source_action="user.ban"))
    await db.commit()

    res = await admin_client.get("/api/v1/admin/moderation")
    assert res.status_code == 200
    body = res.json()
    assert len(body["blocked"]) == 1
    assert len(body["banned"]) == 1
    assert any(item["email"] == "ghost@example.com" for item in body["blacklist"])


# ───────────────────────── Admin allowlist CRUD ─────────────────────────


@pytest.mark.asyncio
async def test_add_admin_requires_existing_user(admin_client):
    res = await admin_client.post(
        "/api/v1/admin/allowlist", json={"email": "ghost@example.com"}
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_add_admin_succeeds(admin_client, db):
    db.add(
        User(
            email="newadmin@example.com",
            first_name="New",
            last_name="Admin",
            hashed_password=get_password_hash("Password123!"),
        )
    )
    await db.commit()

    res = await admin_client.post(
        "/api/v1/admin/allowlist", json={"email": "newadmin@example.com"}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == "newadmin@example.com"
    assert body["added_by_admin_email"] == "admin@oikos.test"


@pytest.mark.asyncio
async def test_remove_admin_blocked_for_env_emails(admin_client, monkeypatch):
    monkeypatch.setenv("OIKOS_ADMIN_EMAILS", "env@example.com")
    res = await admin_client.request(
        "DELETE", "/api/v1/admin/allowlist/env@example.com"
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_remove_admin_blocks_last_admin_when_no_env(admin_client, db, monkeypatch):
    monkeypatch.setenv("OIKOS_ADMIN_EMAILS", "")
    res = await admin_client.request(
        "DELETE", "/api/v1/admin/allowlist/admin@oikos.test"
    )
    assert res.status_code == 400
    assert "last admin" in res.json()["detail"].lower()
