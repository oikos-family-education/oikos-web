import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class EmailBlacklist(Base):
    """Emails barred from creating new accounts (populated by bans)."""

    __tablename__ = "email_blacklist"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    source_action = Column(String(64), nullable=True)  # usually 'user.ban'
    source_actor_email = Column(String(255), nullable=True)
    reason = Column(String(2000), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
