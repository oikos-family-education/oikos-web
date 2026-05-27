"""Notification fan-out + bell endpoints + mute toggle (v2 spec §6)."""
from __future__ import annotations

import uuid

import pytest
import pytest_asyncio

from app.models.family import Family
from app.models.family_member import FamilyMember


pytestmark = pytest.mark.asyncio


async def _create_family(db, user, name="Smith"):
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


def _community_payload(**over):
    base = dict(
        name="Test co-op",
        description="",
        principles_text="",
        principle_tags={"faith": None, "education_methods": [], "home_languages": ["en"]},
        region_scope="online",
        country_code=None,
        region=None,
        join_mode="request_to_join",
    )
    base.update(over)
    return base


@pytest_asyncio.fixture
async def two_members(authed_with_family, db, make_user, make_client):
    """Family A (authed) is admin of a community; family B joins and is approved."""
    client_a, user_a, family_a = authed_with_family
    res = await client_a.post("/api/v1/communities", json=_community_payload())
    slug = res.json()["slug"]

    user_b = await make_user()
    family_b = await _create_family(db, user_b, name="Jones")
    client_b = await make_client(user_b)

    await client_b.post(f"/api/v1/communities/{slug}/join")
    await client_a.post(
        f"/api/v1/communities/{slug}/members/{family_b.id}/approve",
    )
    return client_a, family_a, client_b, family_b, slug


async def test_topic_creates_notification_for_other_member(two_members):
    client_a, family_a, client_b, family_b, slug = two_members

    # A posts a topic
    t = await client_a.post(
        f"/api/v1/communities/{slug}/topics",
        json={"title": "Hello", "body": "World"},
    )
    assert t.status_code == 201, t.text

    # B has one unread notification
    bell = await client_b.get("/api/v1/notifications/unread-count")
    assert bell.status_code == 200
    assert bell.json()["count"] == 1

    # A has zero (actor never notified)
    bell_a = await client_a.get("/api/v1/notifications/unread-count")
    assert bell_a.json()["count"] == 0


async def test_reply_creates_notification_excluding_actor(two_members):
    client_a, family_a, client_b, family_b, slug = two_members

    t = await client_a.post(
        f"/api/v1/communities/{slug}/topics",
        json={"title": "Hello", "body": "World"},
    )
    topic_id = t.json()["id"]

    # B replies — A should be notified, B should not
    r = await client_b.post(
        f"/api/v1/communities/{slug}/topics/{topic_id}/replies",
        json={"body": "Hi back"},
    )
    assert r.status_code == 201

    a_unread = (await client_a.get("/api/v1/notifications/unread-count")).json()["count"]
    b_unread = (await client_b.get("/api/v1/notifications/unread-count")).json()["count"]
    # A had 0 (didn't get their own topic), now has 1 (the reply)
    assert a_unread == 1
    # B had 1 (the topic), now still has 1 (didn't get their own reply)
    assert b_unread == 1


async def test_mute_prevents_future_notifications(two_members):
    client_a, family_a, client_b, family_b, slug = two_members

    # B mutes the community
    mute = await client_b.patch(
        f"/api/v1/communities/{slug}/mute", json={"muted": True},
    )
    assert mute.status_code == 200
    assert mute.json() == {"muted": True}

    # A posts a topic
    await client_a.post(
        f"/api/v1/communities/{slug}/topics",
        json={"title": "After mute", "body": "Body"},
    )

    # B has no unread (muted)
    assert (await client_b.get("/api/v1/notifications/unread-count")).json()["count"] == 0


async def test_mark_all_read_clears_unread(two_members):
    client_a, _, client_b, _, slug = two_members
    await client_a.post(
        f"/api/v1/communities/{slug}/topics",
        json={"title": "Hello", "body": "Body"},
    )
    assert (await client_b.get("/api/v1/notifications/unread-count")).json()["count"] == 1
    cleared = await client_b.post("/api/v1/notifications/mark-all-read")
    assert cleared.json()["marked"] == 1
    assert (await client_b.get("/api/v1/notifications/unread-count")).json()["count"] == 0


async def test_notification_list_includes_actor_and_community(two_members):
    client_a, family_a, client_b, family_b, slug = two_members
    await client_a.post(
        f"/api/v1/communities/{slug}/topics",
        json={"title": "Welcome thread", "body": "Body"},
    )
    res = await client_b.get("/api/v1/notifications?limit=10")
    assert res.status_code == 200
    body = res.json()
    assert body["unread_count"] == 1
    assert len(body["items"]) == 1
    item = body["items"][0]
    assert item["event_type"] == "topic_created"
    assert item["community_slug"] == slug
    assert item["topic_title"] == "Welcome thread"
    assert item["actor_family_id"] == str(family_a.id)


async def test_dashboard_summary_lists_my_communities(two_members):
    client_a, family_a, client_b, family_b, slug = two_members
    # A posts → B has 1 unread for this community
    await client_a.post(
        f"/api/v1/communities/{slug}/topics",
        json={"title": "Hi", "body": "Body"},
    )

    summary = await client_b.get("/api/v1/communities/dashboard-summary")
    assert summary.status_code == 200
    rows = summary.json()
    assert len(rows) == 1
    assert rows[0]["community"]["slug"] == slug
    assert rows[0]["unread_count"] == 1
    assert rows[0]["last_activity"] is not None
    assert rows[0]["last_activity"]["topic_title"] == "Hi"


async def test_admin_pending_count_aggregates(two_members, db, make_user, make_client):
    client_a, family_a, client_b, family_b, slug = two_members
    # A third family requests to join
    user_c = await make_user()
    family_c = await _create_family(db, user_c, name="Cuz")
    client_c = await make_client(user_c)
    await client_c.post(f"/api/v1/communities/{slug}/join")

    # A is admin → sees 1 pending
    cnt = await client_a.get("/api/v1/communities/admin-pending-count")
    assert cnt.status_code == 200
    assert cnt.json() == {"count": 1}

    # C is not admin → sees 0
    cnt_c = await client_c.get("/api/v1/communities/admin-pending-count")
    assert cnt_c.json() == {"count": 0}
