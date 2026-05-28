"""Family-to-family messages — happy-path + thread + notifications.

Spec: docs/superpowers/specs/2026-05-28-family-messages-design.md
"""
from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.family import Family
from app.models.family_member import FamilyMember
from app.models.message import MessageThread, MessageItem


pytestmark = pytest.mark.asyncio


# ── helpers ───────────────────────────────────────────────────────────────


async def _create_family(db, user, name="Jones", discoverable=True):
    f = Family(
        account_id=user.id,
        family_name=name,
        family_name_slug=f"{name.lower()}-{uuid.uuid4().hex[:6]}",
        shield_config={},
        home_languages=["en"],
        education_methods=[],
        current_curriculum=[],
        discoverable=discoverable,
        visibility="local" if discoverable else "private",
    )
    db.add(f)
    await db.flush()
    db.add(FamilyMember(family_id=f.id, user_id=user.id, role="primary"))
    user.has_family = True
    await db.commit()
    await db.refresh(f)
    return f


@pytest_asyncio.fixture
async def two_families(authed_with_family, db, make_user, make_client):
    """Family A (authed) + family B, both discoverable. Returns clients + family rows."""
    client_a, user_a, family_a = authed_with_family
    # Ensure A is discoverable so we can also message from B's side
    family_a.discoverable = True
    family_a.visibility = "local"
    await db.commit()
    await db.refresh(family_a)

    user_b = await make_user()
    family_b = await _create_family(db, user_b, name="Jones")
    client_b = await make_client(user_b)
    return client_a, family_a, client_b, family_b


# ── canonical-pair invariant ──────────────────────────────────────────────


async def test_starting_a_thread_from_either_direction_uses_one_row(
    two_families, db,
):
    client_a, family_a, client_b, family_b = two_families

    r = await client_a.post(
        "/api/v1/messages/threads",
        json={"recipient_family_id": str(family_b.id), "body": "Hi from A"},
    )
    assert r.status_code == 201, r.text
    thread1_id = r.json()["thread"]["id"]

    # B "starting" a thread back must hit the same row.
    r2 = await client_b.post(
        "/api/v1/messages/threads",
        json={"recipient_family_id": str(family_a.id), "body": "Hi from B"},
    )
    assert r2.status_code == 201
    thread2_id = r2.json()["thread"]["id"]
    assert thread1_id == thread2_id

    rows = list(
        (await db.execute(select(MessageThread))).scalars().all()
    )
    assert len(rows) == 1


async def test_canonical_pair_check_constraint(two_families, db):
    """The DB check enforces family_a_id < family_b_id."""
    client_a, family_a, client_b, family_b = two_families

    r = await client_a.post(
        "/api/v1/messages/threads",
        json={"recipient_family_id": str(family_b.id), "body": "Hi"},
    )
    assert r.status_code == 201
    t = (await db.execute(select(MessageThread))).scalars().first()
    assert str(t.family_a_id) < str(t.family_b_id)


# ── send / reply / read ───────────────────────────────────────────────────


async def test_reply_appears_in_thread_detail(two_families):
    client_a, family_a, client_b, family_b = two_families

    r = await client_a.post(
        "/api/v1/messages/threads",
        json={"recipient_family_id": str(family_b.id), "body": "Hello"},
    )
    thread_id = r.json()["thread"]["id"]

    r2 = await client_b.post(
        f"/api/v1/messages/threads/{thread_id}/messages",
        json={"body": "Hey back"},
    )
    assert r2.status_code == 201

    detail = await client_a.get(f"/api/v1/messages/threads/{thread_id}")
    bodies = [m["body"] for m in detail.json()["messages"]]
    assert bodies == ["Hello", "Hey back"]


async def test_unread_count_and_mark_read(two_families):
    client_a, family_a, client_b, family_b = two_families

    await client_a.post(
        "/api/v1/messages/threads",
        json={"recipient_family_id": str(family_b.id), "body": "first"},
    )

    unread_b = await client_b.get("/api/v1/messages/unread-count")
    assert unread_b.json()["threads"] == 1

    # A — actor — has zero unread.
    unread_a = await client_a.get("/api/v1/messages/unread-count")
    assert unread_a.json()["threads"] == 0

    # Get the thread id from B's inbox.
    inbox_b = await client_b.get("/api/v1/messages/threads")
    thread_id = inbox_b.json()["items"][0]["id"]

    mr = await client_b.post(f"/api/v1/messages/threads/{thread_id}/read")
    assert mr.status_code == 204

    unread_b2 = await client_b.get("/api/v1/messages/unread-count")
    assert unread_b2.json()["threads"] == 0


