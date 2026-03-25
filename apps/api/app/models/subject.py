import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, SmallInteger, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, ARRAY
import enum

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class SubjectCategory(str, enum.Enum):
    CORE_ACADEMIC = "core_academic"
    LANGUAGE = "language"
    SCRIPTURE_THEOLOGY = "scripture_theology"
    ARTS = "arts"
    PHYSICAL = "physical"
    PRACTICAL_LIFE = "practical_life"
    LOGIC_RHETORIC = "logic_rhetoric"
    TECHNOLOGY = "technology"
    ELECTIVE = "elective"
    CO_OP = "co_op"
    OTHER = "other"


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id", ondelete="CASCADE"), nullable=True, index=True)

    # Identity
    name = Column(String(200), nullable=False)
    slug = Column(String(250), nullable=False)
    short_description = Column(String(500), nullable=True)
    long_description = Column(Text, nullable=True)

    # Classification
    category = Column(String(30), nullable=False)

    # Visual identity
    color = Column(String(7), nullable=False, default="#6366F1")
    icon = Column(String(50), nullable=True)

    # Age & Grade guidance
    min_age_years = Column(SmallInteger, nullable=True)
    max_age_years = Column(SmallInteger, nullable=True)
    min_grade_level = Column(SmallInteger, nullable=True)
    max_grade_level = Column(SmallInteger, nullable=True)

    # Priority (1=High, 2=Medium, 3=Low)
    priority = Column(SmallInteger, nullable=False, default=2)

    # Session defaults
    default_session_duration_minutes = Column(SmallInteger, default=45)
    default_weekly_frequency = Column(SmallInteger, default=5)

    # Competencies
    learning_objectives = Column(ARRAY(String), nullable=False, default=list)
    skills_targeted = Column(ARRAY(String), nullable=False, default=list)
    prerequisite_subject_ids = Column(ARRAY(UUID(as_uuid=True)), nullable=False, default=list)

    # Visibility
    is_platform_subject = Column(Boolean, nullable=False, default=False)
    is_public = Column(Boolean, nullable=False, default=False)

    # Audit
    created_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
