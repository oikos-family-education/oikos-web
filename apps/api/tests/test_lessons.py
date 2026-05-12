"""Tests for /lessons router and LessonService.

Lessons are anchored only to a Subject. Children, curricula and projects flow
through the subject's existing relationships — never stored on the lesson itself.
"""
import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.models.curriculum import ChildCurriculum, Curriculum, CurriculumSubject
from app.models.lesson import Lesson, LessonBlock
from app.models.project import Project, ProjectSubject
from app.models.teaching_log import TeachingLog


# ── Helpers ────────────────────────────────────────────────────────────────

def _payload(subject_id, *, scheduled_for=None, **overrides):
    base = {
        "title": overrides.pop("title", "Multiplication tables"),
        "subject_id": str(subject_id),
        "scheduled_for": str(scheduled_for or date.today()),
    }
    base.update(overrides)
    return base


async def _make_curriculum_with_child(db, family_id, subject_id, child_id):
    """Wire a subject into a curriculum that a child is enrolled in."""
    curriculum = Curriculum(
        family_id=family_id,
        name=f"Curr {uuid.uuid4().hex[:6]}",
        period_type="semester",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=90),
        status="active",
    )
    db.add(curriculum)
    await db.flush()
    db.add(CurriculumSubject(
        curriculum_id=curriculum.id,
        subject_id=subject_id,
        weekly_frequency=3,
        session_duration_minutes=45,
        scheduled_days=[0, 2, 4],
    ))
    db.add(ChildCurriculum(child_id=child_id, curriculum_id=curriculum.id))
    await db.commit()
    return curriculum


async def _make_project_with_subject(db, family_id, subject_id):
    project = Project(family_id=family_id, title=f"Project {uuid.uuid4().hex[:6]}")
    db.add(project)
    await db.flush()
    db.add(ProjectSubject(project_id=project.id, subject_id=subject_id, is_primary=True))
    await db.commit()
    return project


# ── Auth gate ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_lessons_require_family(authed_client):
    client, _ = authed_client
    resp = await client.get("/api/v1/lessons")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_lessons_require_authentication(client):
    resp = await client.get("/api/v1/lessons")
    assert resp.status_code == 401


# ── Create ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_lesson_success(authed_with_family, make_subject):
    client, _, family = authed_with_family
    subject = await make_subject(family.id, name="Math")
    resp = await client.post("/api/v1/lessons", json=_payload(subject.id))
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "Multiplication tables"
    assert body["status"] == "draft"
    assert body["subject"]["id"] == str(subject.id)
    assert body["subject"]["child_ids"] == []
    assert body["subject"]["curriculum_ids"] == []
    assert body["subject"]["project_ids"] == []
    assert body["blocks"] == []


@pytest.mark.asyncio
async def test_create_lesson_includes_derived_relations(
    authed_with_family, make_subject, make_child, db
):
    client, _, family = authed_with_family
    subject = await make_subject(family.id, name="Math")
    child = await make_child(family.id, first_name="Anna")
    curriculum = await _make_curriculum_with_child(db, family.id, subject.id, child.id)
    project = await _make_project_with_subject(db, family.id, subject.id)

    resp = await client.post("/api/v1/lessons", json=_payload(subject.id))
    assert resp.status_code == 201
    body = resp.json()
    assert body["subject"]["child_ids"] == [str(child.id)]
    assert body["subject"]["curriculum_ids"] == [str(curriculum.id)]
    assert body["subject"]["project_ids"] == [str(project.id)]


