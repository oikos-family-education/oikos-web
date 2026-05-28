"""Community identity (banner colors + emblem) v2 spec §7."""
from __future__ import annotations

import pytest
import pytest_asyncio


pytestmark = pytest.mark.asyncio


def _payload(**over):
    base = dict(
        name="Identity co-op",
        description="",
        principles_text="",
        principle_tags={"faith": None, "education_methods": [], "home_languages": ["en"]},
        region_scope="online",
        country_code=None,
        region=None,
        join_mode="request_to_join",
    )
    base.update(over)
    return base


async def test_create_persists_identity(authed_with_family):
    client, _, _ = authed_with_family
    res = await client.post(
        "/api/v1/communities",
        json=_payload(
            identity={
                "primary_color": "#1B2A4A",
                "secondary_color": "#C5A84B",
                "emblem": "compass",
                "emblem_color": "#FFFFFF",
                "layout": "left",
            },
        ),
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["identity"]["primary_color"] == "#1B2A4A"
    assert body["identity"]["emblem"] == "compass"


async def test_update_identity_via_patch(authed_with_family):
    client, _, _ = authed_with_family
    create = await client.post("/api/v1/communities", json=_payload())
    slug = create.json()["slug"]

    patch = await client.patch(
        f"/api/v1/communities/{slug}",
        json={
            "identity": {
                "primary_color": "#2A1B4A",
                "secondary_color": "#FFD700",
                "emblem": "leaf",
            }
        },
    )
    assert patch.status_code == 200, patch.text
    assert patch.json()["identity"]["emblem"] == "leaf"


async def test_invalid_color_rejected(authed_with_family):
    client, _, _ = authed_with_family
    res = await client.post(
        "/api/v1/communities",
        json=_payload(identity={"primary_color": "not-a-color"}),
    )
    assert res.status_code == 422


async def test_get_and_patch_responses_echo_identity(authed_with_family):
    """Regression for PR #31 review: the settings UI reset itself after Save
    because PATCH (and GET) didn't echo `identity` back. _to_card must include
    the field."""
    client, _, _ = authed_with_family
    create = await client.post(
        "/api/v1/communities",
        json=_payload(identity={
            "primary_color": "#1B2A4A",
            "secondary_color": "#C5A84B",
            "emblem": "compass",
            "emblem_color": "#FFFFFF",
            "layout": "left",
        }),
    )
    assert create.status_code == 201
    slug = create.json()["slug"]

    # GET echoes identity
    got = await client.get(f"/api/v1/communities/{slug}")
    assert got.status_code == 200
    assert got.json()["identity"]["emblem"] == "compass"
    assert got.json()["identity"]["primary_color"] == "#1B2A4A"

    # PATCH echoes the updated identity (not null)
    patched = await client.patch(
        f"/api/v1/communities/{slug}",
        json={"identity": {
            "primary_color": "#2A1B4A",
            "secondary_color": "#FFD700",
            "emblem": "leaf",
            "emblem_color": "#FFFFFF",
            "layout": "center",
        }},
    )
    assert patched.status_code == 200
    body = patched.json()
    assert body["identity"] is not None
    assert body["identity"]["emblem"] == "leaf"
    assert body["identity"]["primary_color"] == "#2A1B4A"
    assert body["identity"]["layout"] == "center"
