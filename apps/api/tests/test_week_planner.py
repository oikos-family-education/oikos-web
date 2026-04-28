"""Tests for /week-planner router and WeekPlannerService."""
import uuid
import pytest


def _entry(child_ids, day=0, start=540, duration=45, **overrides):
    base = {
        "child_ids": child_ids,
        "day_of_week": day,
        "start_minute": start,
        "duration_minutes": duration,
        "priority": "medium",
    }
    base.update(overrides)
    return base


# ── Templates ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_template(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/week-planner/templates", json={"name": "Spring", "is_active": True})
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Spring"
    assert body["is_active"] is True
    assert body["entries"] == []


@pytest.mark.asyncio
async def test_create_active_deactivates_others(authed_with_family):
    client, _, _ = authed_with_family
    r1 = await client.post("/api/v1/week-planner/templates", json={"name": "T1", "is_active": True})
    r2 = await client.post("/api/v1/week-planner/templates", json={"name": "T2", "is_active": True})
    assert r1.status_code == 201 and r2.status_code == 201

    list_resp = await client.get("/api/v1/week-planner/templates")
    actives = [t for t in list_resp.json() if t["is_active"]]
    assert len(actives) == 1
    assert actives[0]["name"] == "T2"


@pytest.mark.asyncio
async def test_activate_already_active_409(authed_with_family):
    client, _, _ = authed_with_family
    r1 = await client.post("/api/v1/week-planner/templates", json={"name": "T1", "is_active": True})
    tid = r1.json()["id"]
    resp = await client.post(f"/api/v1/week-planner/templates/{tid}/activate")
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_activate_template(authed_with_family):
    client, _, _ = authed_with_family
    r1 = await client.post("/api/v1/week-planner/templates", json={"name": "T1", "is_active": False})
    tid = r1.json()["id"]
    resp = await client.post(f"/api/v1/week-planner/templates/{tid}/activate")
    assert resp.status_code == 200
    assert resp.json()["is_active"] is True


@pytest.mark.asyncio
async def test_update_template_name(authed_with_family):
    client, _, _ = authed_with_family
    r1 = await client.post("/api/v1/week-planner/templates", json={"name": "Old", "is_active": False})
    tid = r1.json()["id"]
    r2 = await client.patch(f"/api/v1/week-planner/templates/{tid}", json={"name": "Renamed"})
    assert r2.status_code == 200
    assert r2.json()["name"] == "Renamed"


