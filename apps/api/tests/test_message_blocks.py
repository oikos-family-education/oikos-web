"""Family blocks + reports — mutual enforcement.

Spec: docs/superpowers/specs/2026-05-28-family-messages-design.md
"""
from __future__ import annotations

import uuid

import pytest
import pytest_asyncio

from app.models.family import Family
from app.models.family_member import FamilyMember


pytestmark = pytest.mark.asyncio


async def _create_family(db, user, name="Jones"):
    f = Family(
        account_id=user.id,
        family_name=name,
        family_name_slug=f"{name.lower()}-{uuid.uuid4().hex[:6]}",
        shield_config={},
        home_languages=["en"],
        education_methods=[],
        current_curriculum=[],
        discoverable=True,
        visibility="local",
    )
    db.add(f)
    await db.flush()
    db.add(FamilyMember(family_id=f.id, user_id=user.id, role="primary"))
    user.has_family = True
    await db.commit()
    await db.refresh(f)
    return f


@pytest_asyncio.fixture
async def two_families(authed_with_family, db, make_user, make_client):
    client_a, user_a, family_a = authed_with_family
    family_a.discoverable = True
    family_a.visibility = "local"
    await db.commit()
    await db.refresh(family_a)

    user_b = await make_user()
    family_b = await _create_family(db, user_b, name="Jones")
    client_b = await make_client(user_b)
    return client_a, family_a, client_b, family_b


# ── Block creates row and hides discover both directions ──────────────────


async def test_block_creates_row_and_unblock_removes_it(two_families):
    client_a, family_a, client_b, family_b = two_families

    b = await client_a.post(
        "/api/v1/messages/blocks", json={"family_id": str(family_b.id)},
    )
    assert b.status_code == 201

    listing = await client_a.get("/api/v1/messages/blocks")
    assert listing.status_code == 200
    items = listing.json()["items"]
    assert len(items) == 1
    assert items[0]["family"]["id"] == str(family_b.id)

    u = await client_a.delete(f"/api/v1/messages/blocks/{family_b.id}")
    assert u.status_code == 204
    assert (await client_a.get("/api/v1/messages/blocks")).json()["items"] == []


async def test_blocked_family_disappears_from_discover_both_sides(
    two_families, db,
):
    client_a, family_a, client_b, family_b = two_families
    # Make sure both have the same country so they'd otherwise see each other.
    family_a.location_country_code = "US"
    family_b.location_country_code = "US"
    await db.commit()

    # Sanity: B is visible in A's discover before block.
    r0 = await client_a.get("/api/v1/families/discover?country=US")
    ids0 = {row["id"] for row in r0.json()["items"]}
    assert str(family_b.id) in ids0

    await client_a.post(
        "/api/v1/messages/blocks", json={"family_id": str(family_b.id)},
    )

    # A no longer sees B
    r1 = await client_a.get("/api/v1/families/discover?country=US")
    ids1 = {row["id"] for row in r1.json()["items"]}
    assert str(family_b.id) not in ids1

    # B also no longer sees A (mutual enforcement)
    r2 = await client_b.get("/api/v1/families/discover?country=US")
    ids2 = {row["id"] for row in r2.json()["items"]}
    assert str(family_a.id) not in ids2


async def test_blocked_family_profile_returns_404_both_sides(two_families, db):
    client_a, family_a, client_b, family_b = two_families

    # Sanity: profile reachable before block
    r0 = await client_a.get(
        f"/api/v1/families/{family_b.family_name_slug}/profile",
    )
    assert r0.status_code == 200

    await client_a.post(
        "/api/v1/messages/blocks", json={"family_id": str(family_b.id)},
    )

    r1 = await client_a.get(
        f"/api/v1/families/{family_b.family_name_slug}/profile",
    )
    assert r1.status_code == 404

    r2 = await client_b.get(
        f"/api/v1/families/{family_a.family_name_slug}/profile",
    )
    assert r2.status_code == 404


# ── Existing thread becomes posting-disabled ──────────────────────────────


async def test_block_makes_thread_read_only(two_families):
    client_a, family_a, client_b, family_b = two_families

    r = await client_a.post(
        "/api/v1/messages/threads",
        json={"recipient_family_id": str(family_b.id), "body": "before block"},
    )
    thread_id = r.json()["thread"]["id"]

    await client_a.post(
        "/api/v1/messages/blocks", json={"family_id": str(family_b.id)},
    )

    # A cannot post.
    r1 = await client_a.post(
        f"/api/v1/messages/threads/{thread_id}/messages",
        json={"body": "after"},
    )
    assert r1.status_code == 403

    # B (the blocked side) also cannot post.
    r2 = await client_b.post(
        f"/api/v1/messages/threads/{thread_id}/messages",
        json={"body": "after"},
    )
    assert r2.status_code == 403


async def test_blocked_cannot_initiate_new_thread(two_families):
    client_a, family_a, client_b, family_b = two_families

    await client_a.post(
        "/api/v1/messages/blocks", json={"family_id": str(family_b.id)},
    )

    # B trying to start a new thread with A — never gets through.
    r = await client_b.post(
        "/api/v1/messages/threads",
        json={"recipient_family_id": str(family_a.id), "body": "hi"},
    )
    assert r.status_code in (403, 404)


# ── Report + auto-block ───────────────────────────────────────────────────


async def test_report_with_also_block_creates_block(two_families):
    client_a, family_a, client_b, family_b = two_families
    r = await client_a.post(
        "/api/v1/messages/threads",
        json={"recipient_family_id": str(family_b.id), "body": "hi"},
    )
    thread_id = r.json()["thread"]["id"]

    rep = await client_a.post(
        f"/api/v1/messages/threads/{thread_id}/reports",
        json={"reason": "spam", "also_block": True},
    )
    assert rep.status_code == 201

    listing = await client_a.get("/api/v1/messages/blocks")
    ids = [item["family"]["id"] for item in listing.json()["items"]]
    assert str(family_b.id) in ids


async def test_report_without_also_block_does_not_block(two_families):
    client_a, family_a, client_b, family_b = two_families
    r = await client_a.post(
        "/api/v1/messages/threads",
        json={"recipient_family_id": str(family_b.id), "body": "hi"},
    )
    thread_id = r.json()["thread"]["id"]

    rep = await client_a.post(
        f"/api/v1/messages/threads/{thread_id}/reports",
        json={"reason": "spam", "also_block": False},
    )
    assert rep.status_code == 201

    listing = await client_a.get("/api/v1/messages/blocks")
    assert listing.json()["items"] == []
