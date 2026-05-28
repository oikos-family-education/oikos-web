"""Tighter request/approve/deny flow (v2 — PR #31 follow-up).

Covers:
  * Community.closed_to_new_members hides from discover + rejects join
  * Join request requires agreed_to_principles=true and stores the message
  * Admin can read the message on the pending list
  * Deny requires a non-empty reason; row stays as 'removed' with the reason
"""
from __future__ import annotations

import uuid

import pytest
import pytest_asyncio

from app.models.family import Family
from app.models.family_member import FamilyMember


pytestmark = pytest.mark.asyncio


def _payload(**over):
    base = dict(
        name="Join-flow co-op",
        description="A community for testing the request flow.",
        principles_text="Be kind, be honest, be present.",
        principle_tags={"faith": None, "education_methods": [], "home_languages": ["en"]},
        region_scope="online",
        country_code=None,
        region=None,
        join_mode="request_to_join",
    )
    base.update(over)
    return base


async def _make_family(db, user, name="Jones"):
    f = Family(
        account_id=user.id,
        family_name=name,
        family_name_slug=f"{name.lower()}-{uuid.uuid4().hex[:6]}",
        shield_config={},
        home_languages=["en"],
        education_methods=[],
        current_curriculum=[],
        discoverable=True,
    )
    db.add(f)
    await db.flush()
    db.add(FamilyMember(family_id=f.id, user_id=user.id, role="primary"))
    user.has_family = True
    await db.commit()
    await db.refresh(f)
    return f


@pytest_asyncio.fixture
async def admin_and_outsider(authed_with_family, db, make_user, make_client):
    client_a, _, _ = authed_with_family
    create = await client_a.post("/api/v1/communities", json=_payload())
    slug = create.json()["slug"]
    user_b = await make_user()
    family_b = await _make_family(db, user_b)
    client_b = await make_client(user_b)
    return client_a, slug, client_b, family_b


async def test_join_requires_agreement(admin_and_outsider):
    _, slug, client_b, _ = admin_and_outsider
    res = await client_b.post(
        f"/api/v1/communities/{slug}/join", json={"agreed_to_principles": False},
    )
    assert res.status_code == 422


async def test_join_stores_message_and_surfaces_to_admin(admin_and_outsider):
    client_a, slug, client_b, family_b = admin_and_outsider
    req = await client_b.post(
        f"/api/v1/communities/{slug}/join",
        json={"message": "We share your principles, please consider us.", "agreed_to_principles": True},
    )
    assert req.status_code == 201

    members = await client_a.get(f"/api/v1/communities/{slug}/members")
    pending = members.json()["pending"]
    assert len(pending) == 1
    row = pending[0]
    assert row["family_id"] == str(family_b.id)
    assert row["join_message"] == "We share your principles, please consider us."


async def test_deny_requires_reason_and_persists_it(admin_and_outsider, db):
    from app.models.community import CommunityMember
    from sqlalchemy import select
    client_a, slug, client_b, family_b = admin_and_outsider
    await client_b.post(
        f"/api/v1/communities/{slug}/join",
        json={"message": "Hello", "agreed_to_principles": True},
    )

    # Empty / missing reason → 422
    empty = await client_a.post(
        f"/api/v1/communities/{slug}/members/{family_b.id}/deny",
        json={"reason": ""},
    )
    assert empty.status_code == 422

    # With a reason → 204 and the row carries it
    ok = await client_a.post(
        f"/api/v1/communities/{slug}/members/{family_b.id}/deny",
        json={"reason": "We're full for this term."},
    )
    assert ok.status_code == 204

    res = await db.execute(
        select(CommunityMember).where(CommunityMember.family_id == family_b.id)
    )
    row = res.scalars().first()
    assert row is not None
    assert row.status == "removed"
    assert row.removed_reason == "We're full for this term."


async def test_denied_family_can_request_again(admin_and_outsider):
    client_a, slug, client_b, family_b = admin_and_outsider
    await client_b.post(
        f"/api/v1/communities/{slug}/join",
        json={"agreed_to_principles": True},
    )
    await client_a.post(
        f"/api/v1/communities/{slug}/members/{family_b.id}/deny",
        json={"reason": "Not now."},
    )
    # A fresh request from the same family should land back as 'pending'
    again = await client_b.post(
        f"/api/v1/communities/{slug}/join",
        json={"message": "Try again", "agreed_to_principles": True},
    )
    assert again.status_code == 201
    assert again.json()["status"] == "pending"


async def test_closed_community_hidden_from_discover_and_rejects_join(admin_and_outsider):
    client_a, slug, client_b, _ = admin_and_outsider
    # Admin closes the community
    patch = await client_a.patch(
        f"/api/v1/communities/{slug}",
        json={"closed_to_new_members": True},
    )
    assert patch.status_code == 200, patch.text
    assert patch.json()["closed_to_new_members"] is True

    # B no longer sees it in the discover list
    list_res = await client_b.get("/api/v1/communities")
    slugs = {i["slug"] for i in list_res.json()["items"]}
    assert slug not in slugs

    # And trying to join directly is rejected
    join = await client_b.post(
        f"/api/v1/communities/{slug}/join",
        json={"agreed_to_principles": True},
    )
    assert join.status_code == 403
