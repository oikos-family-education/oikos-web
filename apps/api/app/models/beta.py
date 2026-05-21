import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


VALID_BETA_STATUSES = ("pending", "approved", "denied")


class BetaApplication(Base):
    __tablename__ = "beta_applications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    reason = Column(Text, nullable=False)

    status = Column(String(20), nullable=False, default="pending", index=True)
    internal_note = Column(Text, nullable=True)

    applied_at = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    decided_by_admin_email = Column(String(255), nullable=True)

    # Invite token (only set once approved). Stored hashed.
    invite_token_hash = Column(String(255), index=True, nullable=True)
    invite_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    invite_sent_at = Column(DateTime(timezone=True), nullable=True)
    invite_consumed_at = Column(DateTime(timezone=True), nullable=True)
    registered_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','approved','denied')",
            name="ck_beta_applications_status_valid",
        ),
    )


class AdminAllowlist(Base):
    __tablename__ = "admin_allowlist"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    added_by_admin_email = Column(String(255), nullable=True)
    added_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ts = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    actor_email = Column(String(255), nullable=False, index=True)
    action = Column(String(64), nullable=False, index=True)
    target_type = Column(String(32), nullable=True)
    target_id = Column(String(64), nullable=True)
    target_email = Column(String(255), nullable=True, index=True)
    reason = Column(Text, nullable=True)
    snapshot = Column(JSONB, nullable=True)

    __table_args__ = (
        Index("ix_audit_log_action_ts", "action", "ts"),
    )
