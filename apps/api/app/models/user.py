import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

DEFAULT_NOTIFICATION_PREFERENCES = {
    "weekly_summary": True,
    "lesson_reminders": False,
    "lesson_reminder_offset_hours": 1,
    "progress_milestones": True,
    "member_activity": False,
    "platform_news": True,
}

DEFAULT_UI_PREFERENCES = {
    "theme": "light",
    "font_size": "default",
    "reduce_motion": False,
    "high_contrast": False,
    "dyslexia_font": False,
    # Dashboard preference: days before a subject is flagged in "Needs Attention".
    "neglected_threshold_days": 14,
}

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    has_family = Column(Boolean, default=False, nullable=False)
    has_coat_of_arms = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    password_reset_token = Column(String(255), index=True, nullable=True) # Postgresql conditional index added in alembic
    password_reset_token_expires_at = Column(DateTime(timezone=True), nullable=True)

    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)

    # Locale preferences
    timezone = Column(String(100), nullable=False, default="UTC", server_default="UTC")
    locale = Column(String(10), nullable=False, default="en", server_default="en")
    date_format = Column(String(20), nullable=False, default="MM/DD/YYYY", server_default="MM/DD/YYYY")
    time_format = Column(String(5), nullable=False, default="12h", server_default="12h")

    # Notification preferences (JSON blob)
    notification_preferences = Column(
        JSONB,
        nullable=False,
        default=DEFAULT_NOTIFICATION_PREFERENCES,
        server_default='{"weekly_summary":true,"lesson_reminders":false,"lesson_reminder_offset_hours":1,"progress_milestones":true,"member_activity":false,"platform_news":true}',
    )

    # UI / appearance preferences (JSON blob)
    ui_preferences = Column(
        JSONB,
        nullable=False,
        default=DEFAULT_UI_PREFERENCES,
        server_default='{"theme":"light","font_size":"default","reduce_motion":false,"high_contrast":false,"dyslexia_font":false}',
    )
