from pydantic import BaseModel, Field
from typing import Optional


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenPayload(BaseModel):
    sub: str | None = None


# ============== NEW SCHEMAS FOR STAFF & PATIENT MANAGEMENT ==============

class LoginRequest(BaseModel):
    """Login schema using user_id and password"""
    user_id: str = Field(...,
                         description="User ID (FLS-XXXX, DOC-XXXX, or PAT-XXXX)")
    password: str = Field(..., description="Password")


class ChangePasswordRequest(BaseModel):
    """Schema for changing password"""
    old_password: str = Field(..., description="Current password")
    new_password: str = Field(..., description="New password (must be strong)")


class LoginResponse(BaseModel):
    """Response after successful login with access token"""
    access_token: str = Field(..., description="JWT access token - Use this in Authorization header as 'Bearer <token>'")
    token_type: str = Field(default="bearer", description="Token type (always 'bearer')")
    user_id: str = Field(..., description="User ID (FLS-XXXX, DOC-XXXX, or PAT-XXXX)")
    full_name: str = Field(..., description="User's full name")
    role: str = Field(..., description="User role (FRONTLINE_STAFF, CLINICAL_SPECIALIST, PATIENT)")
    is_first_login: bool = Field(..., description="Flag indicating if user must change password on first login")
