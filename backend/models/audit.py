import uuid
from sqlalchemy import Column, String, DateTime, Text, func
from backend.db.base import Base


class AuditEvent(Base):
    """PHI access / security-relevant events (opt-in via BLOOMCARE_AUDIT_LOG_ENABLED)."""

    __tablename__ = "audit_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    actor_id = Column(String(36), nullable=True, index=True)
    actor_role = Column(String(50), nullable=True)
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(50), nullable=False, default="patient")
    resource_id = Column(String(36), nullable=True, index=True)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)