@pytest.mark.asyncio
async def test_create_lesson_unknown_subject_404(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/lessons", json=_payload(uuid.uuid4()))
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_lesson_other_family_subject_403(
    authed_with_family, make_user, make_subject, db
):
    client, _, _ = authed_with_family
    # Create a private subject owned by another family.
    other_user = await make_user(email="other@example.com")
    from app.models.family import Family
    other_family = Family(
        account_id=other_user.id,
        family_name="Other",
        family_name_slug=f"other-{uuid.uuid4().hex[:6]}",
        shield_config={},
        home_languages=["en"],
        education_methods=[],
        current_curriculum=[],
    )
    db.add(other_family)
    await db.commit()
    await db.refresh(other_family)

    other_subject = await make_subject(other_family.id, name="Foreign")
    resp = await client.post("/api/v1/lessons", json=_payload(other_subject.id))
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_lesson_platform_subject_allowed(
    authed_with_family, make_subject
):
    client, _, _ = authed_with_family
    platform = await make_subject(
        None, name="Latin", is_platform_subject=True, is_public=True,
    )
    resp = await client.post("/api/v1/lessons", json=_payload(platform.id))
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_create_lesson_invalid_duration_422(
    authed_with_family, make_subject
):
    client, _, family = authed_with_family
    subject = await make_subject(family.id, name="Math")
    resp = await client.post(
        "/api/v1/lessons",
        json=_payload(subject.id, estimated_duration_minutes=0),
    )
    assert resp.status_code == 422


# ── List / filters ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_lessons_returns_only_own_family(
    authed_with_family, make_subject
):
    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="Math")
    await client.post("/api/v1/lessons", json=_payload(sub.id, title="A"))
    await client.post("/api/v1/lessons", json=_payload(sub.id, title="B"))
    resp = await client.get("/api/v1/lessons")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    titles = sorted(item["title"] for item in body["items"])
    assert titles == ["A", "B"]


@pytest.mark.asyncio
async def test_list_lessons_date_range(authed_with_family, make_subject):
    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="Math")
    today = date.today()
    yesterday = today - timedelta(days=1)
    tomorrow = today + timedelta(days=1)
    await client.post("/api/v1/lessons", json=_payload(sub.id, scheduled_for=yesterday, title="Y"))
    await client.post("/api/v1/lessons", json=_payload(sub.id, scheduled_for=today, title="T"))
    await client.post("/api/v1/lessons", json=_payload(sub.id, scheduled_for=tomorrow, title="W"))

    resp = await client.get(
        f"/api/v1/lessons?from={today}&to={today}"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["title"] == "T"


@pytest.mark.asyncio
async def test_list_lessons_by_subject(authed_with_family, make_subject):
    client, _, family = authed_with_family
    sub_a = await make_subject(family.id, name="Math")
    sub_b = await make_subject(family.id, name="Reading")
    await client.post("/api/v1/lessons", json=_payload(sub_a.id, title="A1"))
    await client.post("/api/v1/lessons", json=_payload(sub_b.id, title="B1"))
    resp = await client.get(f"/api/v1/lessons?subject_id={sub_a.id}")
    assert resp.status_code == 200
    titles = [it["title"] for it in resp.json()["items"]]
    assert titles == ["A1"]


@pytest.mark.asyncio
async def test_list_lessons_by_status(authed_with_family, make_subject):
    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="Math")
    r1 = await client.post("/api/v1/lessons", json=_payload(sub.id, title="A"))
    await client.post("/api/v1/lessons", json=_payload(sub.id, title="B"))
    # Move A to scheduled.
    await client.patch(
        f"/api/v1/lessons/{r1.json()['id']}/status",
        json={"status": "scheduled"},
    )
    resp = await client.get("/api/v1/lessons?status=scheduled")
    titles = [it["title"] for it in resp.json()["items"]]
    assert titles == ["A"]


@pytest.mark.asyncio
async def test_list_lessons_by_child_via_subject(
    authed_with_family, make_subject, make_child, db
):
    client, _, family = authed_with_family
    sub_in = await make_subject(family.id, name="Math")
    sub_out = await make_subject(family.id, name="Latin")
    child = await make_child(family.id, first_name="Anna")
    await _make_curriculum_with_child(db, family.id, sub_in.id, child.id)
    await client.post("/api/v1/lessons", json=_payload(sub_in.id, title="Yes"))
    await client.post("/api/v1/lessons", json=_payload(sub_out.id, title="No"))

    resp = await client.get(f"/api/v1/lessons?child_id={child.id}")
    assert resp.status_code == 200
    titles = [it["title"] for it in resp.json()["items"]]
    assert titles == ["Yes"]


