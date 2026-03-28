import uuid
from sqlalchemy import Column, String, Boolean, Enum
import enum
from ..db.base import Base

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    FRONTLINE_STAFF = "FRONTLINE_STAFF"
    CLINICAL_SPECIALIST = "CLINICAL_SPECIALIST"
    PATIENT = "PATIENT"

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.FRONTLINE_STAFF)
    is_active = Column(Boolean, default=True)