@pytest.mark.asyncio
async def test_delete_template(authed_with_family):
    client, _, _ = authed_with_family
    r1 = await client.post("/api/v1/week-planner/templates", json={"name": "T", "is_active": False})
    tid = r1.json()["id"]
    resp = await client.delete(f"/api/v1/week-planner/templates/{tid}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_get_template_unknown_404(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.get(f"/api/v1/week-planner/templates/{uuid.uuid4()}")
    assert resp.status_code == 404


# ── Entries ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_entry(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    t = await client.post("/api/v1/week-planner/templates", json={"name": "T", "is_active": False})
    tid = t.json()["id"]

    resp = await client.post(
        f"/api/v1/week-planner/templates/{tid}/entries",
        json=_entry([str(child.id)], day=0, start=540, duration=45),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["start_minute"] == 540
    assert body["duration_minutes"] == 45


@pytest.mark.asyncio
async def test_create_entry_invalid_start_422(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    t = await client.post("/api/v1/week-planner/templates", json={"name": "T", "is_active": False})
    tid = t.json()["id"]

    resp = await client.post(
        f"/api/v1/week-planner/templates/{tid}/entries",
        json=_entry([str(child.id)], start=60),  # before 06:00
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_entry_overlap_409(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    t = await client.post("/api/v1/week-planner/templates", json={"name": "T", "is_active": False})
    tid = t.json()["id"]

    await client.post(
        f"/api/v1/week-planner/templates/{tid}/entries",
        json=_entry([str(child.id)], day=0, start=540, duration=60),
    )
    resp = await client.post(
        f"/api/v1/week-planner/templates/{tid}/entries",
        json=_entry([str(child.id)], day=0, start=580, duration=30),
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_overlap_with_disjoint_children_ok(authed_with_family, make_child):
    """Two children at the same time is fine if they're different children."""
    client, _, family = authed_with_family
    a = await make_child(family.id, first_name="A")
    b = await make_child(family.id, first_name="B")
    t = await client.post("/api/v1/week-planner/templates", json={"name": "T", "is_active": False})
    tid = t.json()["id"]

    r1 = await client.post(
        f"/api/v1/week-planner/templates/{tid}/entries",
        json=_entry([str(a.id)], day=0, start=540, duration=60),
    )
    r2 = await client.post(
        f"/api/v1/week-planner/templates/{tid}/entries",
        json=_entry([str(b.id)], day=0, start=540, duration=60),
    )
    assert r1.status_code == 201 and r2.status_code == 201


@pytest.mark.asyncio
async def test_free_time_skips_overlap_check(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    t = await client.post("/api/v1/week-planner/templates", json={"name": "T", "is_active": False})
    tid = t.json()["id"]

    await client.post(
        f"/api/v1/week-planner/templates/{tid}/entries",
        json=_entry([str(child.id)], day=0, start=540, duration=60),
    )
    resp = await client.post(
        f"/api/v1/week-planner/templates/{tid}/entries",
        json=_entry([str(child.id)], day=0, start=540, duration=60, is_free_time=True),
    )
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_update_entry_change_time(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    t = await client.post("/api/v1/week-planner/templates", json={"name": "T", "is_active": False})
    tid = t.json()["id"]

    e = await client.post(
        f"/api/v1/week-planner/templates/{tid}/entries",
        json=_entry([str(child.id)], day=0, start=540, duration=45),
    )
    eid = e.json()["id"]
    resp = await client.patch(f"/api/v1/week-planner/entries/{eid}", json={"start_minute": 600})
    assert resp.status_code == 200
    assert resp.json()["start_minute"] == 600


@pytest.mark.asyncio
async def test_delete_entry(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    t = await client.post("/api/v1/week-planner/templates", json={"name": "T", "is_active": False})
    tid = t.json()["id"]
    e = await client.post(
        f"/api/v1/week-planner/templates/{tid}/entries",
        json=_entry([str(child.id)]),
    )
    eid = e.json()["id"]
    resp = await client.delete(f"/api/v1/week-planner/entries/{eid}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_clear_template_entries(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    t = await client.post("/api/v1/week-planner/templates", json={"name": "T", "is_active": False})
    tid = t.json()["id"]
    await client.post(
        f"/api/v1/week-planner/templates/{tid}/entries",
        json=_entry([str(child.id)], day=0),
    )
    await client.post(
        f"/api/v1/week-planner/templates/{tid}/entries",
        json=_entry([str(child.id)], day=1),
    )
    resp = await client.delete(f"/api/v1/week-planner/templates/{tid}/entries")
    assert resp.status_code == 204

    # Template now has no entries.
    detail = await client.get(f"/api/v1/week-planner/templates/{tid}")
    assert detail.json()["entries"] == []


@pytest.mark.asyncio
async def test_duplicate_entry_to_other_days(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    t = await client.post("/api/v1/week-planner/templates", json={"name": "T", "is_active": False})
    tid = t.json()["id"]
    e = await client.post(
        f"/api/v1/week-planner/templates/{tid}/entries",
        json=_entry([str(child.id)], day=0),
    )
    eid = e.json()["id"]

    resp = await client.post(
        f"/api/v1/week-planner/entries/{eid}/duplicate",
        json={"target_days": [1, 2, 0]},  # 0 is the source day, should be skipped
    )
    assert resp.status_code == 200
    days = sorted(d["day_of_week"] for d in resp.json())
    assert days == [1, 2]


# ── Today routine (dashboard) ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_today_routine_no_active_returns_empty(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.get("/api/v1/week-planner/today")
    assert resp.status_code == 200
    assert resp.json() == []


# ── Today routine with actual entries (dashboard) ────────────────────────────

@pytest.mark.asyncio
async def test_today_routine_with_entries_and_subject_names(authed_with_family, make_child, make_subject):
    """Active template + entry for today → /today returns enriched entries."""
    from datetime import date
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="Grace")
    subject = await make_subject(family.id, name="Physics")

    t = await client.post("/api/v1/week-planner/templates", json={"name": "T", "is_active": True})
    tid = t.json()["id"]

    today_weekday = date.today().weekday()  # 0=Mon…6=Sun
    await client.post(
        f"/api/v1/week-planner/templates/{tid}/entries",
        json={
            "child_ids": [str(child.id)],
            "subject_id": str(subject.id),
            "day_of_week": today_weekday,
            "start_minute": 540,
            "duration_minutes": 45,
            "priority": "high",
        },
    )

    resp = await client.get("/api/v1/week-planner/today")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["subject_name"] == "Physics"
    assert items[0]["child_names"] == ["Grace"]
    assert items[0]["start_minute"] == 540


@pytest.mark.asyncio
async def test_today_routine_free_time_entry(authed_with_family, make_child):
    """Free-time entries are included in today's schedule."""
    from datetime import date
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="Leo")

    t = await client.post("/api/v1/week-planner/templates", json={"name": "T", "is_active": True})
    tid = t.json()["id"]
    today_weekday = date.today().weekday()

    await client.post(
        f"/api/v1/week-planner/templates/{tid}/entries",
        json={
            "child_ids": [str(child.id)],
            "day_of_week": today_weekday,
            "start_minute": 720,
            "duration_minutes": 60,
            "priority": "low",
            "is_free_time": True,
        },
    )

    resp = await client.get("/api/v1/week-planner/today")
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["is_free_time"] is True
