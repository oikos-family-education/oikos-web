"""Tests for /calendar router and CalendarService."""
import uuid
from datetime import datetime, timezone, timedelta
import pytest

from app.services.calendar_service import CalendarService, _add_months
from app.models.calendar import CalendarEvent


def _event(start_at, end_at, **overrides):
    base = {
        "title": "Field Trip",
        "event_type": "family",
        "start_at": start_at,
        "end_at": end_at,
    }
    base.update(overrides)
    return base


# ── Pure helpers ────────────────────────────────────────────────────────────

def test_add_months_simple():
    dt = datetime(2024, 1, 15, 10, 0, tzinfo=timezone.utc)
    out = _add_months(dt, 1)
    assert out == datetime(2024, 2, 15, 10, 0, tzinfo=timezone.utc)


def test_add_months_clamps_to_last_day():
    """Adding a month to Jan 31 → Feb 28/29, not an invalid date."""
    dt = datetime(2024, 1, 31, 10, 0, tzinfo=timezone.utc)
    out = _add_months(dt, 1)
    assert out.month == 2
    assert out.day == 29  # 2024 is a leap year


def test_add_months_wraps_year():
    dt = datetime(2024, 11, 15, tzinfo=timezone.utc)
    out = _add_months(dt, 3)
    assert out.year == 2025
    assert out.month == 2


# ── Recurrence expansion ────────────────────────────────────────────────────

def test_expand_recurrence_none_in_range():
    base = datetime(2024, 6, 1, 10, 0, tzinfo=timezone.utc)
    event = CalendarEvent(
        title="X",
        start_at=base,
        end_at=base + timedelta(hours=1),
        recurrence="none",
        all_day=False,
    )
    occ = CalendarService.expand_recurrence(event, base - timedelta(days=1), base + timedelta(days=1))
    assert len(occ) == 1


def test_expand_recurrence_none_out_of_range():
    base = datetime(2024, 6, 1, 10, 0, tzinfo=timezone.utc)
    event = CalendarEvent(
        title="X",
        start_at=base,
        end_at=base + timedelta(hours=1),
        recurrence="none",
        all_day=False,
    )
    occ = CalendarService.expand_recurrence(event, base + timedelta(days=10), base + timedelta(days=20))
    assert occ == []


def test_expand_recurrence_weekly():
    base = datetime(2024, 1, 1, 10, 0, tzinfo=timezone.utc)  # Monday
    event = CalendarEvent(
        title="X",
        start_at=base,
        end_at=base + timedelta(hours=1),
        recurrence="weekly",
        all_day=False,
    )
    # Three weeks
    occ = CalendarService.expand_recurrence(event, base, base + timedelta(weeks=2, days=1))
    assert len(occ) == 3


def test_expand_recurrence_monthly():
    base = datetime(2024, 1, 15, 10, 0, tzinfo=timezone.utc)
    event = CalendarEvent(
        title="X",
        start_at=base,
        end_at=base + timedelta(hours=1),
        recurrence="monthly",
        all_day=False,
    )
    # Six-month range
    occ = CalendarService.expand_recurrence(event, base, datetime(2024, 7, 1, tzinfo=timezone.utc))
    assert 6 <= len(occ) <= 7


# ── Auth gate ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_event_requires_family(authed_client):
    client, _ = authed_client
    now = datetime.now(timezone.utc).isoformat()
    resp = await client.post("/api/v1/calendar/events", json=_event(now, now))
    assert resp.status_code == 400


# ── Create / read / update / delete ────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_event(authed_with_family):
    client, _, _ = authed_with_family
    now = datetime.now(timezone.utc)
    resp = await client.post("/api/v1/calendar/events", json=_event(
        now.isoformat(), (now + timedelta(hours=1)).isoformat(),
    ))
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "Field Trip"
    assert body["recurrence"] == "none"