# ── notifications fan-out ─────────────────────────────────────────────────


async def test_new_thread_creates_notification_for_recipient_only(
    two_families,
):
    client_a, family_a, client_b, family_b = two_families

    await client_a.post(
        "/api/v1/messages/threads",
        json={"recipient_family_id": str(family_b.id), "body": "Hi"},
    )

    bell_b = await client_b.get("/api/v1/notifications/unread-count")
    assert bell_b.json()["count"] == 1

    bell_a = await client_a.get("/api/v1/notifications/unread-count")
    assert bell_a.json()["count"] == 0


async def test_reply_creates_notification_excluding_actor(two_families):
    client_a, family_a, client_b, family_b = two_families

    r = await client_a.post(
        "/api/v1/messages/threads",
        json={"recipient_family_id": str(family_b.id), "body": "hello"},
    )
    thread_id = r.json()["thread"]["id"]

    await client_b.post(
        f"/api/v1/messages/threads/{thread_id}/messages",
        json={"body": "back"},
    )

    # A now has one new notification from B; B's own action did not notify B.
    bell_a = await client_a.get("/api/v1/notifications/unread-count")
    assert bell_a.json()["count"] == 1


async def test_mark_read_clears_message_notifications(two_families):
    client_a, family_a, client_b, family_b = two_families

    r = await client_a.post(
        "/api/v1/messages/threads",
        json={"recipient_family_id": str(family_b.id), "body": "hi"},
    )
    thread_id = r.json()["thread"]["id"]

    assert (await client_b.get("/api/v1/notifications/unread-count")).json()["count"] == 1
    await client_b.post(f"/api/v1/messages/threads/{thread_id}/read")
    assert (await client_b.get("/api/v1/notifications/unread-count")).json()["count"] == 0


async def test_muted_thread_does_not_fan_out(two_families):
    client_a, family_a, client_b, family_b = two_families

    # B starts to mute by first creating the thread (need participant row first
    # via a one-way message).
    r = await client_a.post(
        "/api/v1/messages/threads",
        json={"recipient_family_id": str(family_b.id), "body": "hi"},
    )
    thread_id = r.json()["thread"]["id"]

    # B mutes their side, then A sends another message.
    await client_b.post(
        f"/api/v1/messages/threads/{thread_id}/mute",
        json={"muted": True},
    )
    # Clear B's existing unread first.
    await client_b.post(f"/api/v1/messages/threads/{thread_id}/read")

    await client_a.post(
        f"/api/v1/messages/threads/{thread_id}/messages",
        json={"body": "another"},
    )
    bell_b = await client_b.get("/api/v1/notifications/unread-count")
    assert bell_b.json()["count"] == 0


# ── body limits ───────────────────────────────────────────────────────────


async def test_empty_body_is_rejected(two_families):
    client_a, family_a, client_b, family_b = two_families
    r = await client_a.post(
        "/api/v1/messages/threads",
        json={"recipient_family_id": str(family_b.id), "body": ""},
    )
    assert r.status_code == 422


async def test_too_long_body_is_rejected(two_families):
    client_a, family_a, client_b, family_b = two_families
    r = await client_a.post(
        "/api/v1/messages/threads",
        json={"recipient_family_id": str(family_b.id), "body": "x" * 5000},
    )
    assert r.status_code == 422


# ── rate limit ────────────────────────────────────────────────────────────


async def test_new_thread_rate_limit(authed_with_family, db, make_user, make_client):
    client_a, user_a, family_a = authed_with_family
    family_a.discoverable = True
    family_a.visibility = "local"
    await db.commit()

    # Create 6 candidate recipients and try to start threads.
    for i in range(6):
        user = await make_user()
        fam = await _create_family(db, user, name=f"Fam{i}")
        r = await client_a.post(
            "/api/v1/messages/threads",
            json={"recipient_family_id": str(fam.id), "body": f"hi {i}"},
        )
        if i < 5:
            assert r.status_code == 201, r.text
        else:
            assert r.status_code == 429


