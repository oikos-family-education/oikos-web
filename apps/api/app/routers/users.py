from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, DEFAULT_NOTIFICATION_PREFERENCES, DEFAULT_UI_PREFERENCES
from app.schemas.auth import MessageResponse, UserResponse
from app.schemas.users import (
    UpdateNameRequest,
    ChangePasswordRequest,
    UpdatePreferencesRequest,
    NotificationPreferencesRequest,
    NotificationPreferencesResponse,
    UiPreferencesResponse,
    UserSettingsResponse,
    DeleteAccountRequest,
)
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    return UserService(db)


def _build_settings_response(user: User) -> UserSettingsResponse:
    notif = {**DEFAULT_NOTIFICATION_PREFERENCES, **(user.notification_preferences or {})}
    ui = {**DEFAULT_UI_PREFERENCES, **(user.ui_preferences or {})}
    return UserSettingsResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        last_login_at=user.last_login_at,
        timezone=user.timezone,
        locale=user.locale,
        date_format=user.date_format,
        time_format=user.time_format,
        notification_preferences=NotificationPreferencesResponse(**notif),
        ui_preferences=UiPreferencesResponse(**ui),
    )


@router.get("/me/settings", response_model=UserSettingsResponse)
async def get_settings(current_user: User = Depends(get_current_user)):
    return _build_settings_response(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_name(
    req: UpdateNameRequest,
    current_user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
):
    user = await service.update_name(current_user, req)
    return user


@router.post("/me/change-password", response_model=MessageResponse)
async def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
):
    await service.change_password(current_user, req)
    return MessageResponse(message="Password changed successfully.")


@router.patch("/me/preferences", response_model=UserSettingsResponse)
async def update_preferences(
    req: UpdatePreferencesRequest,
    current_user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
):
    user = await service.update_preferences(current_user, req)
    return _build_settings_response(user)


@router.get("/me/notification-preferences", response_model=NotificationPreferencesResponse)
async def get_notification_preferences(
    current_user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
):
    prefs = await service.get_notification_preferences(current_user)
    return NotificationPreferencesResponse(**prefs)


@router.patch("/me/notification-preferences", response_model=NotificationPreferencesResponse)
async def update_notification_preferences(
    req: NotificationPreferencesRequest,
    current_user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
):
    prefs = await service.update_notification_preferences(current_user, req)
    return NotificationPreferencesResponse(**prefs)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    req: DeleteAccountRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
):
    await service.delete_account(current_user, req)
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
