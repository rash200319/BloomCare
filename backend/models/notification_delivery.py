import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func

from backend.db.base import Base
from backend.models._types import UUID_REFERENCE


class NotificationDelivery(Base):
    """Idempotency and audit record for orchestration notifications."""

    __tablename__ = "notification_deliveries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    idempotency_key = Column(String(255), nullable=False, unique=True, index=True)
    operation_id = Column(
        String(36),
        ForeignKey("appointment_booking_operations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    appointment_id = Column(UUID_REFERENCE, ForeignKey("appointments.id", ondelete="CASCADE"), nullable=True)
    recipient_id = Column(UUID_REFERENCE, nullable=False, index=True)
    recipient_type = Column(String(30), nullable=False)
    channel = Column(String(30), nullable=False, default="IN_APP")
    notification_type = Column(String(100), nullable=False)
    schedule_version = Column(Integer, nullable=False, default=1)
    status = Column(String(30), nullable=False, default="PENDING")
    attempt_count = Column(Integer, nullable=False, default=0)
    provider_message_id = Column(String(255), nullable=True)
    last_error = Column(Text, nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
