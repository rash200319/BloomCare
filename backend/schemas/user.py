from pydantic import BaseModel, EmailStr
from typing import Optional
import uuid

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: str = "FRONTLINE_STAFF"
    is_active: bool = True

class UserCreate(UserBase):
    password: str

class UserUpdate(UserBase):
    password: Optional[str] = None

class UserInDBBase(UserBase):
    id: uuid.UUID

    model_config = {"from_attributes": True}

class User(UserInDBBase):
    pass
