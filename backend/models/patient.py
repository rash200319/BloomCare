import uuid
from sqlalchemy import Column, String, Integer, DateTime
from datetime import datetime
from db.base import Base

class Patient(Base):
    __tablename__ = "patients"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    national_id = Column(String, unique=True, index=True)
    full_name = Column(String, nullable=False)
    date_of_birth = Column(DateTime, nullable=True)
    contact_number = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
