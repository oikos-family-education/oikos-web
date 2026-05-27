"""In-app notifications router (v2 spec §11.4)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.notification import NotificationListPage, UnreadCount
from app.services.notification_service import NotificationService


router = APIRouter(tags=["notifications"])


def get_service(db: AsyncSession = Depends(get_db)) -> NotificationService:
    return NotificationService(db)


@router.get("/notifications", response_model=NotificationListPage)
async def list_notifications(
    unread: bool = Query(False),
    limit: int = Query(25, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    svc: NotificationService = Depends(get_service),
):
    return await svc.list_notifications(current_user.id, unread, limit)


@router.get("/notifications/unread-count", response_model=UnreadCount)
async def unread_count(
    current_user: User = Depends(get_current_user),
    svc: NotificationService = Depends(get_service),
):
    return {"count": await svc.unread_count(current_user.id)}


@router.post("/notifications/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    svc: NotificationService = Depends(get_service),
):
    await svc.mark_read(current_user.id, notification_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/notifications/mark-all-read")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    svc: NotificationService = Depends(get_service),
):
    n = await svc.mark_all_read(current_user.id)
    return {"marked": n}
