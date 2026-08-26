import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text, func

from backend.db.base import Base


class WorkflowOutbox(Base):
    """Transactional request to start a Temporal workflow."""

    __tablename__ = "workflow_outbox"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    operation_id = Column(
        String(36),
        ForeignKey("appointment_booking_operations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    event_type = Column(String(100), nullable=False, default="START_APPOINTMENT_BOOKING")
    payload = Column(JSON, nullable=False)
    status = Column(String(30), nullable=False, default="PENDING", index=True)
    attempt_count = Column(Integer, nullable=False, default=0)
    available_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    dispatched_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


