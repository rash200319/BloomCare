import uuid
from sqlalchemy import Column, String, Boolean, Enum, Date, DateTime, func
from sqlalchemy.orm import relationship
import enum
from datetime import datetime
from backend.db.base import Base


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    FRONTLINE_STAFF = "FRONTLINE_STAFF"
    CLINICAL_SPECIALIST = "CLINICAL_SPECIALIST"
    PATIENT = "PATIENT"


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True,
                default=lambda: str(uuid.uuid4()))
    user_id = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    nic = Column(String(100), unique=True, nullable=False, index=True)
    telephone = Column(String(20), nullable=False)
    full_name = Column(String(255), nullable=False)
    birthday = Column(Date, nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False,
                  default=UserRole.FRONTLINE_STAFF, index=True)
    # Only for CLINICAL_SPECIALIST
    specialization = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_first_login = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now())

    # Relationships
    patients = relationship(
        "Patient", back_populates="user", foreign_keys="Patient.user_id")