@pytest.mark.asyncio
async def test_create_event_end_before_start_422(authed_with_family):
    client, _, _ = authed_with_family
    now = datetime.now(timezone.utc)
    resp = await client.post("/api/v1/calendar/events", json=_event(
        now.isoformat(), (now - timedelta(hours=1)).isoformat(),
    ))
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_event_404(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.get(f"/api/v1/calendar/events/{uuid.uuid4()}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_event(authed_with_family):
    client, _, _ = authed_with_family
    now = datetime.now(timezone.utc)
    r = await client.post("/api/v1/calendar/events", json=_event(
        now.isoformat(), (now + timedelta(hours=1)).isoformat(),
    ))
    eid = r.json()["id"]
    resp = await client.patch(f"/api/v1/calendar/events/{eid}", json={"title": "Renamed"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Renamed"


@pytest.mark.asyncio
async def test_delete_event(authed_with_family):
    client, _, _ = authed_with_family
    now = datetime.now(timezone.utc)
    r = await client.post("/api/v1/calendar/events", json=_event(
        now.isoformat(), (now + timedelta(hours=1)).isoformat(),
    ))
    eid = r.json()["id"]
    resp = await client.delete(f"/api/v1/calendar/events/{eid}")
    assert resp.status_code == 204


# ── Range query ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_events_in_range(authed_with_family):
    client, _, _ = authed_with_family
    today = datetime.now(timezone.utc).date()
    now = datetime.now(timezone.utc)

    await client.post("/api/v1/calendar/events", json=_event(
        now.isoformat(), (now + timedelta(hours=1)).isoformat(),
        title="Inside",
    ))
    # Far future event — outside range
    far = now + timedelta(days=400)
    await client.post("/api/v1/calendar/events", json=_event(
        far.isoformat(), (far + timedelta(hours=1)).isoformat(),
        title="Outside",
    ))

    resp = await client.get(
        f"/api/v1/calendar/events?from={today}&to={today + timedelta(days=1)}",
    )
    assert resp.status_code == 200
    titles = [e["title"] for e in resp.json()["events"]]
    assert "Inside" in titles
    assert "Outside" not in titles


@pytest.mark.asyncio
async def test_list_events_invalid_date_400(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.get("/api/v1/calendar/events?from=not-a-date&to=2024-01-01")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_list_events_filter_by_event_type(authed_with_family):
    client, _, _ = authed_with_family
    now = datetime.now(timezone.utc)
    today = now.date()
    await client.post("/api/v1/calendar/events", json=_event(
        now.isoformat(), (now + timedelta(hours=1)).isoformat(),
        title="Family", event_type="family",
    ))
    await client.post("/api/v1/calendar/events", json=_event(
        now.isoformat(), (now + timedelta(hours=1)).isoformat(),
        title="Subject", event_type="subject",
    ))

    resp = await client.get(
        f"/api/v1/calendar/events?from={today}&to={today + timedelta(days=1)}&event_type=family",
    )
    assert resp.status_code == 200
    titles = [e["title"] for e in resp.json()["events"]]
    assert "Family" in titles
    assert "Subject" not in titles


@pytest.mark.asyncio
async def test_list_events_includes_milestone_system(authed_with_family, make_child):
    """Project milestones with a due_date show up as system events."""
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    today = datetime.now(timezone.utc).date()

    await client.post("/api/v1/projects", json={
        "title": "Build a Robot",
        "child_ids": [str(child.id)],
        "milestones": [
            {"title": "Wire it up", "sort_order": 0, "due_date": str(today + timedelta(days=2))},
        ],
    })

    resp = await client.get(
        f"/api/v1/calendar/events?from={today}&to={today + timedelta(days=10)}",
    )
    assert resp.status_code == 200
    titles = [e["title"] for e in resp.json()["events"]]
    assert any("Wire it up" in t for t in titles)


# ── Yearly recurrence ────────────────────────────────────────────────────────

def test_expand_recurrence_yearly():
    base = datetime(2024, 3, 15, 10, 0, tzinfo=timezone.utc)
    event = CalendarEvent(
        title="Annual Review",
        start_at=base,
        end_at=base + timedelta(hours=1),
        recurrence="yearly",
        all_day=False,
    )
    # Three-year window
    occ = CalendarService.expand_recurrence(event, base, datetime(2027, 1, 1, tzinfo=timezone.utc))
    assert 3 <= len(occ) <= 4  # 2024, 2025, 2026


def test_expand_recurrence_yearly_single_occurrence():
    """A yearly event outside any anniversary year returns empty."""
    base = datetime(2024, 3, 15, 10, 0, tzinfo=timezone.utc)
    event = CalendarEvent(
        title="Annual Review",
        start_at=base,
        end_at=base + timedelta(hours=1),
        recurrence="yearly",
        all_day=False,
    )
    # Query window before the event
    occ = CalendarService.expand_recurrence(
        event,
        datetime(2023, 1, 1, tzinfo=timezone.utc),
        datetime(2024, 1, 1, tzinfo=timezone.utc),
    )
    assert occ == []


# ── Update event 404 ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_event_404(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.patch(f"/api/v1/calendar/events/{uuid.uuid4()}", json={"title": "Ghost"})
    assert resp.status_code == 404


# ── Delete event 404 ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_event_404(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.delete(f"/api/v1/calendar/events/{uuid.uuid4()}")
    assert resp.status_code == 404


# ── Calendar event range: today-only query (TodaySchedule dashboard use) ──────

@pytest.mark.asyncio
async def test_calendar_today_only_range(authed_with_family):
    """TodaySchedule queries from=today&to=today — same-day range should work."""
    client, _, _ = authed_with_family
    now = datetime.now(timezone.utc)
    today = now.date()

    await client.post("/api/v1/calendar/events", json={
        "title": "Morning Meeting",
        "event_type": "family",
        "start_at": now.isoformat(),
        "end_at": (now + timedelta(hours=1)).isoformat(),
    })

    resp = await client.get(f"/api/v1/calendar/events?from={today}&to={today}")
    assert resp.status_code == 200
    titles = [e["title"] for e in resp.json()["events"]]
    assert "Morning Meeting" in titles
