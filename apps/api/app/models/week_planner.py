import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, SmallInteger, Text, Integer
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class WeekTemplate(Base):
    __tablename__ = "week_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id", ondelete="CASCADE"), nullable=False, index=True)

    # Identity
    name = Column(String(200), nullable=False)
    is_active = Column(Boolean, nullable=False, default=False, index=True)

    # Audit
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    entries = relationship("RoutineEntry", back_populates="template", cascade="all, delete-orphan")


class RoutineEntry(Base):
    __tablename__ = "routine_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id = Column(UUID(as_uuid=True), ForeignKey("week_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id", ondelete="CASCADE"), nullable=False, index=True)

    # Subject (null for Free Time)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True)
    is_free_time = Column(Boolean, nullable=False, default=False)

    # Children
    child_ids = Column(ARRAY(UUID(as_uuid=True)), nullable=False, default=list)

    # Schedule
    day_of_week = Column(SmallInteger, nullable=False)  # 0=Monday .. 6=Sunday
    start_minute = Column(Integer, nullable=False)  # minutes from midnight, e.g. 540 = 09:00
    duration_minutes = Column(SmallInteger, nullable=False, default=45)

    # Metadata
    priority = Column(String(10), nullable=False, default="medium")  # high, medium, low
    color = Column(String(7), nullable=True)  # hex, inherited from subject if not set
    notes = Column(Text, nullable=True)

    # Audit
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    template = relationship("WeekTemplate", back_populates="entries")
