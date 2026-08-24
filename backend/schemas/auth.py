from pydantic import BaseModel, Field
from typing import Optional


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenPayload(BaseModel):
    sub: str | None = None


# ============== NEW SCHEMAS FOR STAFF & PATIENT MANAGEMENT ==============

class PatientLoginRequest(BaseModel):
    """Patient login schema"""
    national_id: str = Field(..., description="Patient national ID")
    password: str = Field(..., description="Password")


class StaffLoginRequest(BaseModel):
    """Frontline staff and doctor login schema"""
    email: str = Field(..., description="Staff/doctor email")
    password: str = Field(..., description="Password")


class FirstLoginPatientSetupRequest(BaseModel):
    """Patient first-login password setup — requires issued temporary password."""
    national_id: str = Field(..., description="Patient national ID")
    temporary_password: str = Field(..., description="Temporary password issued at registration")
    password: str = Field(..., description="New password")
    confirm_password: str = Field(..., description="Confirm new password")


class FirstLoginStaffSetupRequest(BaseModel):
    """Staff/doctor first-login password setup — requires issued temporary password."""
    email: str = Field(..., description="Staff/doctor email")
    temporary_password: str = Field(..., description="Temporary password issued at registration")
    password: str = Field(..., description="New password")
    confirm_password: str = Field(..., description="Confirm new password")


class ChangePasswordRequest(BaseModel):
    """Schema for changing password"""
    old_password: str = Field(..., description="Current password")
    new_password: str = Field(..., description="New password (must be strong)")


class ProfileUpdateRequest(BaseModel):
    """Schema for updating the authenticated user's profile"""
    full_name: Optional[str] = Field(default=None, description="Updated full name")
    phone_number: Optional[str] = Field(default=None, description="Staff/doctor/admin phone number")
    contact_number: Optional[str] = Field(default=None, description="Patient contact number")
    emergency_contact: Optional[str] = Field(default=None, description="Patient emergency contact number")


class ProfileResponse(BaseModel):
    """Authenticated profile details"""
    id: str
    role: str
    full_name: str
    email: Optional[str] = None
    national_id: Optional[str] = None
    phone_number: Optional[str] = None
    contact_number: Optional[str] = None
    emergency_contact: Optional[str] = None


class LoginResponse(BaseModel):
    """Response after successful login with access token"""
    access_token: str = Field(
        ..., description="JWT access token - Use this in Authorization header as 'Bearer <token>'")
    token_type: str = Field(
        default="bearer", description="Token type (always 'bearer')")
    id: str = Field(..., description="User primary key")
    full_name: str = Field(..., description="User's full name")
    role: str = Field(..., description="User role (FRONTLINE_STAFF, DOCTOR, CLINICAL_SPECIALIST, PATIENT)")
    is_first_login: bool = Field(
        ..., description="Flag indicating if user must change password on first login")


# ============== PASSWORD RESET SCHEMAS ==============

class PatientPasswordResetRequest(BaseModel):
    """Request OTP for patient password reset"""
    national_id: str = Field(..., description="Patient national ID")


class PatientPasswordResetOTPVerify(BaseModel):
    """Verify OTP and reset patient password"""
    national_id: str = Field(..., description="Patient national ID")
    otp_code: str = Field(..., description="6-digit OTP code")
    new_password: str = Field(..., description="New password (must be strong)")
    confirm_password: str = Field(..., description="Confirm new password")


class StaffPasswordResetRequest(BaseModel):
    """Request OTP for staff password reset"""
    email: str = Field(..., description="Staff/doctor email")


class StaffPasswordResetOTPVerify(BaseModel):
    """Verify OTP and reset staff password"""
    email: str = Field(..., description="Staff/doctor email")
    otp_code: str = Field(..., description="6-digit OTP code")
    new_password: str = Field(..., description="New password (must be strong)")
    confirm_password: str = Field(..., description="Confirm new password")


class PasswordResetResponse(BaseModel):
    """Response for password reset operations"""
    message: str = Field(..., description="Operation message")
    otp_sent: Optional[bool] = Field(None, description="Whether OTP was sent")
    destination_masked: Optional[str] = Field(
        None, description="Masked email or phone number")
    expires_in_seconds: Optional[int] = Field(
        None, description="OTP expiration time in seconds")
    password_reset: Optional[bool] = Field(
        None, description="Whether password was reset successfully")
