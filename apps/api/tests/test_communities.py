"""Tests for the community area (spec: docs/superpowers/specs/2026-05-26-community-area-design.md).

Covers happy-path flows for: discoverable opt-in, family discovery, community
create + join + leave + succession, the 5-cap enforcement, invitation tokens,
and the forum (topics + replies + reports). Role/permission paths are exercised
explicitly because they're the spec's main correctness surface.
"""
from __future__ import annotations

import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.models.family import Family
from app.models.family_member import FamilyMember
from app.models.community import Community, CommunityMember


# ── helpers ────────────────────────────────────────────────────────────


async def _create_family(
    db, user, name="Smith", *, discoverable=True,
    country_code="US", region="NC",
    faith_tradition="christian", denomination="Reformed",
    methods=("charlotte_mason",), languages=("en",),
    culture="We focus on slow learning and lots of reading.",
):
    f = Family(
        account_id=user.id,
        family_name=name,
        family_name_slug=f"{name.lower()}-{uuid.uuid4().hex[:6]}",
        shield_config={},
        home_languages=list(languages),
        education_methods=list(methods),
        current_curriculum=[],
        discoverable=discoverable,
        location_country="United States" if country_code == "US" else None,
        location_country_code=country_code,
        location_region=region,
        faith_tradition=faith_tradition,
        faith_denomination=denomination,
        family_culture=culture,
        education_purpose="full_homeschool",
    )
    db.add(f)
    await db.flush()
    db.add(FamilyMember(family_id=f.id, user_id=user.id, role="primary"))
    user.has_family = True
    await db.commit()
    await db.refresh(f)
    return f


@pytest_asyncio.fixture
async def fam(authed_with_family):
    return authed_with_family


# ── Discoverability + Discover ─────────────────────────────────────────


async def test_set_discoverable(fam):
    client, user, family = fam
    res = await client.patch("/api/v1/families/me/discoverable", json={"discoverable": True})
    assert res.status_code == 200, res.text
    assert res.json() == {"discoverable": True}


async def test_discover_requires_country(fam):
    client, _, _ = fam
    res = await client.get("/api/v1/families/discover")
    assert res.status_code == 200
    assert res.json()["items"] == []


async def test_discover_returns_other_discoverable_families(fam, db, make_user):
    client, user, family = fam
    # Make myself discoverable
    family.discoverable = True
    family.location_country_code = "US"
    family.location_region = "NC"
    await db.commit()

    other_user = await make_user()
    other = await _create_family(db, other_user, name="Jones", discoverable=True)

    res = await client.get("/api/v1/families/discover?country=US")
    assert res.status_code == 200, res.text
    items = res.json()["items"]
    slugs = [i["family_name_slug"] for i in items]
    assert other.family_name_slug in slugs
    assert family.family_name_slug not in slugs  # never include the caller


async def test_discover_filters_faith_and_methods(fam, db, make_user):
    client, user, family = fam
    family.discoverable = True
    family.location_country_code = "US"
    await db.commit()

    u2 = await make_user()
    u3 = await make_user()
    await _create_family(
        db, u2, name="Matching",
        faith_tradition="christian", denomination="Reformed",
        methods=("charlotte_mason",),
    )
    await _create_family(
        db, u3, name="NotMatching",
        faith_tradition="secular",
        methods=("classical",),
    )

    res = await client.get(
        "/api/v1/families/discover",
        params={"country": "US", "faith": "christian", "methods": "charlotte_mason"},
    )
    assert res.status_code == 200, res.text
    slugs = {i["family_name_slug"] for i in res.json()["items"]}
    assert any(s.startswith("matching") for s in slugs)
    assert not any(s.startswith("notmatching") for s in slugs)


async def test_family_profile_404_when_not_discoverable(fam, db, make_user):
    client, _, _ = fam
    u2 = await make_user()
    hidden = await _create_family(db, u2, name="Hidden", discoverable=False)
    res = await client.get(f"/api/v1/families/{hidden.family_name_slug}/profile")
    assert res.status_code == 404


async def test_family_profile_visible_when_discoverable(fam, db, make_user):
    client, _, _ = fam
    u2 = await make_user()
    other = await _create_family(db, u2, name="Open", discoverable=True)
    res = await client.get(f"/api/v1/families/{other.family_name_slug}/profile")
    assert res.status_code == 200
    body = res.json()
    assert body["family_name"] == "Open"


# ── Community create + member cap ──────────────────────────────────────


def _community_payload(**overrides):
    base = dict(
        name="Charlotte Mason NC",
        description="Slow learning across NC.",
        principles_text="Living books, narration, short lessons.",
        principle_tags={"faith": "christian", "education_methods": ["charlotte_mason"], "home_languages": ["en"]},
        region_scope="country_region",
        country_code="US",
        region="NC",
        join_mode="request_to_join",
    )
    base.update(overrides)
    return base


async def test_create_community_makes_creator_admin(fam):
    client, user, family = fam
    res = await client.post("/api/v1/communities", json=_community_payload())
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["viewer_role"] == "admin"
    assert body["viewer_status"] == "active"
    assert body["member_count"] == 1


async def test_create_community_validates_region(fam):
    client, _, _ = fam
    res = await client.post(
        "/api/v1/communities",
        json=_community_payload(region_scope="country_region", region=None, country_code="US"),
    )
    assert res.status_code == 422


