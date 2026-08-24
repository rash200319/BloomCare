"""OTP (One-Time Password) model for password reset and authentication flows."""

import uuid
from datetime import datetime, timedelta
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Enum, ForeignKey, Index
import enum
from backend.db.base import Base


class OTPType(str, enum.Enum):
    """Types of OTP usage."""
    PASSWORD_RESET = "PASSWORD_RESET"
    FIRST_LOGIN = "FIRST_LOGIN"
    LOGIN_VERIFICATION = "LOGIN_VERIFICATION"
    ACCOUNT_VERIFICATION = "ACCOUNT_VERIFICATION"


class OTPRecord(Base):
    __tablename__ = "otp_records"

    id = Column(String(36), primary_key=True,
                default=lambda: str(uuid.uuid4()))

    # User References (patient or staff)
    patient_id = Column(String(36), ForeignKey(
        "patients.id", ondelete="CASCADE"), nullable=True)
    staff_id = Column(String(36), ForeignKey(
        "users.id", ondelete="CASCADE"), nullable=True)

    # OTP Data — otp_code is a legacy placeholder; only otp_hash is verified.
    otp_code = Column(String(6), nullable=False, index=True)
    otp_hash = Column(String(255), nullable=False)  # HMAC hash; never store plaintext OTP
    otp_type = Column(Enum(OTPType), nullable=False, index=True)
    destination = Column(String(255), nullable=False)  # Phone number or email

    # Verification Status
    is_verified = Column(Boolean, default=False, index=True)
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=5)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    verified_at = Column(DateTime, nullable=True)

    # Request Metadata
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(512), nullable=True)

    # Indexes for common queries
    __table_args__ = (
        Index('idx_patient_otp', 'patient_id', 'otp_type'),
        Index('idx_staff_otp', 'staff_id', 'otp_type'),
        Index('idx_expired_otps', 'expires_at', 'is_verified'),
    )

    def is_expired(self) -> bool:
        """Check if OTP has expired."""
        return datetime.utcnow() > self.expires_at

    def can_attempt(self) -> bool:
        """Check if user can make another verification attempt."""
        return self.attempts < self.max_attempts

    def increment_attempts(self):
        """Increment failed attempt counter."""
        self.attempts += 1
