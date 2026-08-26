import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.db.base import Base
from backend.models._types import UUID_REFERENCE


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID_REFERENCE, primary_key=True, default=lambda: str(uuid.uuid4()))
    # Recipient may be a staff user or a patient (stored in separate tables).
    # Authorization is enforced by the API/service using recipient_type.
    recipient_id = Column(UUID_REFERENCE, nullable=False, index=True)
    recipient_type = Column(String(30), nullable=False, default="STAFF")
    appointment_id = Column(UUID_REFERENCE, ForeignKey("appointments.id", ondelete="CASCADE"), nullable=True)
    
    notification_type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    
    related_data = Column(JSON, nullable=True)
    deduplication_key = Column(String(255), nullable=True, unique=True, index=True)
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    # Relationships
    appointment = relationship("Appointment", backref="notifications")