@pytest.mark.asyncio
async def test_list_lessons_by_curriculum_via_subject(
    authed_with_family, make_subject, make_child, db
):
    client, _, family = authed_with_family
    sub_in = await make_subject(family.id, name="Math")
    sub_out = await make_subject(family.id, name="Latin")
    child = await make_child(family.id, first_name="Anna")
    curriculum = await _make_curriculum_with_child(db, family.id, sub_in.id, child.id)
    await client.post("/api/v1/lessons", json=_payload(sub_in.id, title="In"))
    await client.post("/api/v1/lessons", json=_payload(sub_out.id, title="Out"))

    resp = await client.get(f"/api/v1/lessons?curriculum_id={curriculum.id}")
    titles = [it["title"] for it in resp.json()["items"]]
    assert titles == ["In"]


@pytest.mark.asyncio
async def test_list_lessons_by_project_via_subject(
    authed_with_family, make_subject, db
):
    client, _, family = authed_with_family
    sub_in = await make_subject(family.id, name="Math")
    sub_out = await make_subject(family.id, name="Latin")
    project = await _make_project_with_subject(db, family.id, sub_in.id)
    await client.post("/api/v1/lessons", json=_payload(sub_in.id, title="In"))
    await client.post("/api/v1/lessons", json=_payload(sub_out.id, title="Out"))

    resp = await client.get(f"/api/v1/lessons?project_id={project.id}")
    titles = [it["title"] for it in resp.json()["items"]]
    assert titles == ["In"]


# ── Detail / update / delete ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_lesson_detail_includes_blocks(
    authed_with_family, make_subject
):
    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="Math")
    created = await client.post("/api/v1/lessons", json=_payload(sub.id))
    lid = created.json()["id"]

    await client.post(f"/api/v1/lessons/{lid}/blocks", json={
        "type": "text",
        "content": {"html": "<p>Hello</p>"},
    })
    resp = await client.get(f"/api/v1/lessons/{lid}")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["blocks"]) == 1
    assert body["blocks"][0]["type"] == "text"


