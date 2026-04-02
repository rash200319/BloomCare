import uuid
from sqlalchemy import Column, String, Integer, DateTime, Date, ForeignKey, Boolean, func
from backend.db.base import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(String(36), primary_key=True,
                default=lambda: str(uuid.uuid4()))
    national_id = Column(String(100), unique=True, index=True, nullable=True)
    full_name = Column(String(255), nullable=False)
    age = Column(Integer, nullable=True)
    due_date = Column(Date, nullable=True)
    contact_number = Column(String(50), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    emergency_contact = Column(String(50), nullable=True)
    blood_group = Column(String(10), nullable=True)
    first_time_login = Column(Boolean, default=True)
    assigned_worker_id = Column(String(36), ForeignKey(
        "users.id", ondelete="SET NULL"), nullable=True)
    registered_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now())
