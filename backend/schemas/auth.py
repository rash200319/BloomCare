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
    """Patient first-login password setup"""
    national_id: str = Field(..., description="Patient national ID")
    password: str = Field(..., description="New password")
    confirm_password: str = Field(..., description="Confirm new password")


class FirstLoginStaffSetupRequest(BaseModel):
    """Staff/doctor first-login password setup"""
    email: str = Field(..., description="Staff/doctor email")
    password: str = Field(..., description="New password")
    confirm_password: str = Field(..., description="Confirm new password")


class ChangePasswordRequest(BaseModel):
    """Schema for changing password"""
    old_password: str = Field(..., description="Current password")
    new_password: str = Field(..., description="New password (must be strong)")


class LoginResponse(BaseModel):
    """Response after successful login with access token"""
    access_token: str = Field(..., description="JWT access token - Use this in Authorization header as 'Bearer <token>'")
    token_type: str = Field(default="bearer", description="Token type (always 'bearer')")
    id: str = Field(..., description="User primary key")
    full_name: str = Field(..., description="User's full name")
    role: str = Field(..., description="User role (FRONTLINE_STAFF, CLINICAL_SPECIALIST, PATIENT)")
    is_first_login: bool = Field(..., description="Flag indicating if user must change password on first login")
