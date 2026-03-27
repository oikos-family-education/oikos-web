import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class ResourceType(str, enum.Enum):
    BOOK = "book"
    ARTICLE = "article"
    VIDEO = "video"
    COURSE = "course"
    PODCAST = "podcast"
    DOCUMENTARY = "documentary"
    PRINTABLE = "printable"
    WEBSITE = "website"
    CURRICULUM = "curriculum"
    OTHER = "other"


class Resource(Base):
    __tablename__ = "resources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    type = Column(String(20), nullable=False)
    author = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class SubjectResource(Base):
    __tablename__ = "subject_resources"

    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), primary_key=True)
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id", ondelete="CASCADE"), primary_key=True)
    progress_notes = Column(String(500), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
