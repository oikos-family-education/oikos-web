"""Tests for /notes router and NoteService."""
import uuid
from datetime import date, timedelta
import pytest


# ── Auth gate ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_note_requires_family(authed_client):
    client, _ = authed_client
    resp = await client.post("/api/v1/notes", json={"content": "x"})
    assert resp.status_code == 400


# ── Create / list ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_note_minimal(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/notes", json={"content": "Plain note"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["content"] == "Plain note"
    assert body["status"] == "draft"
    assert body["is_pinned"] is False


@pytest.mark.asyncio
async def test_create_note_with_tags_and_pin(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/notes", json={
        "content": "Pinned",
        "title": "Important",
        "status": "todo",
        "is_pinned": True,
        "tags": ["urgent", "math"],
        "due_date": str(date.today() + timedelta(days=2)),
    })
    assert resp.status_code == 201
    body = resp.json()
    assert body["is_pinned"] is True
    assert sorted(body["tags"]) == ["math", "urgent"]


@pytest.mark.asyncio
async def test_create_note_invalid_status_422(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/notes", json={"content": "x", "status": "bogus"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_note_with_child_link(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="Anna")
    resp = await client.post("/api/v1/notes", json={
        "content": "About Anna",
        "entity_type": "child",
        "entity_id": str(child.id),
    })
    assert resp.status_code == 201
    assert resp.json()["entity_label"] == "Anna"


@pytest.mark.asyncio
async def test_create_note_unknown_entity_404(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/notes", json={
        "content": "x",
        "entity_type": "child",
        "entity_id": str(uuid.uuid4()),
    })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_note_invalid_entity_type_422(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    resp = await client.post("/api/v1/notes", json={
        "content": "x",
        "entity_type": "spaceship",
        "entity_id": str(child.id),
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_notes_pagination(authed_with_family):
    client, _, _ = authed_with_family
    for i in range(5):
        await client.post("/api/v1/notes", json={"content": f"note-{i}"})
    resp = await client.get("/api/v1/notes?limit=3")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 5
    assert len(body["items"]) == 3


@pytest.mark.asyncio
async def test_list_notes_pinned_first(authed_with_family):
    client, _, _ = authed_with_family
    await client.post("/api/v1/notes", json={"content": "regular"})
    await client.post("/api/v1/notes", json={"content": "pinned", "is_pinned": True})

    resp = await client.get("/api/v1/notes")
    items = resp.json()["items"]
    assert items[0]["content"] == "pinned"


@pytest.mark.asyncio
async def test_list_notes_filter_by_status(authed_with_family):
    client, _, _ = authed_with_family
    await client.post("/api/v1/notes", json={"content": "todo!", "status": "todo"})
    await client.post("/api/v1/notes", json={"content": "done!", "status": "completed"})

    resp = await client.get("/api/v1/notes?status=todo")
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["content"] == "todo!"


@pytest.mark.asyncio
async def test_list_notes_filter_by_tag(authed_with_family):
    client, _, _ = authed_with_family
    await client.post("/api/v1/notes", json={"content": "a", "tags": ["math"]})
    await client.post("/api/v1/notes", json={"content": "b", "tags": ["history"]})

    resp = await client.get("/api/v1/notes?tag=math")
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["content"] == "a"


@pytest.mark.asyncio
async def test_list_notes_search(authed_with_family):
    client, _, _ = authed_with_family
    await client.post("/api/v1/notes", json={"content": "The quick brown fox"})
    await client.post("/api/v1/notes", json={"content": "Lorem ipsum"})

    resp = await client.get("/api/v1/notes?q=brown")
    items = resp.json()["items"]
    assert len(items) == 1


# ── Tags / upcoming-count ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_tags_unique(authed_with_family):
    client, _, _ = authed_with_family
    await client.post("/api/v1/notes", json={"content": "x", "tags": ["a", "b"]})
    await client.post("/api/v1/notes", json={"content": "y", "tags": ["a", "c"]})

    resp = await client.get("/api/v1/notes/tags")
    assert resp.status_code == 200
    assert sorted(resp.json()["tags"]) == ["a", "b", "c"]


@pytest.mark.asyncio
async def test_upcoming_count(authed_with_family):
    client, _, _ = authed_with_family
    await client.post("/api/v1/notes", json={
        "content": "due-soon", "status": "todo",
        "due_date": str(date.today() + timedelta(days=1)),
    })
    await client.post("/api/v1/notes", json={
        "content": "far-out", "status": "todo",
        "due_date": str(date.today() + timedelta(days=30)),
    })
    await client.post("/api/v1/notes", json={
        "content": "no-due", "status": "todo",
    })

    resp = await client.get("/api/v1/notes/upcoming-count")
    assert resp.status_code == 200
    assert resp.json()["count"] == 1


# ── Get / update / delete ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_note(authed_with_family):
    client, _, _ = authed_with_family
    r = await client.post("/api/v1/notes", json={"content": "x"})
    nid = r.json()["id"]
    resp = await client.get(f"/api/v1/notes/{nid}")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_note_404(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.get(f"/api/v1/notes/{uuid.uuid4()}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_note_status(authed_with_family):
    client, _, _ = authed_with_family
    r = await client.post("/api/v1/notes", json={"content": "x", "status": "todo"})
    nid = r.json()["id"]
    resp = await client.patch(f"/api/v1/notes/{nid}", json={"status": "completed"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_delete_note(authed_with_family):
    client, _, _ = authed_with_family
    r = await client.post("/api/v1/notes", json={"content": "x"})
    nid = r.json()["id"]
    resp = await client.delete(f"/api/v1/notes/{nid}")
    assert resp.status_code == 204


# ── Cross-family isolation ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cannot_link_to_other_family_child(authed_with_family, make_user, make_child, fresh_session):
    client, _, _ = authed_with_family
    other = await make_user(email="other@example.com")

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

    foreign_child = await make_child(other_family.id, first_name="Foreign")

    resp = await client.post("/api/v1/notes", json={
        "content": "x",
        "entity_type": "child",
        "entity_id": str(foreign_child.id),
    })
    assert resp.status_code == 404


# ── Update content / pin ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_note_content_and_title(authed_with_family):
    client, _, _ = authed_with_family
    r = await client.post("/api/v1/notes", json={"content": "original", "title": "Old Title"})
    nid = r.json()["id"]

    resp = await client.patch(f"/api/v1/notes/{nid}", json={"content": "updated content", "title": "New Title"})
    assert resp.status_code == 200
    assert resp.json()["content"] == "updated content"
    assert resp.json()["title"] == "New Title"


@pytest.mark.asyncio
async def test_update_note_pin_toggle(authed_with_family):
    client, _, _ = authed_with_family
    r = await client.post("/api/v1/notes", json={"content": "x", "is_pinned": False})
    nid = r.json()["id"]

    resp = await client.patch(f"/api/v1/notes/{nid}", json={"is_pinned": True})
    assert resp.status_code == 200
    assert resp.json()["is_pinned"] is True

    resp2 = await client.patch(f"/api/v1/notes/{nid}", json={"is_pinned": False})
    assert resp2.json()["is_pinned"] is False


@pytest.mark.asyncio
async def test_update_note_tags(authed_with_family):
    client, _, _ = authed_with_family
    r = await client.post("/api/v1/notes", json={"content": "x", "tags": ["old"]})
    nid = r.json()["id"]

    resp = await client.patch(f"/api/v1/notes/{nid}", json={"tags": ["new1", "new2"]})
    assert resp.status_code == 200
    assert sorted(resp.json()["tags"]) == ["new1", "new2"]


# ── Pagination: offset ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_notes_pagination_offset(authed_with_family):
    client, _, _ = authed_with_family
    for i in range(5):
        await client.post("/api/v1/notes", json={"content": f"note-{i}"})

    # First page
    r1 = await client.get("/api/v1/notes?limit=2&offset=0")
    assert r1.status_code == 200
    assert r1.json()["total"] == 5
    assert len(r1.json()["items"]) == 2

    # Second page
    r2 = await client.get("/api/v1/notes?limit=2&offset=2")
    assert len(r2.json()["items"]) == 2

    # Third page (remainder)
    r3 = await client.get("/api/v1/notes?limit=2&offset=4")
    assert len(r3.json()["items"]) == 1

    # Combined pages cover all 5 unique notes
    all_ids = (
        {n["id"] for n in r1.json()["items"]}
        | {n["id"] for n in r2.json()["items"]}
        | {n["id"] for n in r3.json()["items"]}
    )
    assert len(all_ids) == 5


# ── Dashboard: DashboardNotes / DashboardJournal filter by status ──────────

@pytest.mark.asyncio
async def test_list_notes_filter_by_entity_type(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")

    await client.post("/api/v1/notes", json={
        "content": "about child", "entity_type": "child", "entity_id": str(child.id),
    })
    await client.post("/api/v1/notes", json={"content": "general"})

    resp = await client.get("/api/v1/notes?entity_type=child")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["content"] == "about child"
