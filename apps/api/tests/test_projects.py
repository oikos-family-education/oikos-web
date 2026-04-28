"""Tests for /projects router and ProjectService."""
import uuid
from datetime import date, timedelta
import pytest


# ── Auth gate ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_project_requires_family(authed_client):
    client, _ = authed_client
    resp = await client.post("/api/v1/projects", json={
        "title": "X", "child_ids": [str(uuid.uuid4())],
    })
    assert resp.status_code == 400


# ── Create / read ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_project_with_default_milestones(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    resp = await client.post("/api/v1/projects", json={
        "title": "Build a Birdhouse",
        "child_ids": [str(child.id)],
    })
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "Build a Birdhouse"
    assert body["status"] == "draft"
    assert len(body["milestones"]) == 6  # default milestones


@pytest.mark.asyncio
async def test_create_project_with_subjects_and_milestones(authed_with_family, make_child, make_subject):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    sub = await make_subject(family.id, name="Science")

    resp = await client.post("/api/v1/projects", json={
        "title": "Science Fair",
        "child_ids": [str(child.id)],
        "subject_ids": [str(sub.id)],
        "milestones": [
            {"title": "Hypothesis", "sort_order": 0},
            {"title": "Experiment", "sort_order": 1},
        ],
    })
    assert resp.status_code == 201
    body = resp.json()
    assert len(body["milestones"]) == 2
    assert len(body["subjects"]) == 1


