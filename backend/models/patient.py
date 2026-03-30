import uuid
from sqlalchemy import Column, String, Integer, DateTime, Date, ForeignKey
from datetime import datetime
from db.base import Base

class Patient(Base):
    __tablename__ = "patients"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    national_id = Column(String, unique=True, index=True)
    full_name = Column(String, nullable=False)
    age = Column(Integer, nullable=True)
    date_of_birth = Column(Date, nullable=True)
    contact_number = Column(String, nullable=True)
    emergency_contact = Column(String, nullable=True)
    blood_group = Column(String, nullable=True)
    assigned_worker_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column("registered_at", DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
