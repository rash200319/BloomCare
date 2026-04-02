from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import date
from uuid import UUID
from backend.models.user import UserRole


class CreateStaffRequest(BaseModel):
    """Request schema for creating staff members"""
    full_name: str = Field(..., description="Full name of the staff member")
    nic: str = Field(..., description="National ID/NIC")
    telephone: str = Field(..., description="Telephone number")
    birthday: Optional[date] = Field(None, description="Date of birth")
    email: EmailStr = Field(..., description="Email address")
    role: UserRole = Field(...,
                           description="Role: FRONTLINE_STAFF or CLINICAL_SPECIALIST")
    specialization: Optional[str] = Field(
        None, description="Specialization (only for CLINICAL_SPECIALIST)")


class StaffResponse(BaseModel):
    """Response schema for staff members"""
    id: str | UUID
    user_id: Optional[str] = None
    full_name: str
    nic: Optional[str] = None
    telephone: Optional[str] = None
    email: str
    birthday: Optional[date] = None
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
    """Response when staff/patient is created with temporary password"""
    user_id: str
    temporary_password: str
    full_name: str
    email: str
    role: str


class StaffFilterRequest(BaseModel):
    """Request schema for filtering staff"""
    full_name: Optional[str] = None
    user_id: Optional[str] = None
    nic: Optional[str] = None
    role: Optional[UserRole] = None
