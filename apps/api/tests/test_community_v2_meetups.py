"""Tests for community meetups + recurrence + RSVPs (v2 spec §5)."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
import pytest_asyncio

from app.models.family import Family
from app.models.family_member import FamilyMember
from app.models.community import Community, CommunityMember, CommunityMeetup
from app.services.meetup_service import expand_occurrences


pytestmark = pytest.mark.asyncio


# ── Pure helper: expand_occurrences (no DB) ────────────────────────────


def _meetup(starts_at, recurrence="none", recurrence_until=None, cancelled_at=None):
    m = CommunityMeetup(
        title="x",
        starts_at=starts_at,
        recurrence=recurrence,
        recurrence_until=recurrence_until,
        cancelled_at=cancelled_at,
        location_text="-",
    )
    return m


def test_expand_none_in_window():
    m = _meetup(datetime(2026, 6, 1, 10, 0, tzinfo=timezone.utc))
    assert expand_occurrences(m, date(2026, 5, 1), date(2026, 7, 1)) == [date(2026, 6, 1)]


def test_expand_none_outside_window():
    m = _meetup(datetime(2026, 6, 1, 10, 0, tzinfo=timezone.utc))
    assert expand_occurrences(m, date(2026, 7, 1), date(2026, 8, 1)) == []


def test_expand_weekly_basic():
    m = _meetup(datetime(2026, 6, 1, 10, 0, tzinfo=timezone.utc), recurrence="weekly")
    out = expand_occurrences(m, date(2026, 6, 1), date(2026, 6, 21))
    assert out == [date(2026, 6, 1), date(2026, 6, 8), date(2026, 6, 15)]


def test_expand_weekly_skips_past_anchor():
    """A weekly meetup whose anchor is in the past should still resolve to the
    next occurrence within the window."""
    m = _meetup(datetime(2026, 1, 4, 10, 0, tzinfo=timezone.utc), recurrence="weekly")
    out = expand_occurrences(m, date(2026, 6, 1), date(2026, 6, 14))
    # Anchor is a Sunday; next Sundays in window: Jun 7 + Jun 14
    assert out == [date(2026, 6, 7), date(2026, 6, 14)]


def test_expand_biweekly():
    m = _meetup(datetime(2026, 6, 1, 10, 0, tzinfo=timezone.utc), recurrence="biweekly")
    out = expand_occurrences(m, date(2026, 6, 1), date(2026, 7, 1))
    assert out == [date(2026, 6, 1), date(2026, 6, 15), date(2026, 6, 29)]


def test_expand_recurrence_until_clips():
    m = _meetup(
        datetime(2026, 6, 1, 10, 0, tzinfo=timezone.utc),
        recurrence="weekly",
        recurrence_until=datetime(2026, 6, 12, 23, 59, tzinfo=timezone.utc),
    )
    out = expand_occurrences(m, date(2026, 6, 1), date(2026, 7, 1))
    assert out == [date(2026, 6, 1), date(2026, 6, 8)]


def test_expand_monthly():
    m = _meetup(datetime(2026, 1, 31, 10, 0, tzinfo=timezone.utc), recurrence="monthly")
    out = expand_occurrences(m, date(2026, 1, 1), date(2026, 4, 30))
    # Jan 31, Feb 28 (clamp), Mar 31, Apr 30 (clamp)
    assert out == [date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 31), date(2026, 4, 30)]


def test_expand_cancelled():
    m = _meetup(
        datetime(2026, 6, 1, 10, 0, tzinfo=timezone.utc),
        recurrence="weekly",
        cancelled_at=datetime(2026, 6, 5, tzinfo=timezone.utc),
    )
    assert expand_occurrences(m, date(2026, 6, 1), date(2026, 6, 30)) == []


# ── HTTP tests ────────────────────────────────────────────────────────


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
        location_country="United States",
        location_country_code="US",
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
        name="Online co-op",
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
async def admin_community(authed_with_family):
    """Returns (client, user, family, slug) with a freshly created community."""
    client, user, family = authed_with_family
    res = await client.post("/api/v1/communities", json=_community_payload())
    assert res.status_code == 201, res.text
    return client, user, family, res.json()["slug"]


async def test_create_meetup_requires_location_or_url(admin_community):
    client, _, _, slug = admin_community
    res = await client.post(
        f"/api/v1/communities/{slug}/meetups",
        json={
            "title": "Park day",
            "starts_at": "2026-07-01T15:00:00Z",
            "duration_minutes": 90,
            "recurrence": "weekly",
        },
    )
    assert res.status_code == 422


async def test_create_meetup_persists_and_lists(admin_community):
    client, _, _, slug = admin_community
    res = await client.post(
        f"/api/v1/communities/{slug}/meetups",
        json={
            "title": "Park day",
            "starts_at": "2026-07-01T15:00:00Z",
            "duration_minutes": 90,
            "recurrence": "weekly",
            "location_text": "Sandymount Strand",
        },
    )
    assert res.status_code == 201, res.text

    list_res = await client.get(
        f"/api/v1/communities/{slug}/meetups",
        params={"window_from": "2026-07-01", "window_to": "2026-07-30"},
    )
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    # weekly across 30 days -> 5 occurrences
    assert len(items) == 5
    assert items[0]["title"] == "Park day"
    assert items[0]["viewer_rsvp"] is None


async def test_rsvp_round_trip(admin_community):
    client, _, family, slug = admin_community
    create = await client.post(
        f"/api/v1/communities/{slug}/meetups",
        json={
            "title": "Park day",
            "starts_at": "2026-07-01T15:00:00Z",
            "duration_minutes": 90,
            "recurrence": "none",
            "location_text": "Sandymount Strand",
        },
    )
    meetup_id = create.json()["id"]
    rsvp = await client.post(
        f"/api/v1/communities/{slug}/meetups/{meetup_id}/rsvp",
        json={"occurrence_date": "2026-07-01", "response": "going"},
    )
    assert rsvp.status_code == 200
    assert rsvp.json() == {"response": "going", "occurrence_date": "2026-07-01"}

    listed = await client.get(
        f"/api/v1/communities/{slug}/meetups",
        params={"window_from": "2026-07-01", "window_to": "2026-07-02"},
    )
    items = listed.json()["items"]
    assert len(items) == 1
    assert items[0]["viewer_rsvp"] == "going"
    assert items[0]["rsvp_counts"]["going"] == 1


async def test_cancel_meetup_drops_from_listing(admin_community):
    client, _, _, slug = admin_community
    create = await client.post(
        f"/api/v1/communities/{slug}/meetups",
        json={
            "title": "Park day",
            "starts_at": "2026-07-01T15:00:00Z",
            "duration_minutes": 60,
            "recurrence": "none",
            "location_text": "Park",
        },
    )
    meetup_id = create.json()["id"]
    cancel = await client.post(f"/api/v1/communities/{slug}/meetups/{meetup_id}/cancel")
    assert cancel.status_code == 204

    listed = await client.get(
        f"/api/v1/communities/{slug}/meetups",
        params={"window_from": "2026-07-01", "window_to": "2026-07-02"},
    )
    assert listed.json()["items"] == []
