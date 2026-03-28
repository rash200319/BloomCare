import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from db.base import Base

class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"))
    specialist_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    appointment_date = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(50), default="SCHEDULED")
    notes = Column(String)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    patient = relationship("Patient", backref="appointments")
    specialist = relationship("User", backref="appointments")
