import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint, func

from backend.db.base import Base
from backend.models._types import UUID_REFERENCE


class AppointmentSlotReservation(Base):
    """A versioned specialist interval reserved for one booking operation."""

    __tablename__ = "appointment_slot_reservations"
    __table_args__ = (
        UniqueConstraint("operation_id", "schedule_version", name="uq_reservation_operation_version"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    operation_id = Column(
        String(36),
        ForeignKey("appointment_booking_operations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    specialist_id = Column(UUID_REFERENCE, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    appointment_id = Column(UUID_REFERENCE, ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True)
    schedule_version = Column(Integer, nullable=False, default=1)
    starts_at = Column(DateTime(timezone=True), nullable=False, index=True)
    ends_at = Column(DateTime(timezone=True), nullable=False, index=True)
    status = Column(String(30), nullable=False, default="ACTIVE", index=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    released_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

