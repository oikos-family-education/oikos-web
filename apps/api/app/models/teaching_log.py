import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, DateTime, Date, ForeignKey, SmallInteger, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class TeachingLog(Base):
    __tablename__ = "teaching_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id", ondelete="CASCADE"), nullable=False, index=True)
    taught_on = Column(Date, nullable=False, index=True)
    child_id = Column(UUID(as_uuid=True), ForeignKey("children.id", ondelete="CASCADE"), nullable=True)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    minutes = Column(SmallInteger, nullable=True)
    notes = Column(String(500), nullable=True)
    logged_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "minutes IS NULL OR (minutes > 0 AND minutes <= 720)",
            name="ck_teaching_logs_minutes_range",
        ),
    )
