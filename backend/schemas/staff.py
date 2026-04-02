from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID
from backend.models.user import UserRole


class CreateStaffRequest(BaseModel):
    """Request schema for creating staff members"""
    full_name: str = Field(..., description="Full name of the staff member")
    email: EmailStr = Field(..., description="Email address")
    phone_number: Optional[str] = Field(None, description="Phone number")
    role: UserRole = Field(...,
                           description="Role: FRONTLINE_STAFF or CLINICAL_SPECIALIST")
    specialization: Optional[str] = Field(
        None, description="Specialization (only for CLINICAL_SPECIALIST)")


class StaffResponse(BaseModel):
    """Response schema for staff members"""
    id: str | UUID
    full_name: str
    email: str
    phone_number: Optional[str] = None
    role: str
    specialization: Optional[str] = None
    is_active: bool

    model_config = {"from_attributes": True}
    
    def model_dump(self, **kwargs):
        """Convert UUID to string in output"""
        data = super().model_dump(**kwargs)
        if isinstance(data.get('id'), UUID):
            data['id'] = str(data['id'])
        return data


class TemporaryPasswordResponse(BaseModel):
    """Response when staff or patient is registered"""
    id: str
    full_name: str
    email: str
    role: str
    is_first_login: bool


class StaffFilterRequest(BaseModel):
    """Request schema for filtering staff"""
    full_name: Optional[str] = None
    id: Optional[str] = None
    email: Optional[str] = None
    role: Optional[UserRole] = None
