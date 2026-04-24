import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, Date, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, ARRAY

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


VALID_STATUSES = (
    "draft", "todo", "in_progress", "to_remember",
    "completed", "archived", "history_only",
)

VALID_ENTITY_TYPES = ("child", "subject", "resource", "event", "project")


class Note(Base):
    __tablename__ = "notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id", ondelete="CASCADE"), nullable=False, index=True)
    author_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    title = Column(String(255), nullable=True)
    content = Column(Text, nullable=False)

    status = Column(String(20), nullable=False, default="draft")

    entity_type = Column(String(20), nullable=True)
    entity_id = Column(UUID(as_uuid=True), nullable=True)

    tags = Column(ARRAY(String), nullable=False, default=list)
    is_pinned = Column(Boolean, nullable=False, default=False)
    due_date = Column(Date, nullable=True)

    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "status IN ('draft','todo','in_progress','to_remember','completed','archived','history_only')",
            name="ck_notes_status_valid",
        ),
        CheckConstraint(
            "entity_id IS NULL OR entity_type IS NOT NULL",
            name="ck_notes_entity_type_when_id",
        ),
        CheckConstraint(
            "entity_type IS NULL OR entity_type IN ('child','subject','resource','event','project')",
            name="ck_notes_entity_type_valid",
        ),
    )
