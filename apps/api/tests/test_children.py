"""Tests for child endpoints under /families/me/children."""
import uuid
import pytest
from sqlalchemy.future import select

from app.models.child import Child


# ── Auth gates ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_add_child_requires_family(authed_client):
    client, _ = authed_client
    resp = await client.post("/api/v1/families/me/children", json={"first_name": "Sam"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_list_children_requires_family(authed_client):
    client, _ = authed_client
    resp = await client.get("/api/v1/families/me/children")
    assert resp.status_code == 404


# ── Create ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_add_child_minimal(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/families/me/children", json={"first_name": "Alice"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["first_name"] == "Alice"
    assert body["family_id"]


@pytest.mark.asyncio
async def test_add_child_full_payload(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/families/me/children", json={
        "first_name": "Beth",
        "nickname": "B",
        "gender": "f",
        "birthdate": "2015-03-12",
        "grade_level": "3",
        "interests": ["reading", "drawing"],
        "personality_tags": ["curious", "energetic"],
    })
    assert resp.status_code == 201
    body = resp.json()
    assert body["nickname"] == "B"
    assert body["interests"] == ["reading", "drawing"]


@pytest.mark.asyncio
async def test_add_child_invalid_birthyear_422(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/families/me/children", json={
        "first_name": "X",
        "birth_year": 1800,
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_add_child_first_name_required_422(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/families/me/children", json={"first_name": ""})
    assert resp.status_code == 422


# ── List / get ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_children_includes_only_active_by_default(authed_with_family, make_child):
    client, _, family = authed_with_family
    await make_child(family.id, first_name="Active")
    archived = await make_child(family.id, first_name="Archived")

    # Archive one via API.
    await client.post(f"/api/v1/families/me/children/{archived.id}/archive")

    resp = await client.get("/api/v1/families/me/children")
    assert resp.status_code == 200
    names = {c["first_name"] for c in resp.json()}
    assert names == {"Active"}


@pytest.mark.asyncio
async def test_list_children_includes_archived_when_requested(authed_with_family, make_child):
    client, _, family = authed_with_family
    await make_child(family.id, first_name="Active")
    archived = await make_child(family.id, first_name="Archived")
    await client.post(f"/api/v1/families/me/children/{archived.id}/archive")

    resp = await client.get("/api/v1/families/me/children?include_archived=true")
    assert resp.status_code == 200
    names = {c["first_name"] for c in resp.json()}
    assert names == {"Active", "Archived"}


@pytest.mark.asyncio
async def test_get_child_404_for_unknown(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.get(f"/api/v1/families/me/children/{uuid.uuid4()}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_child_returns_detail(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="Detail")
    resp = await client.get(f"/api/v1/families/me/children/{child.id}")
    assert resp.status_code == 200
    assert resp.json()["first_name"] == "Detail"


# ── Update ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_child(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="Old")
    resp = await client.patch(
        f"/api/v1/families/me/children/{child.id}",
        json={"first_name": "New", "grade_level": "5"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["first_name"] == "New"
    assert body["grade_level"] == "5"


@pytest.mark.asyncio
async def test_update_child_unknown_404(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.patch(
        f"/api/v1/families/me/children/{uuid.uuid4()}",
        json={"first_name": "X"},
    )
    assert resp.status_code == 404


# ── Archive / unarchive ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_archive_then_unarchive(authed_with_family, make_child, fresh_session):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")

    r1 = await client.post(f"/api/v1/families/me/children/{child.id}/archive")
    assert r1.status_code == 200
    s = await fresh_session()
    refreshed = (await s.execute(select(Child).where(Child.id == child.id))).scalars().first()
    assert refreshed.archived_at is not None

    r2 = await client.post(f"/api/v1/families/me/children/{child.id}/unarchive")
    assert r2.status_code == 200
    s2 = await fresh_session()
    refreshed = (await s2.execute(select(Child).where(Child.id == child.id))).scalars().first()
    assert refreshed.archived_at is None


@pytest.mark.asyncio
async def test_double_archive_400(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    await client.post(f"/api/v1/families/me/children/{child.id}/archive")
    resp = await client.post(f"/api/v1/families/me/children/{child.id}/archive")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_unarchive_active_400(authed_with_family, make_child):
    client, _, family = authed_with_family
    child = await make_child(family.id, first_name="A")
    resp = await client.post(f"/api/v1/families/me/children/{child.id}/unarchive")
    assert resp.status_code == 400


# ── Cross-family isolation ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_other_family_cannot_read_child(authed_with_family, make_user, make_client, make_child, fresh_session):
    """A user from a different family must not be able to read another family's child."""
    _, _, family_a = authed_with_family
    child = await make_child(family_a.id, first_name="A")

    # Build a totally separate family for `other`.
    other = await make_user(email="other@example.com")
    s = await fresh_session()
    from app.models.family import Family
    from app.models.family_member import FamilyMember
    other_family = Family(
        account_id=other.id,
        family_name="Other",
        family_name_slug=f"other-{uuid.uuid4().hex[:6]}",
        shield_config={},
        home_languages=["en"],
    )
    s.add(other_family)
    await s.flush()
    s.add(FamilyMember(family_id=other_family.id, user_id=other.id, role="primary"))
    other.has_family = True
    await s.commit()

    other_client = await make_client(other)
    resp = await other_client.get(f"/api/v1/families/me/children/{child.id}")
    assert resp.status_code == 404
