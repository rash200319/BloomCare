import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.db.base import Base
from backend.models._types import UUID_REFERENCE


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(UUID_REFERENCE, primary_key=True,
                default=lambda: str(uuid.uuid4()))
    patient_id = Column(UUID_REFERENCE, ForeignKey(
        "patients.id", ondelete="CASCADE"))
    specialist_id = Column(UUID_REFERENCE, ForeignKey(
        "users.id", ondelete="SET NULL"))
    created_by_id = Column(UUID_REFERENCE, ForeignKey(
        "users.id", ondelete="SET NULL"), nullable=True)
    created_by_role = Column(String(50), nullable=False, default="FRONTLINE_STAFF")
    appointment_type = Column(String(100), nullable=False, default="PRENATAL_CHECKUP")
    appointment_date = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, default=30)  # Appointment duration in minutes
    queue_number = Column(Integer, nullable=True)  # Queue number for the day
    status = Column(String(50), default="PENDING")  # PENDING, CONFIRMED, COMPLETED, CANCELLED
    notes = Column(Text)
    booking_operation_id = Column(String(36), nullable=True, unique=True, index=True)
    schedule_version = Column(Integer, nullable=False, default=1)
    completed_by_id = Column(UUID_REFERENCE, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_by_id = Column(UUID_REFERENCE, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    reason_for_cancellation = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient", backref="appointments")
    specialist = relationship("User", foreign_keys=[specialist_id], backref="assigned_appointments")
    creator = relationship("User", foreign_keys=[created_by_id], backref="created_appointments")
