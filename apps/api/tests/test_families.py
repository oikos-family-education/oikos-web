"""Tests for /families router and FamilyService."""
import pytest
from sqlalchemy.future import select

from app.models.family import Family
from app.models.family_member import FamilyMember
from app.models.user import User


# ── Auth gate ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_family_requires_auth(client):
    resp = await client.post("/api/v1/families", json={"family_name": "Smith"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_my_family_requires_auth(client):
    resp = await client.get("/api/v1/families/me")
    assert resp.status_code == 401


# ── Create ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_family_minimal(authed_client, fresh_session):
    client, user = authed_client
    resp = await client.post("/api/v1/families", json={"family_name": "Smith"})
    assert resp.status_code == 201

    body = resp.json()
    assert body["family_name"] == "Smith"
    assert body["family_name_slug"]

    # The creator becomes a primary member, has_family flips to True.
    s = await fresh_session()
    res = await s.execute(select(FamilyMember).where(FamilyMember.user_id == user.id))
    member = res.scalars().first()
    assert member is not None
    assert member.role == "primary"

    res = await s.execute(select(User).where(User.id == user.id))
    refreshed = res.scalars().first()
    assert refreshed.has_family is True


@pytest.mark.asyncio
async def test_create_family_with_full_payload(authed_client):
    client, _ = authed_client
    resp = await client.post("/api/v1/families", json={
        "family_name": "The O'Brien-Smiths",
        "location_city": "Boston",
        "location_country_code": "US",
        "faith_tradition": "christian",
        "education_methods": ["classical", "charlotte_mason"],
        "home_languages": ["en", "es"],
        "visibility": "private",
    })
    assert resp.status_code == 201
    body = resp.json()
    assert body["family_name"] == "The O'Brien-Smiths"
    assert body["education_methods"] == ["classical", "charlotte_mason"]
    assert body["home_languages"] == ["en", "es"]
    assert body["visibility"] == "private"


@pytest.mark.asyncio
async def test_create_family_invalid_chars_422(authed_client):
    client, _ = authed_client
    resp = await client.post("/api/v1/families", json={"family_name": "Smith;DROP--"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_family_too_short_422(authed_client):
    client, _ = authed_client
    resp = await client.post("/api/v1/families", json={"family_name": "X"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_family_twice_blocked(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.post("/api/v1/families", json={"family_name": "Other"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_create_family_generates_unique_slugs(authed_client, make_user, db):
    client, _ = authed_client
    r1 = await client.post("/api/v1/families", json={"family_name": "Smith"})
    assert r1.status_code == 201

    # Second user with the same family name → slug must differ.
    other = await make_user(email="other@example.com")
    from app.core.security import create_access_token
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac2:
        ac2.cookies.set("access_token", create_access_token(str(other.id)))
        r2 = await ac2.post("/api/v1/families", json={"family_name": "Smith"})
        assert r2.status_code == 201
        assert r2.json()["family_name_slug"] != r1.json()["family_name_slug"]


# ── Read ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_my_family_404_when_none(authed_client):
    client, _ = authed_client
    resp = await client.get("/api/v1/families/me")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_my_family_returns_it(authed_with_family):
    client, _, family = authed_with_family
    resp = await client.get("/api/v1/families/me")
    assert resp.status_code == 200
    assert resp.json()["family_name"] == family.family_name


# ── Update ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_family_renames_and_reslugs(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.patch("/api/v1/families/me", json={"family_name": "Smiths Renamed"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["family_name"] == "Smiths Renamed"
    assert "smiths-renamed" in body["family_name_slug"]


@pytest.mark.asyncio
async def test_update_family_partial(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.patch("/api/v1/families/me", json={"location_city": "Austin"})
    assert resp.status_code == 200
    assert resp.json()["location_city"] == "Austin"


@pytest.mark.asyncio
async def test_update_family_404_without_family(authed_client):
    client, _ = authed_client
    resp = await client.patch("/api/v1/families/me", json={"location_city": "Austin"})
    assert resp.status_code == 404


# ── Shield ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_shield_sets_user_flag(authed_with_family, fresh_session):
    client, user, _ = authed_with_family
    resp = await client.patch("/api/v1/families/me/shield", json={
        "initials": "AB",
        "primary_color": "#112233",
        "secondary_color": "#445566",
        "accent_color": "#778899",
    })
    assert resp.status_code == 200
    s = await fresh_session()
    res = await s.execute(select(User).where(User.id == user.id))
    assert res.scalars().first().has_coat_of_arms is True


@pytest.mark.asyncio
async def test_update_shield_invalid_color_422(authed_with_family):
    client, _, _ = authed_with_family
    resp = await client.patch("/api/v1/families/me/shield", json={
        "initials": "AB",
        "primary_color": "not-a-color",
        "secondary_color": "#445566",
        "accent_color": "#778899",
    })
    assert resp.status_code == 422


# ── Delete ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_family_clears_user_flag(authed_with_family, fresh_session):
    client, user, _ = authed_with_family
    resp = await client.delete("/api/v1/families/me")
    assert resp.status_code == 204

    s = await fresh_session()
    res = await s.execute(select(Family).where(Family.account_id == user.id))
    assert res.scalars().first() is None

    res = await s.execute(select(User).where(User.id == user.id))
    assert res.scalars().first().has_family is False


@pytest.mark.asyncio
async def test_delete_family_404_when_none(authed_client):
    client, _ = authed_client
    resp = await client.delete("/api/v1/families/me")
    assert resp.status_code == 404


# ── Cross-account isolation ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_user_cannot_see_other_family(authed_with_family, make_user):
    client_a, _, family_a = authed_with_family
    other = await make_user(email="other@example.com")

    from app.core.security import create_access_token
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client_b:
        client_b.cookies.set("access_token", create_access_token(str(other.id)))
        resp = await client_b.get("/api/v1/families/me")
        assert resp.status_code == 404
