import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Date, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship

from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class Child(Base):
    __tablename__ = "children"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id", ondelete="CASCADE"), nullable=False, index=True)

    first_name = Column(String(60), nullable=False)
    nickname = Column(String(40), nullable=True)
    gender = Column(String(20), nullable=True)
    avatar_initials = Column(String(2), nullable=True)

    birthdate = Column(Date, nullable=True)
    birth_year = Column(Integer, nullable=True)
    birth_month = Column(Integer, nullable=True)
    grade_level = Column(String(20), nullable=True)

    child_curriculum = Column(ARRAY(String), nullable=False, default=list)
    learning_styles = Column(ARRAY(String), nullable=False, default=list)

    personality_description = Column(String(1000), nullable=True)
    personality_tags = Column(ARRAY(String), nullable=False, default=list)
    interests = Column(ARRAY(String), nullable=False, default=list)
    motivators = Column(String(200), nullable=True)
    demotivators = Column(String(200), nullable=True)

    learning_differences = Column(ARRAY(String), nullable=False, default=list)
    accommodations_notes = Column(String(500), nullable=True)
    support_services = Column(ARRAY(String), nullable=False, default=list)

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    family = relationship("Family", back_populates="children")
