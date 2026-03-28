from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

class PatientBase(BaseModel):
    national_id: Optional[str] = None
    full_name: str
    date_of_birth: Optional[date] = None
    contact_number: Optional[str] = None

class PatientCreate(PatientBase):
    pass

class PatientUpdate(PatientBase):
    pass

class PatientInDBBase(PatientBase):
    id: str
    created_at: datetime

    model_config = {"from_attributes": True}

class Patient(PatientInDBBase):
    pass
