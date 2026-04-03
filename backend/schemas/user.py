from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
import re
import uuid


PHONE_PATTERN = re.compile(r"^(?:\+94\d{9}|0\d{9})$")


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: str = "FRONTLINE_STAFF"
    is_active: bool = True


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    """Schema for updating user details - only allows updating phone_number and full_name"""
    full_name: Optional[str] = None
    phone_number: Optional[str] = None

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().replace(" ", "")
        if not normalized:
            return None
        if not PHONE_PATTERN.match(normalized):
            raise ValueError(
                "phone number must be in +94XXXXXXXXX or 0XXXXXXXXX format"
            )
        return normalized


class UserInDBBase(UserBase):
    id: str
    phone_number: Optional[str] = None

    model_config = {"from_attributes": True}


class User(UserInDBBase):
    pass


class UserDetailResponse(UserInDBBase):
    """Response schema for user details"""
    specialization: Optional[str] = None