@pytest.mark.asyncio
async def test_get_lesson_other_family_404(
    authed_with_family, make_subject, make_user, db
):
    client, _, _ = authed_with_family
    other_user = await make_user(email="other-detail@example.com")
    from app.models.family import Family
    other = Family(
        account_id=other_user.id, family_name="Other",
        family_name_slug=f"o-{uuid.uuid4().hex[:6]}", shield_config={},
        home_languages=[], education_methods=[], current_curriculum=[],
    )
    db.add(other)
    await db.flush()
    other_sub = await make_subject(other.id)
    foreign = Lesson(
        family_id=other.id, subject_id=other_sub.id,
        title="Foreign", scheduled_for=date.today(), status="draft",
    )
    db.add(foreign)
    await db.commit()
    resp = await client.get(f"/api/v1/lessons/{foreign.id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_lesson_fields(authed_with_family, make_subject):
    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="Math")
    created = await client.post("/api/v1/lessons", json=_payload(sub.id))
    lid = created.json()["id"]
    resp = await client.patch(f"/api/v1/lessons/{lid}", json={
        "title": "New title",
        "objectives": ["solve 5x5", "solve 6x6"],
        "tags": ["arithmetic"],
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "New title"
    assert body["objectives"] == ["solve 5x5", "solve 6x6"]
    assert body["tags"] == ["arithmetic"]


@pytest.mark.asyncio
async def test_delete_lesson_cascades_blocks(
    authed_with_family, make_subject, db
):
    client, _, family = authed_with_family
    sub = await make_subject(family.id)
    created = await client.post("/api/v1/lessons", json=_payload(sub.id))
    lid = created.json()["id"]
    await client.post(f"/api/v1/lessons/{lid}/blocks", json={
        "type": "divider", "content": {},
    })
    resp = await client.delete(f"/api/v1/lessons/{lid}")
    assert resp.status_code == 204

    # Verify both rows gone
    res = await db.execute(select(Lesson).where(Lesson.id == lid))
    assert res.scalars().first() is None
    res = await db.execute(select(LessonBlock).where(LessonBlock.lesson_id == lid))
    assert res.scalars().first() is None


# ── Status transitions ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_invalid_status_transition_422(authed_with_family, make_subject):
    client, _, family = authed_with_family
    sub = await make_subject(family.id)
    created = await client.post("/api/v1/lessons", json=_payload(sub.id))
    lid = created.json()["id"]
    # Cancel it first.
    await client.patch(f"/api/v1/lessons/{lid}/status", json={"status": "cancelled"})
    # Now try to revive — not allowed.
    resp = await client.patch(
        f"/api/v1/lessons/{lid}/status", json={"status": "completed"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_mark_lesson_complete_creates_log_per_child(
    authed_with_family, make_subject, make_child, db
):
    client, _, family = authed_with_family
    sub = await make_subject(family.id)
    child_a = await make_child(family.id, first_name="A")
    child_b = await make_child(family.id, first_name="B")
    await _make_curriculum_with_child(db, family.id, sub.id, child_a.id)
    await _make_curriculum_with_child(db, family.id, sub.id, child_b.id)

    created = await client.post(
        "/api/v1/lessons",
        json=_payload(sub.id, estimated_duration_minutes=30),
    )
    lid = created.json()["id"]
    resp = await client.patch(f"/api/v1/lessons/{lid}/status", json={
        "status": "completed",
        "actual_duration_minutes": 35,
        "create_teaching_log": True,
        "completion_notes": "Great work",
    })
    assert resp.status_code == 200

    res = await db.execute(
        select(TeachingLog).where(TeachingLog.lesson_id == lid)
    )
    logs = list(res.scalars().all())
    assert len(logs) == 2
    assert {l.child_id for l in logs} == {child_a.id, child_b.id}
    for log in logs:
        assert log.subject_id == sub.id
        assert log.minutes == 35
        assert log.taught_on == date.today()


@pytest.mark.asyncio
async def test_mark_lesson_complete_no_children_creates_family_log(
    authed_with_family, make_subject, db
):
    client, _, family = authed_with_family
    sub = await make_subject(family.id)
    created = await client.post(
        "/api/v1/lessons", json=_payload(sub.id, estimated_duration_minutes=20),
    )
    lid = created.json()["id"]
    await client.patch(f"/api/v1/lessons/{lid}/status", json={
        "status": "completed", "create_teaching_log": True,
    })
    res = await db.execute(
        select(TeachingLog).where(TeachingLog.lesson_id == lid)
    )
    logs = list(res.scalars().all())
    assert len(logs) == 1
    assert logs[0].child_id is None
    assert logs[0].subject_id == sub.id


@pytest.mark.asyncio
async def test_mark_lesson_complete_no_log_when_disabled(
    authed_with_family, make_subject, db
):
    client, _, family = authed_with_family
    sub = await make_subject(family.id)
    created = await client.post("/api/v1/lessons", json=_payload(sub.id))
    lid = created.json()["id"]
    await client.patch(f"/api/v1/lessons/{lid}/status", json={
        "status": "completed", "create_teaching_log": False,
    })
    res = await db.execute(
        select(TeachingLog).where(TeachingLog.lesson_id == lid)
    )
    assert list(res.scalars().all()) == []


# ── Today / Week ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_today_returns_only_today_non_cancelled(
    authed_with_family, make_subject
):
    client, _, family = authed_with_family
    sub = await make_subject(family.id)
    today = date.today()
    yesterday = today - timedelta(days=1)
    tomorrow = today + timedelta(days=1)
    today_resp = await client.post(
        "/api/v1/lessons", json=_payload(sub.id, scheduled_for=today, title="T"),
    )
    cancelled_resp = await client.post(
        "/api/v1/lessons", json=_payload(sub.id, scheduled_for=today, title="C"),
    )
    await client.post("/api/v1/lessons", json=_payload(sub.id, scheduled_for=yesterday, title="Y"))
    await client.post("/api/v1/lessons", json=_payload(sub.id, scheduled_for=tomorrow, title="W"))
    await client.patch(
        f"/api/v1/lessons/{cancelled_resp.json()['id']}/status",
        json={"status": "cancelled"},
    )

    resp = await client.get("/api/v1/lessons/today")
    assert resp.status_code == 200
    titles = [it["title"] for it in resp.json()]
    assert titles == ["T"]


@pytest.mark.asyncio
async def test_week_view_groups_by_date(authed_with_family, make_subject):
    client, _, family = authed_with_family
    sub = await make_subject(family.id)
    monday = date.today() - timedelta(days=date.today().weekday())
    tuesday = monday + timedelta(days=1)
    await client.post("/api/v1/lessons", json=_payload(sub.id, scheduled_for=monday, title="M"))
    await client.post("/api/v1/lessons", json=_payload(sub.id, scheduled_for=tuesday, title="Tu"))

    resp = await client.get(f"/api/v1/lessons/week?week_start={monday}")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 7
    assert [it["title"] for it in body[monday.isoformat()]] == ["M"]
    assert [it["title"] for it in body[tuesday.isoformat()]] == ["Tu"]


# ── Blocks ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_block_auto_sort_order(authed_with_family, make_subject):
    client, _, family = authed_with_family
    sub = await make_subject(family.id)
    created = await client.post("/api/v1/lessons", json=_payload(sub.id))
    lid = created.json()["id"]
    r1 = await client.post(f"/api/v1/lessons/{lid}/blocks", json={
        "type": "text", "content": {"html": "<p>1</p>"},
    })
    r2 = await client.post(f"/api/v1/lessons/{lid}/blocks", json={
        "type": "text", "content": {"html": "<p>2</p>"},
    })
    assert r1.json()["sort_order"] == 0
    assert r2.json()["sort_order"] == 1


@pytest.mark.asyncio
async def test_create_block_invalid_type_422(
    authed_with_family, make_subject
):
    client, _, family = authed_with_family
    sub = await make_subject(family.id)
    created = await client.post("/api/v1/lessons", json=_payload(sub.id))
    lid = created.json()["id"]
    resp = await client.post(f"/api/v1/lessons/{lid}/blocks", json={
        "type": "bogus", "content": {},
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_link_block_invalid_scheme_422(
    authed_with_family, make_subject
):
    client, _, family = authed_with_family
    sub = await make_subject(family.id)
    created = await client.post("/api/v1/lessons", json=_payload(sub.id))
    lid = created.json()["id"]
    resp = await client.post(f"/api/v1/lessons/{lid}/blocks", json={
        "type": "link",
        "content": {"url": "javascript:alert(1)", "title": "x"},
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_blocks_ordered_and_update_block(
    authed_with_family, make_subject
):
    client, _, family = authed_with_family
    sub = await make_subject(family.id)
    created = await client.post("/api/v1/lessons", json=_payload(sub.id))
    lid = created.json()["id"]
    r1 = await client.post(f"/api/v1/lessons/{lid}/blocks", json={
        "type": "text", "content": {"html": "<p>One</p>"},
    })
    r2 = await client.post(f"/api/v1/lessons/{lid}/blocks", json={
        "type": "heading", "content": {"level": 2, "text": "Two"},
    })

    listing = (await client.get(f"/api/v1/lessons/{lid}/blocks")).json()
    assert [b["id"] for b in listing] == [r1.json()["id"], r2.json()["id"]]

    upd = await client.patch(
        f"/api/v1/lessons/{lid}/blocks/{r1.json()['id']}",
        json={"content": {"html": "<p>Updated</p>"}},
    )
    assert upd.status_code == 200
    assert upd.json()["content"]["html"] == "<p>Updated</p>"


@pytest.mark.asyncio
async def test_reorder_blocks(authed_with_family, make_subject):
    client, _, family = authed_with_family
    sub = await make_subject(family.id)
    created = await client.post("/api/v1/lessons", json=_payload(sub.id))
    lid = created.json()["id"]
    r1 = await client.post(f"/api/v1/lessons/{lid}/blocks", json={
        "type": "text", "content": {"html": "<p>A</p>"},
    })
    r2 = await client.post(f"/api/v1/lessons/{lid}/blocks", json={
        "type": "text", "content": {"html": "<p>B</p>"},
    })
    r3 = await client.post(f"/api/v1/lessons/{lid}/blocks", json={
        "type": "text", "content": {"html": "<p>C</p>"},
    })

    new_order = [r3.json()["id"], r1.json()["id"], r2.json()["id"]]
    resp = await client.put(
        f"/api/v1/lessons/{lid}/blocks/reorder",
        json={"order": new_order},
    )
    assert resp.status_code == 200
    listed = [b["id"] for b in resp.json()]
    assert listed == new_order


@pytest.mark.asyncio
async def test_delete_block(authed_with_family, make_subject):
    client, _, family = authed_with_family
    sub = await make_subject(family.id)
    created = await client.post("/api/v1/lessons", json=_payload(sub.id))
    lid = created.json()["id"]
    r1 = await client.post(f"/api/v1/lessons/{lid}/blocks", json={
        "type": "divider", "content": {},
    })
    bid = r1.json()["id"]
    resp = await client.delete(f"/api/v1/lessons/{lid}/blocks/{bid}")
    assert resp.status_code == 204
    listing = (await client.get(f"/api/v1/lessons/{lid}/blocks")).json()
    assert listing == []


@pytest.mark.asyncio
async def test_blocks_for_other_family_lesson_404(
    authed_with_family, make_subject, make_user, db
):
    client, _, _ = authed_with_family
    other_user = await make_user(email="other-blocks@example.com")
    from app.models.family import Family
    other = Family(
        account_id=other_user.id, family_name="Other",
        family_name_slug=f"o-{uuid.uuid4().hex[:6]}", shield_config={},
        home_languages=[], education_methods=[], current_curriculum=[],
    )
    db.add(other)
    await db.flush()
    other_sub = await make_subject(other.id)
    foreign = Lesson(
        family_id=other.id, subject_id=other_sub.id,
        title="Foreign", scheduled_for=date.today(), status="draft",
    )
    db.add(foreign)
    await db.commit()
    resp = await client.post(
        f"/api/v1/lessons/{foreign.id}/blocks",
        json={"type": "text", "content": {"html": "<p>x</p>"}},
    )
    assert resp.status_code == 404


# ── Duplicate ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_duplicate_lesson_copies_blocks_and_metadata(
    authed_with_family, make_subject
):
    client, _, family = authed_with_family
    sub = await make_subject(family.id)
    created = await client.post(
        "/api/v1/lessons",
        json=_payload(sub.id, title="Origin", estimated_duration_minutes=30),
    )
    lid = created.json()["id"]
    await client.post(f"/api/v1/lessons/{lid}/blocks", json={
        "type": "text", "content": {"html": "<p>Hello</p>"},
    })
    new_date = (date.today() + timedelta(days=7)).isoformat()
    resp = await client.post(
        f"/api/v1/lessons/{lid}/duplicate",
        json={"scheduled_for": new_date},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"] != lid
    assert body["title"] == "Origin"
    assert body["scheduled_for"] == new_date
    assert body["estimated_duration_minutes"] == 30
    assert body["status"] == "draft"
    assert len(body["blocks"]) == 1
    assert body["blocks"][0]["type"] == "text"


# ── Link preview ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_link_preview_invalid_scheme_422(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.get("/api/v1/lessons/link-preview?url=ftp://example.com")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_link_preview_returns_empty_on_fetch_error(
    authed_with_family, monkeypatch
):
    """On any fetch failure, link-preview returns 200 with empty fields."""
    client, _, _ = authed_with_family

    class _FailingClient:
        def __init__(self, *a, **kw):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, *a, **kw):
            raise RuntimeError("fetch failed")

    import app.services.lesson_service as svc_mod

    class _Fake:
        AsyncClient = _FailingClient

    monkeypatch.setitem(__import__('sys').modules, 'httpx', _Fake)

    resp = await client.get(
        "/api/v1/lessons/link-preview?url=https://example.com"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["url"] == "https://example.com"
    assert body["title"] is None


@pytest.mark.asyncio
async def test_link_preview_extracts_title(
    authed_with_family, monkeypatch
):
    client, _, _ = authed_with_family

    class _OkResp:
        status_code = 200
        text = "<html><head><title>Hello World</title></head></html>"

    class _OkClient:
        def __init__(self, *a, **kw):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, *a, **kw):
            return _OkResp()

    class _Fake:
        AsyncClient = _OkClient

    monkeypatch.setitem(__import__('sys').modules, 'httpx', _Fake)

    resp = await client.get(
        "/api/v1/lessons/link-preview?url=https://example.com"
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Hello World"
