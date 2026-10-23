"""Tests for /children/{child_id}/highlights and /children/{child_id}/report."""
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest

from app.models.child import Child
from app.models.curriculum import ChildCurriculum, Curriculum, CurriculumSubject
from app.models.family import Family
from app.models.note import Note
from app.models.project import (
    MilestoneCompletion,
    PortfolioEntry,
    Project,
    ProjectChild,
    ProjectMilestone,
    ProjectSubject,
)
from app.models.resource import Resource, SubjectResource
from app.models.teaching_log import TeachingLog
from app.models.week_planner import RoutineEntry, WeekTemplate


def _highlight(**overrides):
    base = {"category": "book", "title": "Charlotte's Web", "occurred_on": "2026-03-10"}
    base.update(overrides)
    return base


# ── Highlights ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_highlight_crud(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id)
    base = f"/api/v1/children/{child.id}/highlights"

    resp = await client.post(base, json=_highlight(description="Read aloud together"))
    assert resp.status_code == 201
    hid = resp.json()["id"]
    assert resp.json()["category"] == "book"

    resp = await client.patch(f"{base}/{hid}", json={"title": "  The Hobbit  ", "category": "other"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "The Hobbit"
    assert resp.json()["category"] == "other"

    assert len((await client.get(base)).json()) == 1

    resp = await client.delete(f"{base}/{hid}")
    assert resp.status_code == 204
    assert (await client.get(base)).json() == []


@pytest.mark.asyncio
async def test_highlight_validation(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id)
    base = f"/api/v1/children/{child.id}/highlights"
    assert (await client.post(base, json=_highlight(category="sports"))).status_code == 422
    assert (await client.post(base, json=_highlight(title="   "))).status_code == 422


@pytest.mark.asyncio
async def test_highlight_date_is_optional(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id)
    base = f"/api/v1/children/{child.id}/highlights"

    resp = await client.post(base, json={"category": "social", "title": "Weekly co-op"})
    assert resp.status_code == 201
    assert resp.json()["occurred_on"] is None

    # A dated highlight can be made undated again
    hid = (await client.post(base, json=_highlight())).json()["id"]
    resp = await client.patch(f"{base}/{hid}", json={"occurred_on": None})
    assert resp.json()["occurred_on"] is None


@pytest.mark.asyncio
async def test_undated_highlights_count_from_when_recorded(authed_with_family, make_child, db):
    from app.models.child_highlight import ChildHighlight

    client, _, family = authed_with_family
    child = await make_child(family.id)
    db.add_all([
        ChildHighlight(family_id=family.id, child_id=child.id, category="social", title="This year's co-op",
                       created_at=datetime(2026, 3, 1, tzinfo=timezone.utc)),
        ChildHighlight(family_id=family.id, child_id=child.id, category="social", title="Last year's co-op",
                       created_at=datetime(2025, 3, 1, tzinfo=timezone.utc)),
    ])
    await db.commit()

    resp = await client.get(f"/api/v1/children/{child.id}/highlights?from=2026-01-01&to=2026-12-31")
    assert [h["title"] for h in resp.json()] == ["This year's co-op"]


@pytest.mark.asyncio
async def test_highlights_filtered_by_date(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id)
    base = f"/api/v1/children/{child.id}/highlights"
    await client.post(base, json=_highlight(title="Old", occurred_on="2025-01-01"))
    await client.post(base, json=_highlight(title="New", occurred_on="2026-05-01"))

    resp = await client.get(f"{base}?from=2026-01-01&to=2026-12-31")
    assert [h["title"] for h in resp.json()] == ["New"]


@pytest.mark.asyncio
async def test_cannot_touch_other_familys_child(authed_with_family, make_user, fresh_session):
    client, _, _ = authed_with_family
    other_user = await make_user()
    s = await fresh_session()
    other_family = Family(
        account_id=other_user.id,
        family_name="Other",
        family_name_slug=f"other-{uuid.uuid4().hex[:6]}",
        shield_config={},
        home_languages=["en"],
    )
    s.add(other_family)
    await s.flush()
    other_child = Child(family_id=other_family.id, first_name="Zed")
    s.add(other_child)
    await s.commit()

    assert (await client.get(f"/api/v1/children/{other_child.id}/highlights")).status_code == 404
    assert (await client.post(f"/api/v1/children/{other_child.id}/highlights", json=_highlight())).status_code == 404
    assert (await client.get(f"/api/v1/children/{other_child.id}/report")).status_code == 404


# ── Report ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_report_without_curriculum_defaults_to_last_90_days(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="Alice", nickname="Ali")

    resp = await client.get(f"/api/v1/children/{child.id}/report")
    assert resp.status_code == 200
    body = resp.json()
    assert body["child"]["nickname"] == "Ali"
    assert body["family"]["family_name"] == family.family_name
    assert body["curriculums"] == []
    assert body["routine"] is None
    assert body["range"]["to_date"] == date.today().isoformat()
    assert body["range"]["from_date"] == (date.today() - timedelta(days=90)).isoformat()
    assert "streak" not in resp.text


@pytest.mark.asyncio
async def test_report_rejects_inverted_range(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id)
    resp = await client.get(f"/api/v1/children/{child.id}/report?from=2026-05-01&to=2026-01-01")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_full_report(authed_with_family, make_child, make_subject, db):
    client, user, family = authed_with_family
    alice = await make_child(family.id, first_name="Alice", learning_styles=["visual"])
    bob = await make_child(family.id, first_name="Bob")

    # Taught by the other parent (listed without a login)
    pid = (await client.post(
        "/api/v1/families/me/members/profiles", json={"first_name": "Pedro"}
    )).json()["id"]
    math = await make_subject(
        family.id, name="Math", short_description="Numbers", responsible_member_id=uuid.UUID(pid)
    )
    art = await make_subject(family.id, name="Art")

    curriculum = Curriculum(
        family_id=family.id, name="Year 3", period_type="annual",
        start_date=date(2026, 1, 1), end_date=date(2026, 12, 31), status="active",
        overall_goals=["Read fluently"],
    )
    old = Curriculum(
        family_id=family.id, name="Year 2", period_type="annual",
        start_date=date(2025, 1, 1), end_date=date(2025, 12, 31), status="completed",
    )
    db.add_all([curriculum, old])
    await db.flush()
    db.add_all([
        ChildCurriculum(child_id=alice.id, curriculum_id=curriculum.id),
        ChildCurriculum(child_id=alice.id, curriculum_id=old.id),
        CurriculumSubject(curriculum_id=curriculum.id, subject_id=math.id, weekly_frequency=4,
                          goals_for_period=["Times tables"]),
        CurriculumSubject(curriculum_id=old.id, subject_id=art.id),
    ])

    book = Resource(family_id=family.id, title="Singapore Math 3A", type="book", author="Marshall")
    db.add(book)
    await db.flush()
    db.add(SubjectResource(subject_id=math.id, resource_id=book.id, progress_notes="Chapter 4"))

    project = Project(family_id=family.id, title="Bird study", status="complete",
                      completed_at=datetime(2026, 4, 1, tzinfo=timezone.utc))
    draft = Project(family_id=family.id, title="Draft idea", status="draft")
    bobs = Project(family_id=family.id, title="Bob's project", status="active")
    db.add_all([project, draft, bobs])
    await db.flush()
    milestone_a = ProjectMilestone(project_id=project.id, title="Observe", sort_order=0)
    milestone_b = ProjectMilestone(project_id=project.id, title="Draw", sort_order=1)
    db.add_all([
        ProjectChild(project_id=project.id, child_id=alice.id),
        ProjectChild(project_id=draft.id, child_id=alice.id),
        ProjectChild(project_id=bobs.id, child_id=bob.id),
        ProjectSubject(project_id=project.id, subject_id=art.id),
        milestone_a, milestone_b,
    ])
    await db.flush()
    db.add_all([
        MilestoneCompletion(milestone_id=milestone_a.id, child_id=alice.id),
        PortfolioEntry(project_id=project.id, child_id=alice.id, title="My bird book", score=9),
    ])

    template = WeekTemplate(family_id=family.id, name="Term 1", is_active=True)
    db.add(template)
    await db.flush()
    db.add_all([
        RoutineEntry(template_id=template.id, family_id=family.id, subject_id=math.id,
                     child_ids=[alice.id], day_of_week=0, start_minute=540, duration_minutes=45),
        RoutineEntry(template_id=template.id, family_id=family.id, subject_id=art.id,
                     child_ids=[bob.id], day_of_week=0, start_minute=600, duration_minutes=45),
    ])

    db.add_all([
        Note(family_id=family.id, content="Loves fractions", entity_type="child", entity_id=alice.id,
             created_at=datetime(2026, 2, 1, tzinfo=timezone.utc)),
        Note(family_id=family.id, content="Old note", entity_type="child", entity_id=alice.id,
             created_at=datetime(2024, 2, 1, tzinfo=timezone.utc)),
        Note(family_id=family.id, content="Pinned allergy note", entity_type="child", entity_id=alice.id,
             is_pinned=True, created_at=datetime(2024, 2, 1, tzinfo=timezone.utc)),
        Note(family_id=family.id, content="Archived", entity_type="child", entity_id=alice.id,
             status="archived", created_at=datetime(2026, 2, 1, tzinfo=timezone.utc)),
        Note(family_id=family.id, content="About Bob", entity_type="child", entity_id=bob.id,
             created_at=datetime(2026, 2, 1, tzinfo=timezone.utc)),
    ])

    db.add_all([
        TeachingLog(family_id=family.id, child_id=alice.id, subject_id=math.id, taught_on=date(2026, 3, 2),
                    minutes=40, logged_by_user_id=user.id),
        TeachingLog(family_id=family.id, child_id=alice.id, subject_id=math.id, taught_on=date(2026, 3, 3),
                    minutes=30, logged_by_user_id=user.id),
        TeachingLog(family_id=family.id, child_id=bob.id, subject_id=math.id, taught_on=date(2026, 3, 3),
                    minutes=30, logged_by_user_id=user.id),
    ])
    await db.commit()

    await client.post(f"/api/v1/children/{alice.id}/highlights",
                      json=_highlight(category="outdoor", title="Hike", occurred_on="2026-06-01"))
    await client.post(f"/api/v1/children/{alice.id}/highlights",
                      json=_highlight(title="Last year's book", occurred_on="2025-06-01"))

    resp = await client.get(f"/api/v1/children/{alice.id}/report")
    assert resp.status_code == 200
    body = resp.json()

    # Defaults to the active curriculum's period
    assert body["range"] == {"from_date": "2026-01-01", "to_date": "2026-12-31"}
    assert body["child"]["learning_styles"] == ["visual"]

    # Only the active curriculum, with full subject details
    assert [c["name"] for c in body["curriculums"]] == ["Year 3"]
    [subject] = body["curriculums"][0]["subjects"]
    assert subject["name"] == "Math"
    assert subject["short_description"] == "Numbers"
    assert subject["taught_by"] == "Pedro"
    assert subject["weekly_frequency"] == 4
    assert subject["goals_for_period"] == ["Times tables"]
    assert subject["resources"][0]["title"] == "Singapore Math 3A"
    assert subject["resources"][0]["progress_notes"] == "Chapter 4"
    assert subject["sessions_logged"] == 2
    assert subject["minutes_logged"] == 70

    # Only Alice's non-draft projects
    [proj] = body["projects"]
    assert proj["title"] == "Bird study"
    assert proj["subject_names"] == ["Art"]
    assert proj["milestones_total"] == 2
    assert proj["milestones_completed"] == 1
    assert proj["portfolio"]["score"] == 9

    # Only Alice's routine entries
    assert body["routine"]["template_name"] == "Term 1"
    assert [e["subject_name"] for e in body["routine"]["entries"]] == ["Math"]

    # Pinned notes always, others only from the period; archived and other children's never
    assert [n["content"] for n in body["notes"]] == ["Pinned allergy note", "Loves fractions"]

    assert [h["title"] for h in body["highlights"]] == ["Hike"]
    assert body["learning_summary"] == {"total_sessions": 2, "total_minutes": 70, "days_with_sessions": 2}
