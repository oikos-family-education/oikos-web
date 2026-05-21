"""Tests for /curriculums router and CurriculumService."""
import uuid
from datetime import date, timedelta
import pytest
from sqlalchemy.future import select

from app.models.curriculum import Curriculum, CurriculumSubject, ChildCurriculum


def _payload(name="Spring Semester", **overrides):
    base = {
        "name": name,
        "period_type": "semester",
        "start_date": str(date.today()),
        "end_date": str(date.today() + timedelta(days=120)),
    }
    base.update(overrides)
    return base


# ── Auth gate ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_curriculum_requires_family(authed_client):
    client, _ = authed_client
    resp = await client.post("/api/v1/curriculums", json=_payload())
    assert resp.status_code == 400


# ── Create / read ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_curriculum_minimal(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/curriculums", json=_payload())
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Spring Semester"
    assert body["status"] == "draft"


@pytest.mark.asyncio
async def test_create_curriculum_with_subjects_and_children(authed_with_family, make_subject, make_child):
    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="Math")
    child = await make_child(family.id, first_name="A")

    resp = await client.post("/api/v1/curriculums", json=_payload(
        subjects=[{
            "subject_id": str(sub.id),
            "weekly_frequency": 3,
            "session_duration_minutes": 60,
            "scheduled_days": [0, 2, 4],
            "preferred_time_slot": "morning",
        }],
        child_ids=[str(child.id)],
    ))
    assert resp.status_code == 201
    body = resp.json()
    assert len(body["curriculum_subjects"]) == 1
    assert body["curriculum_subjects"][0]["weekly_frequency"] == 3
    assert len(body["child_curriculums"]) == 1


