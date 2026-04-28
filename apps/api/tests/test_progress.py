"""Tests for /progress router and ProgressService."""
import uuid
from datetime import date, timedelta
import pytest

from app.services.progress_service import iso_week_start, iso_week_range


# ── Pure helpers ────────────────────────────────────────────────────────────

def test_iso_week_start_for_monday():
    monday = date(2024, 1, 1)
    assert iso_week_start(monday) == monday


def test_iso_week_start_for_friday():
    friday = date(2024, 1, 5)
    assert iso_week_start(friday) == date(2024, 1, 1)


def test_iso_week_range():
    start, end = iso_week_range(date(2024, 1, 5))
    assert start == date(2024, 1, 1)
    assert end == date(2024, 1, 7)


# ── Auth gate ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_log_requires_family(authed_client):
    client, _ = authed_client
    resp = await client.post("/api/v1/progress/logs", json={"taught_on": str(date.today())})
    assert resp.status_code == 400


# ── Create / list logs ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_log_general(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/progress/logs", json={
        "taught_on": str(date.today()),
        "minutes": 45,
        "notes": "Great session",
    })
    assert resp.status_code == 201
    body = resp.json()
    assert body["minutes"] == 45
    assert body["child_id"] is None
    assert body["subject_id"] is None


@pytest.mark.asyncio
async def test_create_log_for_child_and_subject(authed_with_family, make_child, make_subject):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    sub = await make_subject(family.id, name="Math")
    resp = await client.post("/api/v1/progress/logs", json={
        "taught_on": str(date.today()),
        "child_id": str(child.id),
        "subject_id": str(sub.id),
    })
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_create_log_future_400(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/progress/logs", json={
        "taught_on": str(date.today() + timedelta(days=1)),
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_create_log_too_old_400(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/progress/logs", json={
        "taught_on": str(date.today() - timedelta(days=400)),
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_create_log_unknown_child_404(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/progress/logs", json={
        "taught_on": str(date.today()),
        "child_id": str(uuid.uuid4()),
    })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_log_duplicate_409(authed_with_family, make_child, make_subject):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    sub = await make_subject(family.id, name="Math")
    payload = {
        "taught_on": str(date.today()),
        "child_id": str(child.id),
        "subject_id": str(sub.id),
    }
    r1 = await client.post("/api/v1/progress/logs", json=payload)
    assert r1.status_code == 201
    r2 = await client.post("/api/v1/progress/logs", json=payload)
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_list_logs_filters(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    today = date.today()

    await client.post("/api/v1/progress/logs", json={
        "taught_on": str(today), "child_id": str(child.id),
    })
    await client.post("/api/v1/progress/logs", json={
        "taught_on": str(today - timedelta(days=10)),
    })

    resp = await client.get(f"/api/v1/progress/logs?from={today - timedelta(days=2)}&to={today}")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.asyncio
async def test_update_log(authed_with_family):
    client, _, _ = authed_with_family
    r = await client.post("/api/v1/progress/logs", json={
        "taught_on": str(date.today()), "minutes": 30,
    })
    log_id = r.json()["id"]
    resp = await client.patch(f"/api/v1/progress/logs/{log_id}", json={"minutes": 60})
    assert resp.status_code == 200
    assert resp.json()["minutes"] == 60


@pytest.mark.asyncio
async def test_delete_log(authed_with_family):
    client, _, _ = authed_with_family
    r = await client.post("/api/v1/progress/logs", json={
        "taught_on": str(date.today()),
    })
    log_id = r.json()["id"]
    resp = await client.delete(f"/api/v1/progress/logs/{log_id}")
    assert resp.status_code == 204


# ── Summary ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_summary_default_range(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.get("/api/v1/progress/summary")
    assert resp.status_code == 200
    body = resp.json()
    assert "range" in body
    assert "overall_streak" in body
    assert body["teach_counts"]["total"] == 0


@pytest.mark.asyncio
async def test_summary_with_logs_counts(authed_with_family, make_child, make_subject):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    sub = await make_subject(family.id, name="Math")
    today = date.today()

    for d in [today, today - timedelta(days=1), today - timedelta(days=2)]:
        await client.post("/api/v1/progress/logs", json={
            "taught_on": str(d),
            "child_id": str(child.id),
            "subject_id": str(sub.id),
        })

    resp = await client.get(f"/api/v1/progress/summary?from={today - timedelta(days=7)}&to={today}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["teach_counts"]["total"] == 3


# ── Neglected subjects ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_neglected_subjects_empty_when_no_active_curriculum(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.get("/api/v1/progress/neglected")
    assert resp.status_code == 200
    assert resp.json() == []


# ── Report ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_report_required_dates_422(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.get("/api/v1/progress/report")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_report_returns_structure(authed_with_family):
    client, _, _ = authed_with_family
    today = date.today()
    resp = await client.get(f"/api/v1/progress/report?from={today - timedelta(days=7)}&to={today}")
    assert resp.status_code == 200
    body = resp.json()
    assert "family" in body
    assert "children" in body
    assert "curricula" in body
    assert "projects" in body
    assert "teach_counts" in body


# ── Log filters: child_id and subject_id ────────────────────────────────────

@pytest.mark.asyncio
async def test_list_logs_filter_by_child_id(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    today = date.today()

    await client.post("/api/v1/progress/logs", json={"taught_on": str(today), "child_id": str(child.id)})
    await client.post("/api/v1/progress/logs", json={"taught_on": str(today - timedelta(days=1))})

    resp = await client.get(f"/api/v1/progress/logs?child_id={child.id}")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["child_id"] == str(child.id)


@pytest.mark.asyncio
async def test_list_logs_filter_by_subject_id(authed_with_family, make_child, make_subject):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    math = await make_subject(family.id, name="Math")
    science = await make_subject(family.id, name="Science")
    today = date.today()

    await client.post("/api/v1/progress/logs", json={
        "taught_on": str(today), "child_id": str(child.id), "subject_id": str(math.id),
    })
    await client.post("/api/v1/progress/logs", json={
        "taught_on": str(today - timedelta(days=1)), "child_id": str(child.id), "subject_id": str(science.id),
    })

    resp = await client.get(f"/api/v1/progress/logs?subject_id={math.id}")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["subject_id"] == str(math.id)


# ── Update / delete log 404 ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_log_404(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.patch(f"/api/v1/progress/logs/{uuid.uuid4()}", json={"minutes": 30})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_log_404(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.delete(f"/api/v1/progress/logs/{uuid.uuid4()}")
    assert resp.status_code == 404


# ── Summary with child filter ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_summary_child_filter(authed_with_family, make_child, make_subject):
    client, _, family = authed_with_family
    a = await make_child(family.id, first_name="A")
    b = await make_child(family.id, first_name="B")
    sub = await make_subject(family.id, name="Math")
    today = date.today()

    await client.post("/api/v1/progress/logs", json={
        "taught_on": str(today), "child_id": str(a.id), "subject_id": str(sub.id),
    })
    await client.post("/api/v1/progress/logs", json={
        "taught_on": str(today - timedelta(days=1)), "child_id": str(b.id), "subject_id": str(sub.id),
    })

    resp = await client.get(f"/api/v1/progress/summary?from={today - timedelta(days=7)}&to={today}&child_id={a.id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["teach_counts"]["total"] == 1


# ── Neglected subjects with an active curriculum ────────────────────────────

@pytest.mark.asyncio
async def test_neglected_subjects_with_active_curriculum(authed_with_family, make_child, make_subject):
    """A subject in an active curriculum with no teaching logs is neglected."""
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    math = await make_subject(family.id, name="Math")

    from datetime import date as _date, timedelta as _td
    start = str(_date.today() - _td(days=30))
    end = str(_date.today() + _td(days=90))

    r = await client.post("/api/v1/curriculums", json={
        "name": "Spring",
        "period_type": "semester",
        "start_date": start,
        "end_date": end,
        "subjects": [{"subject_id": str(math.id), "weekly_frequency": 3}],
        "child_ids": [str(child.id)],
    })
    cid = r.json()["id"]
    await client.patch(f"/api/v1/curriculums/{cid}/status", json={"status": "active"})

    resp = await client.get("/api/v1/progress/neglected")
    assert resp.status_code == 200
    subjects = resp.json()
    assert len(subjects) >= 1
    names = [s["subject_name"] for s in subjects]
    assert "Math" in names


@pytest.mark.asyncio
async def test_neglected_subjects_not_shown_if_recently_taught(authed_with_family, make_child, make_subject):
    """A subject taught today should not be neglected (threshold=14)."""
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    math = await make_subject(family.id, name="Math")

    from datetime import date as _date, timedelta as _td
    start = str(_date.today() - _td(days=30))
    end = str(_date.today() + _td(days=90))

    r = await client.post("/api/v1/curriculums", json={
        "name": "Spring",
        "period_type": "semester",
        "start_date": start,
        "end_date": end,
        "subjects": [{"subject_id": str(math.id), "weekly_frequency": 3}],
        "child_ids": [str(child.id)],
    })
    cid = r.json()["id"]
    await client.patch(f"/api/v1/curriculums/{cid}/status", json={"status": "active"})

    # Log a session today
    await client.post("/api/v1/progress/logs", json={
        "taught_on": str(_date.today()),
        "child_id": str(child.id),
        "subject_id": str(math.id),
    })

    resp = await client.get("/api/v1/progress/neglected?threshold_days=14")
    assert resp.status_code == 200
    names = [s["subject_name"] for s in resp.json()]
    assert "Math" not in names


@pytest.mark.asyncio
async def test_neglected_subjects_custom_threshold(authed_with_family, make_child, make_subject):
    """A subject taught 5 days ago is neglected at threshold=3, not at threshold=7."""
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    math = await make_subject(family.id, name="Math")

    from datetime import date as _date, timedelta as _td
    start = str(_date.today() - _td(days=30))
    end = str(_date.today() + _td(days=90))

    r = await client.post("/api/v1/curriculums", json={
        "name": "Spring",
        "period_type": "semester",
        "start_date": start,
        "end_date": end,
        "subjects": [{"subject_id": str(math.id), "weekly_frequency": 3}],
        "child_ids": [str(child.id)],
    })
    cid = r.json()["id"]
    await client.patch(f"/api/v1/curriculums/{cid}/status", json={"status": "active"})

    await client.post("/api/v1/progress/logs", json={
        "taught_on": str(_date.today() - _td(days=5)),
        "child_id": str(child.id),
        "subject_id": str(math.id),
    })

    # threshold=3: 5 days ago > 3 day cutoff → neglected
    resp3 = await client.get("/api/v1/progress/neglected?threshold_days=3")
    assert any(s["subject_name"] == "Math" for s in resp3.json())

    # threshold=7: 5 days ago < 7 day cutoff → not neglected
    resp7 = await client.get("/api/v1/progress/neglected?threshold_days=7")
    assert not any(s["subject_name"] == "Math" for s in resp7.json())


# ── Report with child filter ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_report_with_child_filter(authed_with_family, make_child, make_subject):
    client, _, family = authed_with_family
    a = await make_child(family.id, first_name="A")
    b = await make_child(family.id, first_name="B")
    sub = await make_subject(family.id, name="Math")
    today = date.today()

    await client.post("/api/v1/progress/logs", json={
        "taught_on": str(today), "child_id": str(a.id), "subject_id": str(sub.id),
    })
    await client.post("/api/v1/progress/logs", json={
        "taught_on": str(today - timedelta(days=1)), "child_id": str(b.id), "subject_id": str(sub.id),
    })

    resp = await client.get(
        f"/api/v1/progress/report?from={today - timedelta(days=7)}&to={today}&child_id={a.id}"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["teach_counts"]["total_entries"] == 1


# ── Summary streak field present ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_summary_streak_fields_present(authed_with_family, make_child, make_subject):
    """Summary always returns streak structure even with zero data."""
    client, _, family = authed_with_family
    today = date.today()
    resp = await client.get(f"/api/v1/progress/summary?from={today - timedelta(days=30)}&to={today}")
    assert resp.status_code == 200
    body = resp.json()
    streak = body["overall_streak"]
    assert "current_weeks" in streak
    assert "longest_weeks" in streak
