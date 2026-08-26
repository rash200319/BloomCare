from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, func

from backend.db.base import Base
from backend.models._types import UUID_REFERENCE


class PatientNotificationPreference(Base):
    """Patient-owned reminder language, channels, timing, and destinations."""

    __tablename__ = "patient_notification_preferences"

    patient_id = Column(
        UUID_REFERENCE,
        ForeignKey("patients.id", ondelete="CASCADE"),
        primary_key=True,
    )
    preferred_language = Column(String(2), nullable=False, default="EN")
    reminders_enabled = Column(Boolean, nullable=False, default=True)
    in_app_enabled = Column(Boolean, nullable=False, default=True)
    sms_enabled = Column(Boolean, nullable=False, default=False)
    email_enabled = Column(Boolean, nullable=False, default=False)
    push_enabled = Column(Boolean, nullable=False, default=False)
    reminder_hours = Column(String(100), nullable=False, default="24,2")
    phone_number = Column(String(50), nullable=True)
    email_address = Column(String(255), nullable=True)
    push_token = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
