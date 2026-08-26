import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func

from backend.db.base import Base
from backend.models._types import UUID_REFERENCE


class AppointmentBookingOperation(Base):
    """Durable API-facing state for an asynchronous appointment booking."""

    __tablename__ = "appointment_booking_operations"
    __table_args__ = (
        UniqueConstraint("patient_id", "idempotency_key", name="uq_booking_patient_idempotency"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_id = Column(String(255), unique=True, nullable=False, index=True)
    idempotency_key = Column(String(255), nullable=False)

    patient_id = Column(UUID_REFERENCE, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    specialist_id = Column(UUID_REFERENCE, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    appointment_id = Column(UUID_REFERENCE, ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True, index=True)

    appointment_date = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, nullable=False, default=30)
    appointment_type = Column(String(100), nullable=False, default="PRENATAL_CHECKUP")
    notes = Column(Text, nullable=True)

    status = Column(String(50), nullable=False, default="REQUESTED", index=True)
    schedule_version = Column(Integer, nullable=False, default=1)
    decision_reason = Column(Text, nullable=True)
    reschedule_reason = Column(Text, nullable=True)
    confirmation_deadline = Column(DateTime(timezone=True), nullable=True)
    error_code = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
