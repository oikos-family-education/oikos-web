"""Tests for /subjects router and SubjectService."""
import uuid
import pytest
from sqlalchemy.future import select

from app.models.subject import Subject


def _payload(name="Math 101", **overrides):
    base = {
        "name": name,
        "category": "core_academic",
        "color": "#FF8800",
        "default_session_duration_minutes": 45,
        "default_weekly_frequency": 3,
    }
    base.update(overrides)
    return base


# ── Auth gate ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_subject_requires_family(authed_client):
    client, _ = authed_client
    resp = await client.post("/api/v1/subjects", json=_payload())
    assert resp.status_code == 400


# ── Create / read ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_subject(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/subjects", json=_payload(name="Algebra"))
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Algebra"
    assert body["slug"] == "algebra"
    assert body["is_platform_subject"] is False


@pytest.mark.asyncio
async def test_create_subject_invalid_color_422(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/subjects", json=_payload(color="not-hex"))
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_subject_invalid_category_422(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/subjects", json=_payload(category="bogus_cat"))
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_subject_unique_slug_per_family(authed_with_family):
    client, _, _ = authed_with_family
    r1 = await client.post("/api/v1/subjects", json=_payload(name="Reading"))
    r2 = await client.post("/api/v1/subjects", json=_payload(name="Reading"))
    assert r1.status_code == 201 and r2.status_code == 201
    assert r1.json()["slug"] == "reading"
    assert r2.json()["slug"] == "reading-1"


@pytest.mark.asyncio
async def test_list_subjects_returns_own(authed_with_family):
    client, _, _ = authed_with_family
    await client.post("/api/v1/subjects", json=_payload(name="A"))
    await client.post("/api/v1/subjects", json=_payload(name="B"))
    resp = await client.get("/api/v1/subjects")
    assert resp.status_code == 200
    names = sorted(s["name"] for s in resp.json())
    assert names == ["A", "B"]


@pytest.mark.asyncio
async def test_list_subjects_filter_mine(authed_with_family, make_subject):
    """Source filter should narrow to family-owned subjects only."""
    client, _, family = authed_with_family
    await make_subject(family.id, name="Mine A")
    await make_subject(None, name="Platform A", is_platform_subject=True)

    resp = await client.get("/api/v1/subjects?source=mine")
    assert resp.status_code == 200
    names = [s["name"] for s in resp.json()]
    assert "Mine A" in names
    assert "Platform A" not in names


@pytest.mark.asyncio
async def test_list_subjects_filter_platform(authed_with_family, make_subject):
    client, _, family = authed_with_family
    await make_subject(family.id, name="Mine")
    await make_subject(None, name="Platform", is_platform_subject=True)

    resp = await client.get("/api/v1/subjects?source=platform")
    assert resp.status_code == 200
    names = [s["name"] for s in resp.json()]
    assert names == ["Platform"]


@pytest.mark.asyncio
async def test_list_subjects_search(authed_with_family, make_subject):
    client, _, family = authed_with_family
    await make_subject(family.id, name="Latin Grammar")
    await make_subject(family.id, name="Greek")
    resp = await client.get("/api/v1/subjects?search=lat")
    assert resp.status_code == 200
    names = [s["name"] for s in resp.json()]
    assert names == ["Latin Grammar"]


@pytest.mark.asyncio
async def test_list_subjects_search_wildcard_escaped(authed_with_family, make_subject):
    """LIKE wildcards in search input must be escaped, not interpreted."""
    client, _, family = authed_with_family
    await make_subject(family.id, name="Algebra")
    await make_subject(family.id, name="Geometry")

    resp = await client.get("/api/v1/subjects?search=%25")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_get_subject_404_for_unknown(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.get(f"/api/v1/subjects/{uuid.uuid4()}")
    assert resp.status_code == 404


# ── Update ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_own_subject(authed_with_family):
    client, _, _ = authed_with_family
    r1 = await client.post("/api/v1/subjects", json=_payload(name="Old"))
    sid = r1.json()["id"]
    r2 = await client.patch(f"/api/v1/subjects/{sid}", json={"name": "New", "color": "#000000"})
    assert r2.status_code == 200
    body = r2.json()
    assert body["name"] == "New"
    assert body["slug"] == "new"
    assert body["color"] == "#000000"


@pytest.mark.asyncio
async def test_cannot_update_platform_subject(authed_with_family, make_subject):
    client, _, _ = authed_with_family
    plat = await make_subject(None, name="Plat", is_platform_subject=True)
    resp = await client.patch(f"/api/v1/subjects/{plat.id}", json={"name": "X"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_cannot_update_other_family_subject(authed_with_family, make_subject, make_user, fresh_session):
    """A subject owned by a different family must not be editable."""
    client, _, _ = authed_with_family
    foreign_user = await make_user(email="foreign@example.com")
    s = await fresh_session()
    from app.models.family import Family
    foreign_family = Family(
        account_id=foreign_user.id,
        family_name="Foreign Family",
        family_name_slug=f"foreign-{uuid.uuid4().hex[:6]}",
        shield_config={},
        home_languages=["en"],
    )
    s.add(foreign_family)
    await s.commit()
    foreign_subject = await make_subject(foreign_family.id, name="Foreign")
    resp = await client.patch(f"/api/v1/subjects/{foreign_subject.id}", json={"name": "X"})
    assert resp.status_code == 403


# ── Delete ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_own_subject(authed_with_family, fresh_session):
    client, _, _ = authed_with_family
    r1 = await client.post("/api/v1/subjects", json=_payload(name="DeleteMe"))
    sid = r1.json()["id"]
    r2 = await client.delete(f"/api/v1/subjects/{sid}")
    assert r2.status_code == 204

    s = await fresh_session()
    res = await s.execute(select(Subject).where(Subject.id == uuid.UUID(sid)))
    assert res.scalars().first() is None


@pytest.mark.asyncio
async def test_cannot_delete_platform_subject(authed_with_family, make_subject):
    client, _, _ = authed_with_family
    plat = await make_subject(None, name="Plat", is_platform_subject=True)
    resp = await client.delete(f"/api/v1/subjects/{plat.id}")
    assert resp.status_code == 403


# ── Fork ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fork_platform_subject(authed_with_family, make_subject):
    client, _, family = authed_with_family
    plat = await make_subject(
        None,
        name="Latin",
        is_platform_subject=True,
        learning_objectives=["Read Caesar"],
    )
    resp = await client.post(f"/api/v1/subjects/{plat.id}/fork")
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Latin"
    assert body["is_platform_subject"] is False
    assert body["family_id"] == str(family.id)
    assert body["learning_objectives"] == ["Read Caesar"]


@pytest.mark.asyncio
async def test_fork_unknown_404(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post(f"/api/v1/subjects/{uuid.uuid4()}/fork")
    assert resp.status_code == 404
