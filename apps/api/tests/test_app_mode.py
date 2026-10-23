import pytest

from app.main import create_app

CLOUD_ONLY_TAGS = {"communities", "meetups", "messages", "notifications", "beta-public", "admin", "invitations"}


def _tags(application):
    return {t for r in application.routes for t in getattr(r, "tags", [])}


def test_cloud_app_mounts_everything():
    assert CLOUD_ONLY_TAGS <= _tags(create_app())


def test_desktop_app_has_no_cloud_only_routes(desktop_mode):
    assert not (CLOUD_ONLY_TAGS & _tags(create_app()))


@pytest.mark.asyncio
async def test_desktop_core_routes_still_work(desktop_client):
    assert (await desktop_client.get("/health")).status_code == 200


@pytest.mark.asyncio
async def test_family_invite_404_in_desktop(authed_with_family, desktop_mode):
    client, _, _ = authed_with_family
    res = await client.post("/api/v1/families/me/members/invite", json={"email": "x@example.com"})
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_family_invite_unchanged_in_cloud(authed_with_family):
    client, _, _ = authed_with_family
    res = await client.post("/api/v1/families/me/members/invite", json={"email": "x@example.com"})
    assert res.status_code != 404
