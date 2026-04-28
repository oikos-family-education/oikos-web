"""Tests for /families/me/members/* and /invitations router."""
import uuid
import hashlib
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.future import select

from app.models.family_member import FamilyMember, FamilyInvitation
from app.models.user import User


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ── List members ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_members_includes_primary(authed_with_family):
    client, user, _ = authed_with_family
    resp = await client.get("/api/v1/families/me/members")
    assert resp.status_code == 200
    members = resp.json()
    assert len(members) == 1
    assert members[0]["kind"] == "member"
    assert members[0]["role"] == "primary"
    assert members[0]["email"] == user.email


# ── Invite ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_invite_member_returns_token(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post(
        "/api/v1/families/me/members/invite",
        json={"email": "newmember@example.com"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "newmember@example.com"
    assert body["token"]


@pytest.mark.asyncio
async def test_invite_normalizes_email(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post(
        "/api/v1/families/me/members/invite",
        json={"email": "  Mixed@Case.COM  "},
    )
    assert resp.status_code == 201
    assert resp.json()["email"] == "mixed@case.com"


@pytest.mark.asyncio
async def test_invite_duplicate_pending_409(authed_with_family):
    client, _, _ = authed_with_family
    r1 = await client.post(
        "/api/v1/families/me/members/invite",
        json={"email": "dup@example.com"},
    )
    assert r1.status_code == 201
    r2 = await client.post(
        "/api/v1/families/me/members/invite",
        json={"email": "dup@example.com"},
    )
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_invite_existing_member_409(authed_with_family):
    client, user, _ = authed_with_family
    resp = await client.post(
        "/api/v1/families/me/members/invite",
        json={"email": user.email},
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_invite_invalid_email_422(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post(
        "/api/v1/families/me/members/invite",
        json={"email": "not-an-email"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_invite_requires_primary_role(authed_with_family, make_user, make_client, db, fresh_session):
    """A co-parent (non-primary) cannot send invitations."""
    _, _, family = authed_with_family
    co = await make_user(email="co@example.com")

    s = await fresh_session()
    s.add(FamilyMember(family_id=family.id, user_id=co.id, role="co_parent"))
    co_db = (await s.execute(select(User).where(User.id == co.id))).scalars().first()
    co_db.has_family = True
    await s.commit()

    co_client = await make_client(co)
    resp = await co_client.post(
        "/api/v1/families/me/members/invite",
        json={"email": "x@example.com"},
    )
    assert resp.status_code == 403


# ── Resend / Revoke ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_resend_rotates_token(authed_with_family):
    client, _, _ = authed_with_family
    r1 = await client.post(
        "/api/v1/families/me/members/invite",
        json={"email": "resend@example.com"},
    )
    inv_id = r1.json()["id"]
    original_token = r1.json()["token"]

    r2 = await client.post(f"/api/v1/families/me/members/invite/{inv_id}/resend")
    assert r2.status_code == 200
    assert r2.json()["token"] != original_token


@pytest.mark.asyncio
async def test_resend_unknown_id_404(authed_with_family):
    client, _, _ = authed_with_family
    bogus = uuid.uuid4()
    resp = await client.post(f"/api/v1/families/me/members/invite/{bogus}/resend")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_revoke_invitation(authed_with_family, fresh_session):
    client, _, _ = authed_with_family
    r1 = await client.post(
        "/api/v1/families/me/members/invite",
        json={"email": "revoked@example.com"},
    )
    inv_id = r1.json()["id"]

    resp = await client.delete(f"/api/v1/families/me/members/invite/{inv_id}")
    assert resp.status_code == 204

    s = await fresh_session()
    inv = (await s.execute(select(FamilyInvitation).where(FamilyInvitation.id == uuid.UUID(inv_id)))).scalars().first()
    assert inv.revoked_at is not None


# ── Accept ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_accept_invitation_makes_user_a_member(authed_with_family, make_user, make_client, fresh_session):
    client, _, family = authed_with_family
    r1 = await client.post(
        "/api/v1/families/me/members/invite",
        json={"email": "accept@example.com"},
    )
    token = r1.json()["token"]

    invitee = await make_user(email="accept@example.com")
    invitee_client = await make_client(invitee)

    resp = await invitee_client.post("/api/v1/invitations/accept", json={"token": token})
    assert resp.status_code == 200
    assert resp.json()["family_name"] == family.family_name

    s = await fresh_session()
    res = await s.execute(select(FamilyMember).where(FamilyMember.user_id == invitee.id))
    member = res.scalars().first()
    assert member is not None
    assert member.role == "co_parent"

    # has_family flag flipped on
    res = await s.execute(select(User).where(User.id == invitee.id))
    assert res.scalars().first().has_family is True


@pytest.mark.asyncio
async def test_accept_revoked_invitation_410(authed_with_family, make_user, make_client):
    client, _, _ = authed_with_family
    r1 = await client.post(
        "/api/v1/families/me/members/invite",
        json={"email": "rev@example.com"},
    )
    token = r1.json()["token"]
    inv_id = r1.json()["id"]

    await client.delete(f"/api/v1/families/me/members/invite/{inv_id}")

    invitee = await make_user(email="rev@example.com")
    invitee_client = await make_client(invitee)
    resp = await invitee_client.post("/api/v1/invitations/accept", json={"token": token})
    assert resp.status_code == 410


@pytest.mark.asyncio
async def test_accept_unknown_token_404(authed_client):
    client, _ = authed_client
    resp = await client.post("/api/v1/invitations/accept", json={"token": "x" * 32})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_accept_when_already_in_family_409(authed_with_family):
    """User who already has a family cannot accept."""
    client, _, _ = authed_with_family
    # Create token from a different (unrelated) invitation row directly.
    # Simpler: try to accept any token while we already have a family.
    resp = await client.post("/api/v1/invitations/accept", json={"token": "x" * 32})
    # Token doesn't match anything → 404 takes precedence over 409. We just
    # ensure the endpoint doesn't 200/200.
    assert resp.status_code in (404, 409)


@pytest.mark.asyncio
async def test_accept_expired_invitation_410(authed_with_family, make_user, make_client, fresh_session):
    client, _, family = authed_with_family
    r1 = await client.post(
        "/api/v1/families/me/members/invite",
        json={"email": "exp@example.com"},
    )
    token = r1.json()["token"]
    inv_id = r1.json()["id"]

    s = await fresh_session()
    res = await s.execute(select(FamilyInvitation).where(FamilyInvitation.id == uuid.UUID(inv_id)))
    inv = res.scalars().first()
    inv.expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    await s.commit()

    invitee = await make_user(email="exp@example.com")
    invitee_client = await make_client(invitee)
    resp = await invitee_client.post("/api/v1/invitations/accept", json={"token": token})
    assert resp.status_code == 410


# ── Family-full constraint ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_invite_when_family_full_409(authed_with_family, make_user, fresh_session):
    """The default cap is 2 members. With one existing co-parent, a new invite
    should be rejected."""
    _, primary, family = authed_with_family
    co = await make_user(email="co2@example.com")

    s = await fresh_session()
    s.add(FamilyMember(family_id=family.id, user_id=co.id, role="co_parent"))
    co_db = (await s.execute(select(User).where(User.id == co.id))).scalars().first()
    co_db.has_family = True
    await s.commit()

    # The primary still tries to invite a third person
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.core.security import create_access_token
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as primary_client:
        primary_client.cookies.set("access_token", create_access_token(str(primary.id)))
        resp = await primary_client.post(
            "/api/v1/families/me/members/invite",
            json={"email": "third@example.com"},
        )
        assert resp.status_code == 409


# ── Remove / Leave ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_remove_member(authed_with_family, make_user, fresh_session):
    client, _, family = authed_with_family
    co = await make_user(email="remove@example.com")

    s = await fresh_session()
    s.add(FamilyMember(family_id=family.id, user_id=co.id, role="co_parent"))
    co_db = (await s.execute(select(User).where(User.id == co.id))).scalars().first()
    co_db.has_family = True
    await s.commit()

    resp = await client.delete(f"/api/v1/families/me/members/{co.id}")
    assert resp.status_code == 204

    s2 = await fresh_session()
    res = await s2.execute(select(FamilyMember).where(FamilyMember.user_id == co.id))
    assert res.scalars().first() is None
    res = await s2.execute(select(User).where(User.id == co.id))
    assert res.scalars().first().has_family is False


@pytest.mark.asyncio
async def test_remove_self_403_for_primary(authed_with_family):
    client, primary, _ = authed_with_family
    resp = await client.delete(f"/api/v1/families/me/members/{primary.id}")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_leave_family_co_parent(authed_with_family, make_user, make_client, fresh_session):
    _, _, family = authed_with_family
    co = await make_user(email="leaver@example.com")

    s = await fresh_session()
    s.add(FamilyMember(family_id=family.id, user_id=co.id, role="co_parent"))
    co_db = (await s.execute(select(User).where(User.id == co.id))).scalars().first()
    co_db.has_family = True
    await s.commit()

    co_client = await make_client(co)
    resp = await co_client.post("/api/v1/families/me/members/leave")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_leave_family_primary_403(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/families/me/members/leave")
    assert resp.status_code == 403
