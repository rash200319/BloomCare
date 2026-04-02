import uuid
from sqlalchemy import Column, String, Integer, DateTime, Date, ForeignKey, func
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.db.base import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(String(36), primary_key=True,
                default=lambda: str(uuid.uuid4()))
    user_id = Column(String(50), ForeignKey(
        "users.user_id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    national_id = Column(String(100), unique=True, index=True, nullable=True)
    full_name = Column(String(255), nullable=False)
    age = Column(Integer, nullable=True)
    date_of_birth = Column(Date, nullable=True)
    contact_number = Column(String(50), nullable=True)
    emergency_contact = Column(String(50), nullable=True)
    blood_group = Column(String(10), nullable=True)
    due_date = Column(Date, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    assigned_worker_id = Column(String(36), ForeignKey(
        "users.id", ondelete="SET NULL"), nullable=True)
    registered_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="patients",
                        foreign_keys=[user_id])
