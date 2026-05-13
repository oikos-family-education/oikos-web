from pydantic import BaseModel, Field, model_validator
from typing import Literal, Optional
from datetime import datetime


class UpdateNameRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=10, max_length=128)
    confirm_password: str

    @model_validator(mode="after")
    def check_passwords_match(self) -> "ChangePasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self


class UiPreferencesRequest(BaseModel):
    theme: Optional[Literal["light", "dark", "system"]] = None
    font_size: Optional[Literal["default", "large", "xl"]] = None
    reduce_motion: Optional[bool] = None
    high_contrast: Optional[bool] = None
    dyslexia_font: Optional[bool] = None


class UiPreferencesResponse(BaseModel):
    theme: str
    font_size: str
    reduce_motion: bool
    high_contrast: bool
    dyslexia_font: bool


class UpdatePreferencesRequest(BaseModel):
    timezone: Optional[str] = Field(None, max_length=100)
    locale: Optional[str] = Field(None, max_length=10)
    date_format: Optional[str] = Field(None, max_length=20)
    time_format: Optional[str] = Field(None, max_length=5)
    ui_preferences: Optional[UiPreferencesRequest] = None


class NotificationPreferencesRequest(BaseModel):
    weekly_summary: Optional[bool] = None
    lesson_reminders: Optional[bool] = None
    lesson_reminder_offset_hours: Optional[int] = Field(None, ge=1, le=48)
    progress_milestones: Optional[bool] = None
    member_activity: Optional[bool] = None
    platform_news: Optional[bool] = None


class NotificationPreferencesResponse(BaseModel):
    weekly_summary: bool
    lesson_reminders: bool
    lesson_reminder_offset_hours: int
    progress_milestones: bool
    member_activity: bool
    platform_news: bool


class UserSettingsResponse(BaseModel):
    id: str
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    last_login_at: Optional[datetime]
    timezone: str
    locale: str
    date_format: str
    time_format: str
    notification_preferences: NotificationPreferencesResponse
    ui_preferences: UiPreferencesResponse

    class Config:
        from_attributes = True


class DeleteAccountRequest(BaseModel):
    email: str
    current_password: str