@pytest.mark.asyncio
async def test_create_curriculum_end_before_start_422(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/curriculums", json=_payload(
        start_date=str(date.today()),
        end_date=str(date.today() - timedelta(days=1)),
    ))
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_curriculum_subject_scheduled_days_mismatch_422(authed_with_family, make_subject):
    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="Math")
    resp = await client.post("/api/v1/curriculums", json=_payload(subjects=[{
        "subject_id": str(sub.id),
        "weekly_frequency": 3,
        "scheduled_days": [0, 1],  # mismatch
    }]))
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_curriculum_404_for_unknown(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.get(f"/api/v1/curriculums/{uuid.uuid4()}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_curriculums_returns_only_own(authed_with_family):
    client, _, _ = authed_with_family
    await client.post("/api/v1/curriculums", json=_payload(name="A"))
    await client.post("/api/v1/curriculums", json=_payload(name="B"))
    resp = await client.get("/api/v1/curriculums")
    assert resp.status_code == 200
    names = {c["name"] for c in resp.json()}
    assert names == {"A", "B"}


# ── Update ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_curriculum(authed_with_family):
    client, _, _ = authed_with_family
    r1 = await client.post("/api/v1/curriculums", json=_payload(name="Old"))
    cid = r1.json()["id"]
    r2 = await client.patch(f"/api/v1/curriculums/{cid}", json={"name": "New"})
    assert r2.status_code == 200
    assert r2.json()["name"] == "New"


# ── Status transitions ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_status_draft_to_active(authed_with_family):
    client, _, _ = authed_with_family
    r1 = await client.post("/api/v1/curriculums", json=_payload(name="X"))
    cid = r1.json()["id"]
    r2 = await client.patch(f"/api/v1/curriculums/{cid}/status", json={"status": "active"})
    assert r2.status_code == 200
    assert r2.json()["status"] == "active"


@pytest.mark.asyncio
async def test_status_invalid_transition(authed_with_family):
    """draft → completed is not allowed."""
    client, _, _ = authed_with_family
    r1 = await client.post("/api/v1/curriculums", json=_payload(name="X"))
    cid = r1.json()["id"]
    r2 = await client.patch(f"/api/v1/curriculums/{cid}/status", json={"status": "completed"})
    assert r2.status_code == 400


@pytest.mark.asyncio
async def test_status_active_collision_409(authed_with_family, make_subject, make_child):
    """Activating a second curriculum for the same child without `force` is 409."""
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")

    r1 = await client.post("/api/v1/curriculums", json=_payload(
        name="C1", child_ids=[str(child.id)],
    ))
    c1 = r1.json()["id"]
    await client.patch(f"/api/v1/curriculums/{c1}/status", json={"status": "active"})

    r2 = await client.post("/api/v1/curriculums", json=_payload(
        name="C2", child_ids=[str(child.id)],
    ))
    c2 = r2.json()["id"]
    resp = await client.patch(f"/api/v1/curriculums/{c2}/status", json={"status": "active"})
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_status_active_collision_force_pauses_first(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")

    r1 = await client.post("/api/v1/curriculums", json=_payload(
        name="C1", child_ids=[str(child.id)],
    ))
    c1 = r1.json()["id"]
    await client.patch(f"/api/v1/curriculums/{c1}/status", json={"status": "active"})

    r2 = await client.post("/api/v1/curriculums", json=_payload(
        name="C2", child_ids=[str(child.id)],
    ))
    c2 = r2.json()["id"]
    resp = await client.patch(
        f"/api/v1/curriculums/{c2}/status",
        json={"status": "active", "force": True},
    )
    assert resp.status_code == 200

    # First was paused.
    r3 = await client.get(f"/api/v1/curriculums/{c1}")
    assert r3.json()["status"] == "paused"


@pytest.mark.asyncio
async def test_status_template_removes_child_assignments(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    r1 = await client.post("/api/v1/curriculums", json=_payload(
        name="X", child_ids=[str(child.id)],
    ))
    cid = r1.json()["id"]
    # draft → archived → draft → template path
    # draft → template requires going via archived/template not allowed; only draft → ['active','archived','template']
    resp = await client.patch(f"/api/v1/curriculums/{cid}/status", json={"status": "template"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "template"

    # Re-fetch and confirm child_curriculums cleared.
    r3 = await client.get(f"/api/v1/curriculums/{cid}")
    assert r3.json()["child_curriculums"] == []


# ── Delete ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_draft(authed_with_family):
    client, _, _ = authed_with_family
    r1 = await client.post("/api/v1/curriculums", json=_payload(name="X"))
    cid = r1.json()["id"]
    r2 = await client.delete(f"/api/v1/curriculums/{cid}")
    assert r2.status_code == 204


@pytest.mark.asyncio
async def test_cannot_delete_active(authed_with_family):
    client, _, _ = authed_with_family
    r1 = await client.post("/api/v1/curriculums", json=_payload(name="X"))
    cid = r1.json()["id"]
    await client.patch(f"/api/v1/curriculums/{cid}/status", json={"status": "active"})
    resp = await client.delete(f"/api/v1/curriculums/{cid}")
    assert resp.status_code == 400


# ── Subject management ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_add_subject_to_curriculum(authed_with_family, make_subject):
    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="Math")
    r1 = await client.post("/api/v1/curriculums", json=_payload(name="X"))
    cid = r1.json()["id"]

    r2 = await client.post(
        f"/api/v1/curriculums/{cid}/subjects",
        json={
            "subject_id": str(sub.id),
            "weekly_frequency": 4,
            "session_duration_minutes": 30,
            "scheduled_days": [0, 1, 2, 3],
        },
    )
    assert r2.status_code == 201
    assert r2.json()["weekly_frequency"] == 4


@pytest.mark.asyncio
async def test_add_duplicate_subject_409(authed_with_family, make_subject):
    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="Math")
    r1 = await client.post("/api/v1/curriculums", json=_payload(name="X"))
    cid = r1.json()["id"]

    payload = {"subject_id": str(sub.id), "weekly_frequency": 1}
    r2 = await client.post(f"/api/v1/curriculums/{cid}/subjects", json=payload)
    assert r2.status_code == 201
    r3 = await client.post(f"/api/v1/curriculums/{cid}/subjects", json=payload)
    assert r3.status_code == 409


# ── Child assignment ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_assign_child(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="C")
    r1 = await client.post("/api/v1/curriculums", json=_payload(name="X"))
    cid = r1.json()["id"]

    r2 = await client.post(
        f"/api/v1/curriculums/{cid}/children",
        json={"child_id": str(child.id)},
    )
    assert r2.status_code == 201


@pytest.mark.asyncio
async def test_assign_child_to_template_400(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="C")
    r1 = await client.post("/api/v1/curriculums", json=_payload(name="X"))
    cid = r1.json()["id"]
    await client.patch(f"/api/v1/curriculums/{cid}/status", json={"status": "template"})

    r2 = await client.post(
        f"/api/v1/curriculums/{cid}/children",
        json={"child_id": str(child.id)},
    )
    assert r2.status_code == 400


# ── Templates ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_templates(authed_with_family):
    """Curriculums in 'template' status appear under /templates."""
    client, _, _ = authed_with_family
    r1 = await client.post("/api/v1/curriculums", json=_payload(name="Draft"))
    r2 = await client.post("/api/v1/curriculums", json=_payload(name="T"))
    c2 = r2.json()["id"]
    await client.patch(f"/api/v1/curriculums/{c2}/status", json={"status": "template"})

    resp = await client.get("/api/v1/curriculums/templates")
    assert resp.status_code == 200
    names = [c["name"] for c in resp.json()]
    assert "T" in names
    assert "Draft" not in names


@pytest.mark.asyncio
async def test_apply_template_creates_draft_copy(authed_with_family, make_subject):
    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="Math")
    r1 = await client.post("/api/v1/curriculums", json=_payload(
        name="Tmpl",
        subjects=[{"subject_id": str(sub.id), "weekly_frequency": 2}],
    ))
    cid = r1.json()["id"]
    await client.patch(f"/api/v1/curriculums/{cid}/status", json={"status": "template"})

    resp = await client.post(f"/api/v1/curriculums/{cid}/apply-template")
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "draft"
    assert body["name"] == "Tmpl"
    assert len(body["curriculum_subjects"]) == 1
    assert body["id"] != cid  # it's a new curriculum


# ── Subject management (update + remove) ────────────────────────────────────

@pytest.mark.asyncio
async def test_update_curriculum_subject(authed_with_family, make_subject):
    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="Science")
    r1 = await client.post("/api/v1/curriculums", json=_payload(name="X"))
    cid = r1.json()["id"]
    r2 = await client.post(
        f"/api/v1/curriculums/{cid}/subjects",
        json={"subject_id": str(sub.id), "weekly_frequency": 2},
    )
    cs_id = r2.json()["id"]

    resp = await client.patch(
        f"/api/v1/curriculums/subjects/{cs_id}",
        json={"weekly_frequency": 5, "session_duration_minutes": 45},
    )
    assert resp.status_code == 200
    assert resp.json()["weekly_frequency"] == 5
    assert resp.json()["session_duration_minutes"] == 45


@pytest.mark.asyncio
async def test_remove_subject_from_curriculum(authed_with_family, make_subject):
    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="History")
    r1 = await client.post("/api/v1/curriculums", json=_payload(name="X"))
    cid = r1.json()["id"]
    r2 = await client.post(
        f"/api/v1/curriculums/{cid}/subjects",
        json={"subject_id": str(sub.id), "weekly_frequency": 1},
    )
    cs_id = r2.json()["id"]

    resp = await client.delete(f"/api/v1/curriculums/subjects/{cs_id}")
    assert resp.status_code == 204

    detail = (await client.get(f"/api/v1/curriculums/{cid}")).json()
    assert detail["curriculum_subjects"] == []


# ── Child assignment (unassign) ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_unassign_child_from_curriculum(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    r1 = await client.post("/api/v1/curriculums", json=_payload(name="X"))
    cid = r1.json()["id"]
    await client.post(f"/api/v1/curriculums/{cid}/children", json={"child_id": str(child.id)})

    resp = await client.delete(f"/api/v1/curriculums/{cid}/children/{child.id}")
    assert resp.status_code == 204

    detail = (await client.get(f"/api/v1/curriculums/{cid}")).json()
    assert detail["child_curriculums"] == []


# ── /curriculums/enrollments?date= (progress page day checklist) ────────────

@pytest.mark.asyncio
async def test_enrollments_for_date_returns_active_subject_child_pairs(
    authed_with_family, make_subject, make_child,
):
    """Active curricula whose window includes the target date should appear,
    grouped by subject with one entry per enrolled child."""
    client, _, family = authed_with_family
    math = await make_subject(family.id, name="Math", color="#111111")
    reading = await make_subject(family.id, name="Reading", color="#222222")
    lia = await make_child(family.id, first_name="Lia")
    theo = await make_child(family.id, first_name="Theo")

    # Curriculum spanning today, with Math (Lia+Theo) and Reading (Lia only).
    today = date.today()
    r1 = await client.post("/api/v1/curriculums", json=_payload(
        name="Spring",
        start_date=str(today - timedelta(days=10)),
        end_date=str(today + timedelta(days=30)),
        subjects=[
            {"subject_id": str(math.id), "session_duration_minutes": 45},
            {"subject_id": str(reading.id), "session_duration_minutes": 30},
        ],
        child_ids=[str(lia.id), str(theo.id)],
    ))
    cid = r1.json()["id"]
    await client.patch(f"/api/v1/curriculums/{cid}/status", json={"status": "active"})

    # A separate "Reading" curriculum that only has Lia would normally be how
    # you'd model "Reading is just for Lia" — but for simplicity here, we'll
    # just verify the multi-child grouping from the curriculum above.
    resp = await client.get(f"/api/v1/curriculums/enrollments?date={today}")
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) == 2

    by_subject = {r["subject_name"]: r for r in rows}
    assert set(by_subject.keys()) == {"Math", "Reading"}

    math_row = by_subject["Math"]
    assert math_row["color"] == "#111111"
    assert math_row["duration_minutes"] == 45
    assert set(math_row["child_names"]) == {"Lia", "Theo"}

    reading_row = by_subject["Reading"]
    assert reading_row["duration_minutes"] == 30
    assert set(reading_row["child_names"]) == {"Lia", "Theo"}


