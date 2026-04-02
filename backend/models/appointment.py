import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.db.base import Base


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(String(36), primary_key=True,
                default=lambda: str(uuid.uuid4()))
    patient_id = Column(String(36), ForeignKey(
        "patients.id", ondelete="CASCADE"))
    specialist_id = Column(String(36), ForeignKey(
        "users.id", ondelete="SET NULL"))
    appointment_date = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, default=30)  # Appointment duration in minutes
    queue_number = Column(Integer, nullable=True)  # Queue number for the day
    status = Column(String(50), default="SCHEDULED")  # SCHEDULED, COMPLETED, CANCELLED
    notes = Column(String)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient", backref="appointments")
    specialist = relationship("User", backref="appointments")
