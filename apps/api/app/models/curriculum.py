import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Date, ForeignKey, SmallInteger, Text
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class CurriculumPeriodType(str, enum.Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    SEMESTER = "semester"
    ANNUAL = "annual"
    CUSTOM = "custom"


class CurriculumStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"
    TEMPLATE = "template"


class TimeSlotPreference(str, enum.Enum):
    MORNING_FIRST = "morning_first"
    MORNING = "morning"
    MIDDAY = "midday"
    AFTERNOON = "afternoon"
    FLEXIBLE = "flexible"


class Curriculum(Base):
    __tablename__ = "curriculums"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id", ondelete="CASCADE"), nullable=True, index=True)

    # Identity
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    # Period
    period_type = Column(String(20), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    academic_year = Column(String(20), nullable=True)
    term_name = Column(String(100), nullable=True)

    # Educational context
    education_philosophy = Column(String(200), nullable=True)

    # Status
    status = Column(String(20), nullable=False, default="draft", index=True)

    # Goals
    overall_goals = Column(ARRAY(String), nullable=False, default=list)
    notes = Column(Text, nullable=True)

    # Audit
    created_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    curriculum_subjects = relationship("CurriculumSubject", back_populates="curriculum", cascade="all, delete-orphan")
    child_curriculums = relationship("ChildCurriculum", back_populates="curriculum", cascade="all, delete-orphan")


class ChildCurriculum(Base):
    __tablename__ = "child_curriculums"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    child_id = Column(UUID(as_uuid=True), ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    curriculum_id = Column(UUID(as_uuid=True), ForeignKey("curriculums.id", ondelete="CASCADE"), nullable=False, index=True)
    joined_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    # Relationships
    curriculum = relationship("Curriculum", back_populates="child_curriculums")


class CurriculumSubject(Base):
    __tablename__ = "curriculum_subjects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    curriculum_id = Column(UUID(as_uuid=True), ForeignKey("curriculums.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)

    # Schedule
    weekly_frequency = Column(SmallInteger, nullable=False, default=5)
    session_duration_minutes = Column(SmallInteger, nullable=False, default=45)
    scheduled_days = Column(ARRAY(SmallInteger), nullable=False, default=list)

    # Time preference
    preferred_time_slot = Column(String(20), default="flexible")

    # Scope
    goals_for_period = Column(ARRAY(String), nullable=False, default=list)

    # Display
    sort_order = Column(SmallInteger, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    curriculum = relationship("Curriculum", back_populates="curriculum_subjects")
