from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException, status

from app.core.security import verify_password, get_password_hash
from app.models.user import User, DEFAULT_NOTIFICATION_PREFERENCES
from app.schemas.users import (
    UpdateNameRequest,
    ChangePasswordRequest,
    UpdatePreferencesRequest,
    NotificationPreferencesRequest,
    DeleteAccountRequest,
)
from app.models.user import DEFAULT_UI_PREFERENCES

VALID_TIMEZONES = None  # Lazy-loaded on first use
VALID_DATE_FORMATS = {"MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"}
VALID_TIME_FORMATS = {"12h", "24h"}
VALID_LOCALES = {"en", "pt-BR"}


def _get_valid_timezones():
    global VALID_TIMEZONES
    if VALID_TIMEZONES is None:
        try:
            import zoneinfo
            VALID_TIMEZONES = zoneinfo.available_timezones()
        except ImportError:
            VALID_TIMEZONES = set()
    return VALID_TIMEZONES


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _attach(self, user: User) -> User:
        """Re-attach a detached user (loaded in a different session) to self.db."""
        return await self.db.merge(user)

    async def update_name(self, user: User, req: UpdateNameRequest) -> User:
        user = await self._attach(user)
        user.first_name = req.first_name.strip()
        user.last_name = req.last_name.strip()
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def change_password(self, user: User, req: ChangePasswordRequest) -> User:
        if not verify_password(req.current_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect current password.",
            )
        user = await self._attach(user)
        user.hashed_password = get_password_hash(req.new_password)
        user.failed_login_attempts = 0
        user.locked_until = None
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update_preferences(self, user: User, req: UpdatePreferencesRequest) -> User:
        user = await self._attach(user)
        if req.timezone is not None:
            valid_tzs = _get_valid_timezones()
            if valid_tzs and req.timezone not in valid_tzs:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid timezone: {req.timezone}",
                )
            user.timezone = req.timezone

        if req.locale is not None:
            if req.locale not in VALID_LOCALES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported locale: {req.locale}",
                )
            user.locale = req.locale

        if req.date_format is not None:
            if req.date_format not in VALID_DATE_FORMATS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid date format: {req.date_format}",
                )
            user.date_format = req.date_format

        if req.time_format is not None:
            if req.time_format not in VALID_TIME_FORMATS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid time format: {req.time_format}",
                )
            user.time_format = req.time_format

        if req.ui_preferences is not None:
            current_ui = dict(user.ui_preferences or DEFAULT_UI_PREFERENCES)
            patch = req.ui_preferences.model_dump(exclude_none=True)
            current_ui.update(patch)
            user.ui_preferences = current_ui
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(user, "ui_preferences")

        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def get_notification_preferences(self, user: User) -> dict:
        prefs = user.notification_preferences or {}
        return {**DEFAULT_NOTIFICATION_PREFERENCES, **prefs}

    async def update_notification_preferences(
        self, user: User, req: NotificationPreferencesRequest
    ) -> dict:
        user = await self._attach(user)
        current = dict(user.notification_preferences or DEFAULT_NOTIFICATION_PREFERENCES)
        patch = req.model_dump(exclude_none=True)
        current.update(patch)
        user.notification_preferences = current
        # JSONB mutation detection requires explicit flag
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(user, "notification_preferences")
        await self.db.commit()
        await self.db.refresh(user)
        return user.notification_preferences

    async def delete_account(self, user: User, req: DeleteAccountRequest) -> None:
        user = await self._attach(user)
        if user.email.lower() != req.email.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email address does not match.",
            )
        if not verify_password(req.current_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect password.",
            )
        # Block primary family owners from self-deleting while the family exists
        if user.has_family:
            from app.models.family_member import FamilyMember
            result = await self.db.execute(
                select(FamilyMember).where(
                    FamilyMember.user_id == user.id,
                    FamilyMember.role == "primary",
                )
            )
            if result.scalars().first():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "code": "primary_owner_must_delete_family_first",
                        "detail": "You are the primary account holder. Delete or transfer your family from the Family page before deleting your account.",
                    },
                )
        await self.db.delete(user)
        await self.db.commit()