# ── gate: hidden recipients ───────────────────────────────────────────────


async def test_cannot_message_non_discoverable_stranger(
    authed_with_family, db, make_user,
):
    client_a, user_a, family_a = authed_with_family

    user_b = await make_user()
    hidden = await _create_family(db, user_b, name="Hidden", discoverable=False)
    # Override visibility to private to truly hide them.
    hidden.visibility = "private"
    await db.commit()

    r = await client_a.post(
        "/api/v1/messages/threads",
        json={"recipient_family_id": str(hidden.id), "body": "hi"},
    )
    assert r.status_code == 404


# ── delete-for-me ─────────────────────────────────────────────────────────


async def test_delete_thread_hides_for_caller_only(two_families):
    client_a, family_a, client_b, family_b = two_families

    r = await client_a.post(
        "/api/v1/messages/threads",
        json={"recipient_family_id": str(family_b.id), "body": "hi"},
    )
    thread_id = r.json()["thread"]["id"]

    d = await client_a.delete(f"/api/v1/messages/threads/{thread_id}")
    assert d.status_code == 204

    inbox_a = await client_a.get("/api/v1/messages/threads")
    assert inbox_a.json()["total"] == 0

    inbox_b = await client_b.get("/api/v1/messages/threads")
    assert inbox_b.json()["total"] == 1


async def test_after_cursor_returns_only_newer_messages(two_families):
    """The ?after=<iso> query param is the polling delta cursor.

    Strict greater-than: a message with created_at equal to the cursor must
    NOT be returned again (would cause client-side duplication).
    """
    client_a, family_a, client_b, family_b = two_families

    r = await client_a.post(
        "/api/v1/messages/threads",
        json={"recipient_family_id": str(family_b.id), "body": "first"},
    )
    thread_id = r.json()["thread"]["id"]
    first_msg_at = r.json()["message"]["created_at"]

    # Poll with the just-sent message's created_at as cursor — no new messages.
    delta0 = await client_a.get(
        f"/api/v1/messages/threads/{thread_id}?after={first_msg_at}",
    )
    assert delta0.status_code == 200
    assert delta0.json()["messages"] == []

    # B replies; A polls; sees only the reply.
    r2 = await client_b.post(
        f"/api/v1/messages/threads/{thread_id}/messages",
        json={"body": "reply"},
    )
    reply_id = r2.json()["id"]

    delta1 = await client_a.get(
        f"/api/v1/messages/threads/{thread_id}?after={first_msg_at}",
    )
    assert delta1.status_code == 200
    items = delta1.json()["messages"]
    assert [m["id"] for m in items] == [reply_id]


async def test_after_cursor_state_fields_still_returned(two_families):
    """A polling delta still syncs can_send / block flags / mute state."""
    client_a, family_a, client_b, family_b = two_families

    r = await client_a.post(
        "/api/v1/messages/threads",
        json={"recipient_family_id": str(family_b.id), "body": "hi"},
    )
    thread_id = r.json()["thread"]["id"]
    first_msg_at = r.json()["message"]["created_at"]

    # B blocks A. A polls — should see can_send=false even though no new
    # messages came in.
    await client_b.post(
        "/api/v1/messages/blocks", json={"family_id": str(family_a.id)},
    )

    delta = await client_a.get(
        f"/api/v1/messages/threads/{thread_id}?after={first_msg_at}",
    )
    assert delta.status_code == 200
    body = delta.json()
    assert body["messages"] == []
    assert body["can_send"] is False
    assert body["blocked_by_them"] is True


async def test_new_message_un_deletes_for_recipient(two_families):
    client_a, family_a, client_b, family_b = two_families

    r = await client_a.post(
        "/api/v1/messages/threads",
        json={"recipient_family_id": str(family_b.id), "body": "hi"},
    )
    thread_id = r.json()["thread"]["id"]

    await client_b.delete(f"/api/v1/messages/threads/{thread_id}")
    assert (await client_b.get("/api/v1/messages/threads")).json()["total"] == 0

    # A sends another message — B's thread reappears.
    await client_a.post(
        f"/api/v1/messages/threads/{thread_id}/messages",
        json={"body": "second"},
    )
    assert (await client_b.get("/api/v1/messages/threads")).json()["total"] == 1
