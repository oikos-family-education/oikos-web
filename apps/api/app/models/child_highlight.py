import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Date, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


# Things a parent records about a child to include in the child report
HIGHLIGHT_CATEGORIES = ("social", "book", "documentary", "outdoor", "other")


class ChildHighlight(Base):
    __tablename__ = "child_highlights"
    __table_args__ = (
        CheckConstraint(
            "category IN ('social','book','documentary','outdoor','other')",
            name="ck_child_highlights_category",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id = Column(UUID(as_uuid=True), ForeignKey("families.id", ondelete="CASCADE"), nullable=False, index=True)
    child_id = Column(UUID(as_uuid=True), ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)

    category = Column(String(20), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    # Optional: recurring things (e.g. weekly co-op) have no single date
    occurred_on = Column(Date, nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
