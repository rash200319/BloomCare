import uuid
from sqlalchemy import Column, String, Boolean, Enum, DateTime, Integer, func
import enum
from backend.db.base import Base


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    FRONTLINE_STAFF = "FRONTLINE_STAFF"
    DOCTOR = "DOCTOR"
    CLINICAL_SPECIALIST = "CLINICAL_SPECIALIST"
    PATIENT = "PATIENT"


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True,
                default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False,
                  default=UserRole.FRONTLINE_STAFF, index=True)
    specialization = Column(String(100), nullable=True)
    phone_number = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)
    first_time_login = Column(Boolean, default=True)
    # Bumped by logout-all / password change to invalidate outstanding JWTs
    token_version = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now())