@pytest.mark.asyncio
async def test_enrollments_for_date_excludes_draft_and_template(
    authed_with_family, make_subject, make_child,
):
    """Draft and template curricula should never show up — they were never
    actually running."""
    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="Math")
    child = await make_child(family.id, first_name="Lia")
    today = date.today()

    # Draft (default status after create) — not active, should be excluded
    r = await client.post("/api/v1/curriculums", json=_payload(
        name="Future plan",
        start_date=str(today - timedelta(days=1)),
        end_date=str(today + timedelta(days=10)),
        subjects=[{"subject_id": str(sub.id)}],
        child_ids=[str(child.id)],
    ))
    assert r.json()["status"] == "draft"

    resp = await client.get(f"/api/v1/curriculums/enrollments?date={today}")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_enrollments_for_date_excludes_out_of_window(
    authed_with_family, make_subject, make_child,
):
    """A date outside the curriculum's start/end window should return nothing,
    even for active curricula."""
    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="Math")
    child = await make_child(family.id, first_name="Lia")
    today = date.today()
    long_ago = today - timedelta(days=400)

    r = await client.post("/api/v1/curriculums", json=_payload(
        name="Current term",
        start_date=str(today - timedelta(days=5)),
        end_date=str(today + timedelta(days=30)),
        subjects=[{"subject_id": str(sub.id)}],
        child_ids=[str(child.id)],
    ))
    cid = r.json()["id"]
    await client.patch(f"/api/v1/curriculums/{cid}/status", json={"status": "active"})

    # Date inside window → returns the row
    resp = await client.get(f"/api/v1/curriculums/enrollments?date={today}")
    assert len(resp.json()) == 1

    # Date before window → empty
    resp = await client.get(f"/api/v1/curriculums/enrollments?date={long_ago}")
    assert resp.json() == []


