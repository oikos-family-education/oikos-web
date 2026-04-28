"""Tests for /resources router and ResourceService."""
import uuid
import pytest


def _payload(title="The Phoenix Project", **overrides):
    base = {"title": title, "type": "book", "author": "Gene Kim"}
    base.update(overrides)
    return base


# ── Auth gate ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_resource_requires_family(authed_client):
    client, _ = authed_client
    resp = await client.post("/api/v1/resources", json=_payload())
    assert resp.status_code == 400


# ── Create / read ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_resource(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/resources", json=_payload())
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "The Phoenix Project"
    assert body["type"] == "book"
    assert body["subjects"] == []


@pytest.mark.asyncio
async def test_create_resource_invalid_type_422(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/resources", json=_payload(type="bogus_type"))
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_resource_with_subject_links(authed_with_family, make_subject):
    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="Tech")
    resp = await client.post("/api/v1/resources", json=_payload(subject_ids=[str(sub.id)]))
    assert resp.status_code == 201
    body = resp.json()
    assert len(body["subjects"]) == 1
    assert body["subjects"][0]["subject_name"] == "Tech"


@pytest.mark.asyncio
async def test_list_resources(authed_with_family):
    client, _, _ = authed_with_family
    await client.post("/api/v1/resources", json=_payload(title="A"))
    await client.post("/api/v1/resources", json=_payload(title="B"))
    resp = await client.get("/api/v1/resources")
    assert resp.status_code == 200
    titles = sorted(r["title"] for r in resp.json())
    assert titles == ["A", "B"]


@pytest.mark.asyncio
async def test_list_resources_search(authed_with_family):
    client, _, _ = authed_with_family
    await client.post("/api/v1/resources", json=_payload(title="Alpha Book"))
    await client.post("/api/v1/resources", json=_payload(title="Beta Book"))
    resp = await client.get("/api/v1/resources?search=alpha")
    assert resp.status_code == 200
    titles = [r["title"] for r in resp.json()]
    assert titles == ["Alpha Book"]


@pytest.mark.asyncio
async def test_list_resources_filter_by_subject(authed_with_family, make_subject):
    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="Math")
    await client.post("/api/v1/resources", json=_payload(title="Linked", subject_ids=[str(sub.id)]))
    await client.post("/api/v1/resources", json=_payload(title="Unlinked"))

    resp = await client.get(f"/api/v1/resources?subject_id={sub.id}")
    assert resp.status_code == 200
    titles = [r["title"] for r in resp.json()]
    assert titles == ["Linked"]


@pytest.mark.asyncio
async def test_get_resource_404(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.get(f"/api/v1/resources/{uuid.uuid4()}")
    assert resp.status_code == 404


# ── Update ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_resource(authed_with_family):
    client, _, _ = authed_with_family
    r = await client.post("/api/v1/resources", json=_payload(title="Old"))
    rid = r.json()["id"]
    resp = await client.patch(f"/api/v1/resources/{rid}", json={"title": "New", "type": "video"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "New"
    assert body["type"] == "video"


@pytest.mark.asyncio
async def test_update_resource_replaces_subject_links(authed_with_family, make_subject):
    client, _, family = authed_with_family
    s1 = await make_subject(family.id, name="A")
    s2 = await make_subject(family.id, name="B")
    r = await client.post("/api/v1/resources", json=_payload(subject_ids=[str(s1.id)]))
    rid = r.json()["id"]

    resp = await client.patch(f"/api/v1/resources/{rid}", json={"subject_ids": [str(s2.id)]})
    assert resp.status_code == 200
    names = [s["subject_name"] for s in resp.json()["subjects"]]
    assert names == ["B"]


# ── Delete ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_resource(authed_with_family):
    client, _, _ = authed_with_family
    r = await client.post("/api/v1/resources", json=_payload())
    rid = r.json()["id"]
    resp = await client.delete(f"/api/v1/resources/{rid}")
    assert resp.status_code == 204


# ── Subject linking ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_add_resource_to_subject(authed_with_family, make_subject):
    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="Math")
    r = await client.post("/api/v1/resources", json=_payload())
    rid = r.json()["id"]

    resp = await client.post(f"/api/v1/resources/{rid}/subjects/{sub.id}")
    assert resp.status_code == 201

    detail = await client.get(f"/api/v1/resources/{rid}")
    assert any(s["subject_name"] == "Math" for s in detail.json()["subjects"])


@pytest.mark.asyncio
async def test_add_resource_to_subject_duplicate_409(authed_with_family, make_subject):
    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="Math")
    r = await client.post("/api/v1/resources", json=_payload(subject_ids=[str(sub.id)]))
    rid = r.json()["id"]

    resp = await client.post(f"/api/v1/resources/{rid}/subjects/{sub.id}")
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_update_progress_notes(authed_with_family, make_subject):
    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="Math")
    r = await client.post("/api/v1/resources", json=_payload(subject_ids=[str(sub.id)]))
    rid = r.json()["id"]

    resp = await client.patch(
        f"/api/v1/resources/{rid}/subjects/{sub.id}/progress",
        json={"progress_notes": "Halfway through chapter 3"},
    )
    assert resp.status_code == 200
    assert resp.json()["progress_notes"] == "Halfway through chapter 3"


@pytest.mark.asyncio
async def test_remove_resource_from_subject(authed_with_family, make_subject):
    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="Math")
    r = await client.post("/api/v1/resources", json=_payload(subject_ids=[str(sub.id)]))
    rid = r.json()["id"]

    resp = await client.delete(f"/api/v1/resources/{rid}/subjects/{sub.id}")
    assert resp.status_code == 204

    detail = await client.get(f"/api/v1/resources/{rid}")
    assert detail.json()["subjects"] == []


# ── Filter by type ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_resources_filter_by_type(authed_with_family):
    client, _, _ = authed_with_family
    await client.post("/api/v1/resources", json={"title": "Book One", "type": "book"})
    await client.post("/api/v1/resources", json={"title": "Video One", "type": "video"})
    await client.post("/api/v1/resources", json={"title": "Book Two", "type": "book"})

    resp = await client.get("/api/v1/resources?type=book")
    assert resp.status_code == 200
    titles = sorted(r["title"] for r in resp.json())
    assert titles == ["Book One", "Book Two"]


# ── List resources for a subject ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_resources_for_subject(authed_with_family, make_subject):
    client, _, family = authed_with_family
    sub = await make_subject(family.id, name="History")
    other = await make_subject(family.id, name="Art")

    r1 = await client.post("/api/v1/resources", json={"title": "History Book", "type": "book", "subject_ids": [str(sub.id)]})
    await client.post("/api/v1/resources", json={"title": "Art Video", "type": "video", "subject_ids": [str(other.id)]})

    resp = await client.get(f"/api/v1/resources/subject/{sub.id}")
    assert resp.status_code == 200
    titles = [r["title"] for r in resp.json()]
    assert titles == ["History Book"]
