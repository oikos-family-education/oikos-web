import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship

from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class Family(Base):
    __tablename__ = "families"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    family_name = Column(String(80), nullable=False)
    family_name_slug = Column(String(100), unique=True, index=True, nullable=False)
    shield_config = Column(JSON, nullable=False, default=dict)

    location_city = Column(String(100), nullable=True)
    location_region = Column(String(100), nullable=True)
    location_country = Column(String(100), nullable=True)
    location_country_code = Column(String(2), index=True, nullable=True)

    faith_tradition = Column(String(30), index=True, nullable=True)
    faith_denomination = Column(String(80), nullable=True)
    faith_community_name = Column(String(120), nullable=True)
    worldview_notes = Column(String(300), nullable=True)

    education_methods = Column(ARRAY(String), nullable=False, default=list)
    current_curriculum = Column(ARRAY(String), nullable=False, default=list)

    diet = Column(String(30), nullable=True)
    screen_policy = Column(String(20), nullable=True)
    outdoor_orientation = Column(String(30), nullable=True)
    home_languages = Column(ARRAY(String), nullable=False, default=list)
    lifestyle_tags = Column(ARRAY(String), nullable=False, default=list)

    family_culture = Column(String(2000), nullable=True)
    visibility = Column(String(10), default="private", nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    children = relationship("Child", back_populates="family", cascade="all, delete-orphan")
