from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class AppointmentBase(BaseModel):
    patient_id: str
    specialist_id: Optional[str] = None
    appointment_date: datetime
    status: str = "SCHEDULED"
    notes: Optional[str] = None

class AppointmentCreate(AppointmentBase):
    pass

class AppointmentUpdate(BaseModel):
    status: str
    notes: Optional[str] = None
    appointment_date: Optional[datetime] = None

class AppointmentInDBBase(AppointmentBase):
    id: str
    created_at: datetime

    model_config = {"from_attributes": True}

class Appointment(AppointmentInDBBase):
    pass
