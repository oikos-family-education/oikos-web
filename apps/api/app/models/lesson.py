import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, DateTime, Date, ForeignKey, SmallInteger, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


VALID_LESSON_STATUSES = (
    "draft", "scheduled", "in_progress", "completed", "cancelled",
)

VALID_BLOCK_TYPES = (
    "text", "heading", "link", "resource_ref", "checklist",
    "image_url", "video_embed", "divider", "callout",
)


class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    title = Column(String(255), nullable=False)
    scheduled_for = Column(Date, nullable=False)
    estimated_duration_minutes = Column(SmallInteger, nullable=True)

    status = Column(String(20), nullable=False, default="draft")
    objectives = Column(ARRAY(String), nullable=False, default=list)
    tags = Column(ARRAY(String), nullable=False, default=list)

    actual_duration_minutes = Column(SmallInteger, nullable=True)
    completion_notes = Column(Text, nullable=True)
    taught_on = Column(Date, nullable=True)

    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    blocks = relationship(
        "LessonBlock",
        back_populates="lesson",
        cascade="all, delete-orphan",
        order_by="LessonBlock.sort_order",
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('draft','scheduled','in_progress','completed','cancelled')",
            name="ck_lessons_status_valid",
        ),
        CheckConstraint(
            "estimated_duration_minutes IS NULL OR (estimated_duration_minutes > 0 AND estimated_duration_minutes <= 720)",
            name="ck_lessons_estimated_duration_range",
        ),
        CheckConstraint(
            "actual_duration_minutes IS NULL OR (actual_duration_minutes > 0 AND actual_duration_minutes <= 720)",
            name="ck_lessons_actual_duration_range",
        ),
    )


class LessonBlock(Base):
    __tablename__ = "lesson_blocks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False, index=True)
    sort_order = Column(SmallInteger, nullable=False, default=0)

    type = Column(String(30), nullable=False)
    content = Column(JSONB, nullable=False, default=dict)

    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    lesson = relationship("Lesson", back_populates="blocks")

    __table_args__ = (
        CheckConstraint(
            "type IN ('text','heading','link','resource_ref','checklist','image_url','video_embed','divider','callout')",
            name="ck_lesson_blocks_type_valid",
        ),
    )
