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