@pytest.mark.asyncio
async def test_enrollments_for_date_includes_completed_curricula(
    authed_with_family, make_subject, make_child,
):
    """A completed curriculum that ran during the target date should still
    appear — its history is honest, just no longer in progress."""
    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="Math")
    child = await make_child(family.id, first_name="Lia")
    today = date.today()

    r = await client.post("/api/v1/curriculums", json=_payload(
        name="Past term",
        start_date=str(today - timedelta(days=30)),
        end_date=str(today + timedelta(days=30)),
        subjects=[{"subject_id": str(sub.id)}],
        child_ids=[str(child.id)],
    ))
    cid = r.json()["id"]
    await client.patch(f"/api/v1/curriculums/{cid}/status", json={"status": "active"})
    await client.patch(f"/api/v1/curriculums/{cid}/status", json={"status": "completed"})

    resp = await client.get(f"/api/v1/curriculums/enrollments?date={today}")
    assert len(resp.json()) == 1


@pytest.mark.asyncio
async def test_enrollments_for_date_excludes_archived_children(
    authed_with_family, make_subject, make_child, db,
):
    """Archived children should not appear in enrollment rows, even if their
    curriculum is active."""
    from datetime import datetime, timezone as _tz
    from app.models.child import Child as _Child

    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="Math")
    active_child = await make_child(family.id, first_name="Active")
    archived_child = await make_child(family.id, first_name="Archived")

    today = date.today()
    r = await client.post("/api/v1/curriculums", json=_payload(
        name="X",
        subjects=[{"subject_id": str(sub.id)}],
        child_ids=[str(active_child.id), str(archived_child.id)],
    ))
    cid = r.json()["id"]
    await client.patch(f"/api/v1/curriculums/{cid}/status", json={"status": "active"})

    # Archive one child directly via the shared test session.
    c = (await db.execute(select(_Child).where(_Child.id == archived_child.id))).scalars().first()
    c.archived_at = datetime.now(_tz.utc)
    await db.commit()

    resp = await client.get(f"/api/v1/curriculums/enrollments?date={today}")
    rows = resp.json()
    assert len(rows) == 1
    assert rows[0]["child_names"] == ["Active"]
