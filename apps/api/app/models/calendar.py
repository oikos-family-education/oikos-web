import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, ARRAY

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # family | subject | project | curriculum
    event_type = Column(String(20), nullable=False, default="family")

    all_day = Column(Boolean, nullable=False, default=False)
    start_at = Column(DateTime(timezone=True), nullable=False)
    end_at = Column(DateTime(timezone=True), nullable=False)

    child_ids = Column(ARRAY(UUID(as_uuid=True)), nullable=False, default=list)

    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    milestone_id = Column(UUID(as_uuid=True), ForeignKey("project_milestones.id", ondelete="SET NULL"), nullable=True)

    color = Column(String(7), nullable=True)
    location = Column(String(255), nullable=True)

    # none | weekly | monthly | yearly
    recurrence = Column(String(10), nullable=False, default="none")

    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
