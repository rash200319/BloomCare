from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class PrescriptionCreate(BaseModel):
    patient_id: str
    medication_name: str = Field(..., min_length=1, max_length=255)
    dosage: Optional[str] = Field(default=None, max_length=100)
    frequency: Optional[str] = Field(default=None, max_length=100)
    route: Optional[str] = Field(default=None, max_length=50)
    instructions: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: bool = True
    stage2_diagnostic_id: Optional[str] = None


class PrescriptionResponse(BaseModel):
    id: str
    patient_id: str
    specialist_id: Optional[str] = None
    stage2_diagnostic_id: Optional[str] = None
    medication_name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    route: Optional[str] = None
    instructions: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
