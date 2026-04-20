import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Boolean, DateTime, Date, ForeignKey, Integer, SmallInteger, Text,
    UniqueConstraint, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    purpose = Column(Text, nullable=True)
    due_date = Column(Date, nullable=True)
    status = Column(String(20), nullable=False, default="active")  # draft, active, complete, archived

    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
    archived_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)


class ProjectChild(Base):
    __tablename__ = "project_children"

    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, primary_key=True)
    child_id = Column(UUID(as_uuid=True), ForeignKey("children.id", ondelete="CASCADE"), nullable=False, primary_key=True)
    assigned_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class ProjectSubject(Base):
    __tablename__ = "project_subjects"

    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, primary_key=True)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, primary_key=True)
    is_primary = Column(Boolean, nullable=False, default=True)


class ProjectMilestone(Base):
    __tablename__ = "project_milestones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False)
    due_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class MilestoneCompletion(Base):
    __tablename__ = "milestone_completions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    milestone_id = Column(UUID(as_uuid=True), ForeignKey("project_milestones.id", ondelete="CASCADE"), nullable=False, index=True)
    child_id = Column(UUID(as_uuid=True), ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    notes = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("milestone_id", "child_id", name="uq_milestone_child"),
    )


class ProjectResource(Base):
    __tablename__ = "project_resources"

    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, primary_key=True)
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, primary_key=True)
    added_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    notes = Column(Text, nullable=True)


class PortfolioEntry(Base):
    __tablename__ = "portfolio_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    child_id = Column(UUID(as_uuid=True), ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(200), nullable=False)
    reflection = Column(Text, nullable=True)
    parent_notes = Column(Text, nullable=True)
    score = Column(SmallInteger, nullable=True)
    media_urls = Column(ARRAY(String), nullable=False, default=list)

    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("project_id", "child_id", name="uq_portfolio_project_child"),
        CheckConstraint("score IS NULL OR (score >= 1 AND score <= 10)", name="ck_portfolio_score_range"),
    )


class ChildAchievement(Base):
    __tablename__ = "child_achievements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    child_id = Column(UUID(as_uuid=True), ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)

    awarded_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    certificate_number = Column(String(20), nullable=False)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("project_id", "child_id", name="uq_achievement_project_child"),
    )