@pytest.mark.asyncio
async def test_create_project_too_many_subjects_422(authed_with_family, make_child, make_subject):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    s1 = await make_subject(family.id, name="A")
    s2 = await make_subject(family.id, name="B")
    s3 = await make_subject(family.id, name="C")

    resp = await client.post("/api/v1/projects", json={
        "title": "X",
        "child_ids": [str(child.id)],
        "subject_ids": [str(s1.id), str(s2.id), str(s3.id)],
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_project_no_children_422(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/projects", json={"title": "X", "child_ids": []})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_project_404(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.get(f"/api/v1/projects/{uuid.uuid4()}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_projects(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    await client.post("/api/v1/projects", json={"title": "P1", "child_ids": [str(child.id)]})
    await client.post("/api/v1/projects", json={"title": "P2", "child_ids": [str(child.id)]})
    resp = await client.get("/api/v1/projects")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_list_projects_filter_status(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    await client.post("/api/v1/projects", json={"title": "Draft", "child_ids": [str(child.id)]})
    await client.post("/api/v1/projects", json={"title": "Active", "status": "active", "child_ids": [str(child.id)]})
    resp = await client.get("/api/v1/projects?status=active")
    assert resp.status_code == 200
    titles = [p["title"] for p in resp.json()]
    assert titles == ["Active"]


# ── Update ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_project_title(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    r = await client.post("/api/v1/projects", json={"title": "Old", "child_ids": [str(child.id)]})
    pid = r.json()["id"]
    resp = await client.patch(f"/api/v1/projects/{pid}", json={"title": "New"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "New"


@pytest.mark.asyncio
async def test_update_project_reassign_children(authed_with_family, make_child):
    client, _, family = authed_with_family
    a = await make_child(family.id, first_name="A")
    b = await make_child(family.id, first_name="B")
    r = await client.post("/api/v1/projects", json={"title": "X", "child_ids": [str(a.id)]})
    pid = r.json()["id"]
    resp = await client.patch(f"/api/v1/projects/{pid}", json={"child_ids": [str(b.id)]})
    assert resp.status_code == 200
    child_ids = [c["child_id"] for c in resp.json()["children"]]
    assert child_ids == [str(b.id)]


# ── Complete ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_complete_project_creates_achievement_and_portfolio(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    r = await client.post("/api/v1/projects", json={"title": "X", "child_ids": [str(child.id)]})
    pid = r.json()["id"]

    r2 = await client.post(f"/api/v1/projects/{pid}/complete")
    assert r2.status_code == 200
    assert r2.json()["status"] == "complete"
    assert r2.json()["completed_at"] is not None

    # Achievement is generated.
    achs = await client.get("/api/v1/projects/achievements")
    assert achs.status_code == 200
    assert len(achs.json()) == 1
    assert achs.json()[0]["certificate_number"].startswith("OIK-")


# ── Archive ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_archive_project(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    r = await client.post("/api/v1/projects", json={"title": "X", "child_ids": [str(child.id)]})
    pid = r.json()["id"]
    resp = await client.post(f"/api/v1/projects/{pid}/archive")
    assert resp.status_code == 200
    assert resp.json()["status"] == "archived"


@pytest.mark.asyncio
async def test_archived_projects_excluded_from_list(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    r = await client.post("/api/v1/projects", json={"title": "X", "child_ids": [str(child.id)]})
    pid = r.json()["id"]
    await client.post(f"/api/v1/projects/{pid}/archive")
    resp = await client.get("/api/v1/projects")
    assert resp.status_code == 200
    assert resp.json() == []


# ── Milestones ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_add_milestone(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    r = await client.post("/api/v1/projects", json={
        "title": "X",
        "child_ids": [str(child.id)],
        "milestones": [],
    })
    pid = r.json()["id"]
    resp = await client.post(
        f"/api/v1/projects/{pid}/milestones",
        json={"title": "Step 1", "sort_order": 0},
    )
    assert resp.status_code == 201
    assert resp.json()["title"] == "Step 1"


@pytest.mark.asyncio
async def test_toggle_milestone_completion(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    r = await client.post("/api/v1/projects", json={"title": "X", "child_ids": [str(child.id)]})
    project = r.json()
    milestone_id = project["milestones"][0]["id"]

    r1 = await client.post(f"/api/v1/projects/milestones/{milestone_id}/toggle/{child.id}")
    assert r1.status_code == 200
    assert r1.json()["completed"] is True

    r2 = await client.post(f"/api/v1/projects/milestones/{milestone_id}/toggle/{child.id}")
    assert r2.status_code == 200
    assert r2.json()["completed"] is False


@pytest.mark.asyncio
async def test_delete_milestone(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    r = await client.post("/api/v1/projects", json={"title": "X", "child_ids": [str(child.id)]})
    milestone_id = r.json()["milestones"][0]["id"]
    resp = await client.delete(f"/api/v1/projects/milestones/{milestone_id}")
    assert resp.status_code == 204


# ── Reorder ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_reorder_milestones(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    r = await client.post("/api/v1/projects", json={
        "title": "X",
        "child_ids": [str(child.id)],
        "milestones": [
            {"title": "A", "sort_order": 0},
            {"title": "B", "sort_order": 1},
            {"title": "C", "sort_order": 2},
        ],
    })
    pid = r.json()["id"]
    ids = [m["id"] for m in r.json()["milestones"]]
    reordered = [ids[2], ids[0], ids[1]]

    resp = await client.put(f"/api/v1/projects/{pid}/milestones/reorder", json=reordered)
    assert resp.status_code == 200
    out = resp.json()
    assert out[0]["id"] == ids[2]
    assert out[1]["id"] == ids[0]
    assert out[2]["id"] == ids[1]


# ── Certificate ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_certificate_only_for_completed(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    r = await client.post("/api/v1/projects", json={"title": "X", "child_ids": [str(child.id)]})
    pid = r.json()["id"]

    resp = await client.get(f"/api/v1/projects/{pid}/certificate/{child.id}")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_certificate_for_completed_returns_data(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    r = await client.post("/api/v1/projects", json={"title": "Magnum Opus", "child_ids": [str(child.id)]})
    pid = r.json()["id"]
    await client.post(f"/api/v1/projects/{pid}/complete")

    resp = await client.get(f"/api/v1/projects/{pid}/certificate/{child.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["project_title"] == "Magnum Opus"
    assert data["child_name"] == "A"
    assert data["certificate_number"].startswith("OIK-")


# ── Acknowledge achievement ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_acknowledge_achievement(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    r = await client.post("/api/v1/projects", json={"title": "X", "child_ids": [str(child.id)]})
    pid = r.json()["id"]
    await client.post(f"/api/v1/projects/{pid}/complete")

    achs = await client.get(f"/api/v1/projects/achievements/child/{child.id}")
    assert achs.status_code == 200
    aid = achs.json()[0]["id"]

    resp = await client.post(f"/api/v1/projects/achievements/{aid}/acknowledge")
    assert resp.status_code == 200
    assert resp.json()["acknowledged_at"] is not None


# ── Get project ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_project_success(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    r = await client.post("/api/v1/projects", json={"title": "My Project", "child_ids": [str(child.id)]})
    pid = r.json()["id"]
    resp = await client.get(f"/api/v1/projects/{pid}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "My Project"
    assert len(resp.json()["milestones"]) == 6


# ── Delete project ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_project(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    r = await client.post("/api/v1/projects", json={"title": "Delete Me", "child_ids": [str(child.id)]})
    pid = r.json()["id"]
    resp = await client.delete(f"/api/v1/projects/{pid}")
    assert resp.status_code == 204
    assert (await client.get(f"/api/v1/projects/{pid}")).status_code == 404


@pytest.mark.asyncio
async def test_delete_project_404(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.delete(f"/api/v1/projects/{uuid.uuid4()}")
    assert resp.status_code == 404


# ── List filter: child_id / subject_id ──────────────────────────────────────

@pytest.mark.asyncio
async def test_list_projects_filter_by_child(authed_with_family, make_child):
    client, _, family = authed_with_family
    a = await make_child(family.id, first_name="A")
    b = await make_child(family.id, first_name="B")
    await client.post("/api/v1/projects", json={"title": "For A", "child_ids": [str(a.id)]})
    await client.post("/api/v1/projects", json={"title": "For B", "child_ids": [str(b.id)]})

    resp = await client.get(f"/api/v1/projects?child_id={a.id}")
    assert resp.status_code == 200
    titles = [p["title"] for p in resp.json()]
    assert titles == ["For A"]


@pytest.mark.asyncio
async def test_list_projects_filter_by_subject(authed_with_family, make_child, make_subject):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    science = await make_subject(family.id, name="Science")
    history = await make_subject(family.id, name="History")
    await client.post("/api/v1/projects", json={"title": "Science Fair", "child_ids": [str(child.id)], "subject_ids": [str(science.id)]})
    await client.post("/api/v1/projects", json={"title": "History Paper", "child_ids": [str(child.id)], "subject_ids": [str(history.id)]})

    resp = await client.get(f"/api/v1/projects?subject_id={science.id}")
    assert resp.status_code == 200
    titles = [p["title"] for p in resp.json()]
    assert titles == ["Science Fair"]


# ── Update milestone ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_milestone_title_and_due_date(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    r = await client.post("/api/v1/projects", json={"title": "X", "child_ids": [str(child.id)]})
    milestone_id = r.json()["milestones"][0]["id"]
    due = str(date.today() + timedelta(days=7))

    resp = await client.patch(
        f"/api/v1/projects/milestones/{milestone_id}",
        json={"title": "Renamed Step", "due_date": due},
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Renamed Step"
    assert resp.json()["due_date"] == due


@pytest.mark.asyncio
async def test_update_milestone_404(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.patch(
        f"/api/v1/projects/milestones/{uuid.uuid4()}",
        json={"title": "Ghost"},
    )
    assert resp.status_code == 404


# ── Project resources ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_link_and_list_project_resource(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    r_proj = await client.post("/api/v1/projects", json={"title": "X", "child_ids": [str(child.id)]})
    pid = r_proj.json()["id"]

    r_res = await client.post("/api/v1/resources", json={"title": "Khan Academy", "type": "website"})
    rid = r_res.json()["id"]

    link = await client.post(f"/api/v1/projects/{pid}/resources", json={"resource_id": rid})
    assert link.status_code == 201

    listed = await client.get(f"/api/v1/projects/{pid}/resources")
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["resource_id"] == rid


@pytest.mark.asyncio
async def test_unlink_project_resource(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    r_proj = await client.post("/api/v1/projects", json={"title": "X", "child_ids": [str(child.id)]})
    pid = r_proj.json()["id"]

    r_res = await client.post("/api/v1/resources", json={"title": "YouTube", "type": "video"})
    rid = r_res.json()["id"]
    await client.post(f"/api/v1/projects/{pid}/resources", json={"resource_id": rid})

    resp = await client.delete(f"/api/v1/projects/{pid}/resources/{rid}")
    assert resp.status_code == 204
    assert len((await client.get(f"/api/v1/projects/{pid}/resources")).json()) == 0


# ── Portfolio ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_portfolio_entries_after_completion(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    r = await client.post("/api/v1/projects", json={"title": "Portfolio Project", "child_ids": [str(child.id)]})
    pid = r.json()["id"]
    await client.post(f"/api/v1/projects/{pid}/complete")

    listed = await client.get(f"/api/v1/projects/{pid}/portfolio")
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["title"] == "Portfolio Project"


@pytest.mark.asyncio
async def test_child_portfolio(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    r = await client.post("/api/v1/projects", json={"title": "P1", "child_ids": [str(child.id)]})
    pid = r.json()["id"]
    await client.post(f"/api/v1/projects/{pid}/complete")

    resp = await client.get(f"/api/v1/projects/portfolio/child/{child.id}")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.asyncio
async def test_update_portfolio_entry(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    r = await client.post("/api/v1/projects", json={"title": "P1", "child_ids": [str(child.id)]})
    pid = r.json()["id"]
    await client.post(f"/api/v1/projects/{pid}/complete")

    entries = (await client.get(f"/api/v1/projects/{pid}/portfolio")).json()
    eid = entries[0]["id"]

    resp = await client.patch(f"/api/v1/projects/portfolio/{eid}", json={"reflection": "Great work!"})
    assert resp.status_code == 200
    assert resp.json()["reflection"] == "Great work!"


# ── Cross-family isolation ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cannot_access_other_family_project(authed_with_family, make_user, make_child, fresh_session):
    client, _, _ = authed_with_family
    other = await make_user(email="other2@example.com")

    s = await fresh_session()
    from app.models.family import Family
    other_family = Family(
        account_id=other.id,
        family_name="Other",
        family_name_slug=f"other-{uuid.uuid4().hex[:6]}",
        shield_config={},
        home_languages=["en"],
    )
    s.add(other_family)
    await s.commit()
    await s.refresh(other_family)

    other_child = await make_child(other_family.id, first_name="Foreign")
    from app.models.project import Project
    import uuid as _uuid
    proj = Project(
        family_id=other_family.id,
        title="Secret Project",
        status="draft",
    )
    s.add(proj)
    await s.commit()
    await s.refresh(proj)
    await s.close()

    resp = await client.get(f"/api/v1/projects/{proj.id}")
    assert resp.status_code == 404


# ── Dashboard: achievements listing (used by RecentCertificates widget) ──────

@pytest.mark.asyncio
async def test_achievements_limit_param(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    for i in range(5):
        r = await client.post("/api/v1/projects", json={"title": f"P{i}", "child_ids": [str(child.id)]})
        await client.post(f"/api/v1/projects/{r.json()['id']}/complete")

    resp = await client.get("/api/v1/projects/achievements?limit=3")
    assert resp.status_code == 200
    assert len(resp.json()) == 3