async def test_cannot_create_more_than_5_communities(fam, db):
    client, user, family = fam
    for i in range(5):
        res = await client.post(
            "/api/v1/communities",
            json=_community_payload(name=f"C{i}", region_scope="online", country_code=None, region=None),
        )
        assert res.status_code == 201, res.text
    res = await client.post(
        "/api/v1/communities",
        json=_community_payload(name="C6", region_scope="online", country_code=None, region=None),
    )
    assert res.status_code == 409


# ── Join + approve + leave + succession ────────────────────────────────


@pytest_asyncio.fixture
async def two_families(fam, db, make_user, make_client):
    """First family is the authed one; returns (admin_client, admin_family, joiner_client, joiner_family)."""
    admin_client, admin_user, admin_family = fam
    joiner_user = await make_user()
    joiner_family = await _create_family(db, joiner_user, name="Joiner")
    joiner_client = await make_client(joiner_user)
    return admin_client, admin_family, joiner_client, joiner_family


async def test_request_join_and_approve(two_families):
    admin_client, admin_family, joiner_client, joiner_family = two_families
    create = await admin_client.post("/api/v1/communities", json=_community_payload())
    slug = create.json()["slug"]

    # Joiner requests
    req = await joiner_client.post(f"/api/v1/communities/{slug}/join")
    assert req.status_code == 201
    assert req.json()["status"] == "pending"

    # Admin sees pending in members list
    members = await admin_client.get(f"/api/v1/communities/{slug}/members")
    assert members.status_code == 200
    assert any(m["family_id"] == str(joiner_family.id) for m in members.json()["pending"])

    # Approve
    ap = await admin_client.post(
        f"/api/v1/communities/{slug}/members/{joiner_family.id}/approve"
    )
    assert ap.status_code == 200
    # Now active
    members = await admin_client.get(f"/api/v1/communities/{slug}/members")
    family_ids = {m["family_id"] for m in members.json()["active"]}
    assert str(joiner_family.id) in family_ids


async def test_invite_only_community_rejects_join_request(two_families):
    admin_client, _, joiner_client, _ = two_families
    create = await admin_client.post(
        "/api/v1/communities", json=_community_payload(join_mode="invite_only"),
    )
    slug = create.json()["slug"]
    res = await joiner_client.post(f"/api/v1/communities/{slug}/join")
    assert res.status_code == 403


async def test_invite_link_grants_membership(two_families):
    admin_client, admin_family, joiner_client, joiner_family = two_families
    create = await admin_client.post(
        "/api/v1/communities", json=_community_payload(join_mode="invite_only"),
    )
    slug = create.json()["slug"]
    inv = await admin_client.post(
        f"/api/v1/communities/{slug}/invitations", json={"family_id": None},
    )
    assert inv.status_code == 201, inv.text
    token = inv.json()["token"]
    assert token

    acc = await joiner_client.post("/api/v1/communities/join/by-token", json={"token": token})
    assert acc.status_code == 200, acc.text
    assert acc.json()["viewer_status"] == "active"


async def test_admin_leaves_oldest_member_becomes_admin(two_families, db):
    admin_client, admin_family, joiner_client, joiner_family = two_families
    create = await admin_client.post("/api/v1/communities", json=_community_payload())
    slug = create.json()["slug"]
    await joiner_client.post(f"/api/v1/communities/{slug}/join")
    await admin_client.post(
        f"/api/v1/communities/{slug}/members/{joiner_family.id}/approve"
    )

    # Admin leaves
    leave = await admin_client.post(f"/api/v1/communities/{slug}/leave")
    assert leave.status_code == 204

    # Joiner is now admin
    detail = await joiner_client.get(f"/api/v1/communities/{slug}")
    assert detail.status_code == 200
    assert detail.json()["viewer_role"] == "admin"


# ── Forum ──────────────────────────────────────────────────────────────


async def test_post_topic_and_reply_and_report(two_families):
    admin_client, admin_family, joiner_client, joiner_family = two_families
    create = await admin_client.post("/api/v1/communities", json=_community_payload())
    slug = create.json()["slug"]
    await joiner_client.post(f"/api/v1/communities/{slug}/join")
    await admin_client.post(
        f"/api/v1/communities/{slug}/members/{joiner_family.id}/approve"
    )

    # Joiner posts topic
    t = await joiner_client.post(
        f"/api/v1/communities/{slug}/topics",
        json={"title": "Hello world", "body": "First topic body."},
    )
    assert t.status_code == 201, t.text
    topic_id = t.json()["id"]

    # Admin replies
    r = await admin_client.post(
        f"/api/v1/communities/{slug}/topics/{topic_id}/replies",
        json={"body": "Welcome!"},
    )
    assert r.status_code == 201

    # Topic detail returns reply
    det = await joiner_client.get(f"/api/v1/communities/{slug}/topics/{topic_id}")
    assert det.status_code == 200
    body = det.json()
    assert body["title"] == "Hello world"
    assert len(body["replies"]) == 1
    assert body["replies"][0]["body"] == "Welcome!"

    # Admin pins
    pin = await admin_client.patch(
        f"/api/v1/communities/{slug}/topics/{topic_id}", json={"is_pinned": True},
    )
    assert pin.status_code == 200
    assert pin.json()["is_pinned"] is True

    # Member cannot pin
    pin2 = await joiner_client.patch(
        f"/api/v1/communities/{slug}/topics/{topic_id}", json={"is_pinned": False},
    )
    assert pin2.status_code == 403

    # Report
    rep = await joiner_client.post(
        f"/api/v1/communities/{slug}/reports",
        json={"target_type": "topic", "target_id": topic_id, "reason": "spam"},
    )
    assert rep.status_code == 201
    assert rep.json()["status"] == "open"
