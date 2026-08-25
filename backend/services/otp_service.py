"""OTP (One-Time Password) service for password reset and authentication."""

import secrets
import hashlib
import hmac
from datetime import datetime, timedelta
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from backend.models.otp import OTPRecord, OTPType
from backend.core.config import settings

_OTP_CODE_PLACEHOLDER = "******"


class OTPService:
    """Service for generating, sending, and verifying OTPs."""

    OTP_LENGTH = 6
    OTP_EXPIRY_MINUTES = 10
    OTP_MAX_ATTEMPTS = 5

    @staticmethod
    def generate_otp() -> str:
        """Generate a cryptographically secure 6-digit OTP."""
        return "".join(secrets.choice("0123456789") for _ in range(OTPService.OTP_LENGTH))

    @staticmethod
    def hash_otp(otp: str) -> str:
        """HMAC-SHA256 with SECRET_KEY as pepper."""
        key = (settings.SECRET_KEY or "").encode("utf-8")
        return hmac.new(key, otp.encode("utf-8"), hashlib.sha256).hexdigest()

    @staticmethod
    def verify_hash(otp: str, otp_hash: str) -> bool:
        """Verify OTP against stored hash (constant-time)."""
        return hmac.compare_digest(OTPService.hash_otp(otp), otp_hash or "")

    @staticmethod
    def create_patient_otp(
        db: Session,
        patient_id: str,
        otp_type: OTPType,
        destination: str,
        ip_address: str = None,
        user_agent: str = None,
    ) -> tuple[str, OTPRecord]:
        db.query(OTPRecord).filter(
            OTPRecord.patient_id == patient_id,
            OTPRecord.otp_type == otp_type,
            OTPRecord.is_verified == False,
        ).delete()

        plaintext_otp = OTPService.generate_otp()
        otp_hash = OTPService.hash_otp(plaintext_otp)

        otp_record = OTPRecord(
            patient_id=patient_id,
            otp_code=_OTP_CODE_PLACEHOLDER,
            otp_hash=otp_hash,
            otp_type=otp_type,
            destination=destination,
            expires_at=datetime.utcnow() + timedelta(minutes=OTPService.OTP_EXPIRY_MINUTES),
            ip_address=ip_address,
            user_agent=user_agent,
            max_attempts=OTPService.OTP_MAX_ATTEMPTS,
        )
        db.add(otp_record)
        db.commit()
        db.refresh(otp_record)
        return plaintext_otp, otp_record

    @staticmethod
    def create_staff_otp(
        db: Session,
        staff_id: str,
        otp_type: OTPType,
        destination: str,
        ip_address: str = None,
        user_agent: str = None,
    ) -> tuple[str, OTPRecord]:
        db.query(OTPRecord).filter(
            OTPRecord.staff_id == staff_id,
            OTPRecord.otp_type == otp_type,
            OTPRecord.is_verified == False,
        ).delete()

        plaintext_otp = OTPService.generate_otp()
        otp_hash = OTPService.hash_otp(plaintext_otp)

        otp_record = OTPRecord(
            staff_id=staff_id,
            otp_code=_OTP_CODE_PLACEHOLDER,
            otp_hash=otp_hash,
            otp_type=otp_type,
            destination=destination,
            expires_at=datetime.utcnow() + timedelta(minutes=OTPService.OTP_EXPIRY_MINUTES),
            ip_address=ip_address,
            user_agent=user_agent,
            max_attempts=OTPService.OTP_MAX_ATTEMPTS,
        )
        db.add(otp_record)
        db.commit()
        db.refresh(otp_record)
        return plaintext_otp, otp_record

    @staticmethod
    def verify_patient_otp(
        db: Session,
        patient_id: str,
        otp_code: str,
        otp_type: OTPType
    ) -> bool:
        """
        Verify OTP for patient.

        Raises HTTPException on invalid/expired OTP.
        Returns True if verification successful.
        """
        otp_record = db.query(OTPRecord).filter(
            OTPRecord.patient_id == patient_id,
            OTPRecord.otp_type == otp_type,
            OTPRecord.is_verified == False
        ).order_by(OTPRecord.created_at.desc()).first()

        if not otp_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No OTP request found. Please request a new OTP."
            )

        if otp_record.is_expired():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP has expired. Please request a new one."
            )

        if not otp_record.can_attempt():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed attempts. Please request a new OTP."
            )

        if not OTPService.verify_hash(otp_code, otp_record.otp_hash):
            otp_record.increment_attempts()
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid OTP. Attempts remaining: {otp_record.max_attempts - otp_record.attempts}/5"
            )

        # Mark as verified
        otp_record.is_verified = True
        otp_record.verified_at = datetime.utcnow()
        db.commit()

        return True

    @staticmethod
    def verify_staff_otp(
        db: Session,
        staff_id: str,
        otp_code: str,
        otp_type: OTPType
    ) -> bool:
        """
        Verify OTP for staff.

        Raises HTTPException on invalid/expired OTP.
        Returns True if verification successful.
        """
        otp_record = db.query(OTPRecord).filter(
            OTPRecord.staff_id == staff_id,
            OTPRecord.otp_type == otp_type,
            OTPRecord.is_verified == False
        ).order_by(OTPRecord.created_at.desc()).first()

        if not otp_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No OTP request found. Please request a new OTP."
            )

        if otp_record.is_expired():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP has expired. Please request a new one."
            )

        if not otp_record.can_attempt():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed attempts. Please request a new OTP."
            )

        if not OTPService.verify_hash(otp_code, otp_record.otp_hash):
            otp_record.increment_attempts()
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid OTP. Attempts remaining: {otp_record.max_attempts - otp_record.attempts}/5"
            )

        # Mark as verified
        otp_record.is_verified = True
        otp_record.verified_at = datetime.utcnow()
        db.commit()

        return True

    @staticmethod
    def mask_contact(contact: str, contact_type: str = "email") -> str:
        """
        Mask email or phone number for display.

        Email: user****@domain.com
        Phone: +947712****01
        """
        if contact_type == "email":
            parts = contact.split("@")
            if len(parts) == 2:
                local = parts[0]
                domain = parts[1]
                masked_local = local[0] + "*" * \
                    (len(local) - 2) + local[-1] if len(local) > 2 else local
                return f"{masked_local}@{domain}"
            return contact

        elif contact_type == "phone":
            # Mask middle digits of phone number
            if len(contact) >= 10:
                return contact[:4] + "*" * (len(contact) - 8) + contact[-2:]
            return contact

        return contact

    @staticmethod
    def cleanup_expired_otps(db: Session) -> int:
        """
        Delete expired OTPs from database.

        Returns: number of OTPs deleted
        """
        result = db.query(OTPRecord).filter(
            OTPRecord.expires_at < datetime.utcnow()
        ).delete()
        db.commit()
        return result
