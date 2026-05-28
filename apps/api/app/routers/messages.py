"""Family-to-family messages router.

Spec: docs/superpowers/specs/2026-05-28-family-messages-design.md
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.message import (
    BlockList,
    BlockRequest,
    InboxPage,
    MuteRequest,
    ReplyRequest,
    ReportRequest,
    StartThreadRequest,
    StartThreadResponse,
    ThreadDetail,
    UnreadCount,
)
from app.services.message_service import MessageService


router = APIRouter(tags=["messages"])


def get_service(db: AsyncSession = Depends(get_db)) -> MessageService:
    return MessageService(db)


# ── Threads ───────────────────────────────────────────────────────────────


@router.get("/messages/threads", response_model=InboxPage)
async def list_threads(
    filter: str = Query("all", pattern=r"^(all|unread|archived)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    svc: MessageService = Depends(get_service),
):
    family = await svc.get_family_for_user(current_user.id)
    return await svc.list_threads(family, filter_=filter, page=page, page_size=page_size)


@router.post(
    "/messages/threads",
    response_model=StartThreadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def start_thread(
    body: StartThreadRequest,
    current_user: User = Depends(get_current_user),
    svc: MessageService = Depends(get_service),
):
    family = await svc.get_family_for_user(current_user.id)
    thread, msg = await svc.start_or_get_thread(
        sender_family=family,
        recipient_family_id=body.recipient_family_id,
        body=body.body,
    )
    detail = await svc.get_thread_detail(family, thread.id)
    return {
        "thread": detail,
        "message": {
            "id": msg.id,
            "thread_id": msg.thread_id,
            "author_family_id": msg.author_family_id,
            "body": msg.body,
            "created_at": msg.created_at,
        },
    }


@router.get("/messages/threads/{thread_id}", response_model=ThreadDetail)
async def get_thread(
    thread_id: UUID,
    before: Optional[datetime] = None,
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    svc: MessageService = Depends(get_service),
):
    family = await svc.get_family_for_user(current_user.id)
    return await svc.get_thread_detail(family, thread_id, before=before, limit=limit)


@router.post(
    "/messages/threads/{thread_id}/messages",
    status_code=status.HTTP_201_CREATED,
)
async def post_reply(
    thread_id: UUID,
    body: ReplyRequest,
    current_user: User = Depends(get_current_user),
    svc: MessageService = Depends(get_service),
):
    family = await svc.get_family_for_user(current_user.id)
    msg = await svc.post_reply(family, thread_id, body.body)
    return {
        "id": msg.id,
        "thread_id": msg.thread_id,
        "author_family_id": msg.author_family_id,
        "body": msg.body,
        "created_at": msg.created_at,
    }


@router.post(
    "/messages/threads/{thread_id}/read", status_code=status.HTTP_204_NO_CONTENT,
)
async def mark_read(
    thread_id: UUID,
    current_user: User = Depends(get_current_user),
    svc: MessageService = Depends(get_service),
):
    family = await svc.get_family_for_user(current_user.id)
    await svc.mark_read(family, thread_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/messages/threads/{thread_id}/mute", status_code=status.HTTP_204_NO_CONTENT,
)
async def set_mute(
    thread_id: UUID,
    body: MuteRequest,
    current_user: User = Depends(get_current_user),
    svc: MessageService = Depends(get_service),
):
    family = await svc.get_family_for_user(current_user.id)
    await svc.set_mute(family, thread_id, body.muted)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/messages/threads/{thread_id}", status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_thread(
    thread_id: UUID,
    current_user: User = Depends(get_current_user),
    svc: MessageService = Depends(get_service),
):
    family = await svc.get_family_for_user(current_user.id)
    await svc.delete_for_me(family, thread_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Reports ───────────────────────────────────────────────────────────────


@router.post(
    "/messages/threads/{thread_id}/reports",
    status_code=status.HTTP_201_CREATED,
)
async def report_thread(
    thread_id: UUID,
    body: ReportRequest,
    current_user: User = Depends(get_current_user),
    svc: MessageService = Depends(get_service),
):
    family = await svc.get_family_for_user(current_user.id)
    rep = await svc.report_thread(family, thread_id, body.reason, body.also_block)
    return {"id": rep.id, "status": rep.status}


# ── Blocks ────────────────────────────────────────────────────────────────


@router.get("/messages/blocks", response_model=BlockList)
async def list_blocks(
    current_user: User = Depends(get_current_user),
    svc: MessageService = Depends(get_service),
):
    family = await svc.get_family_for_user(current_user.id)
    return {"items": await svc.list_blocks(family)}


@router.post("/messages/blocks", status_code=status.HTTP_201_CREATED)
async def block_family(
    body: BlockRequest,
    current_user: User = Depends(get_current_user),
    svc: MessageService = Depends(get_service),
):
    family = await svc.get_family_for_user(current_user.id)
    b = await svc.block_family(family, body.family_id, body.reason)
    return {"id": b.id, "blocked_family_id": b.blocked_family_id}


@router.delete(
    "/messages/blocks/{family_id}", status_code=status.HTTP_204_NO_CONTENT,
)
async def unblock_family(
    family_id: UUID,
    current_user: User = Depends(get_current_user),
    svc: MessageService = Depends(get_service),
):
    family = await svc.get_family_for_user(current_user.id)
    await svc.unblock_family(family, family_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Unread summary ────────────────────────────────────────────────────────


@router.get("/messages/unread-count", response_model=UnreadCount)
async def unread_count(
    current_user: User = Depends(get_current_user),
    svc: MessageService = Depends(get_service),
):
    family = await svc.get_family_for_user(current_user.id)
    return {"threads": await svc.unread_thread_count(family)}
