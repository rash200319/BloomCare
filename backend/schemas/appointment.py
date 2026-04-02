from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, time
from uuid import UUID


class AppointmentCreate(BaseModel):
    """Schema for creating/booking an appointment"""
    patient_id: str = Field(..., description="Patient primary key")
    specialist_name: str = Field(..., description="Specialist's full name")
    appointment_date: datetime = Field(..., description="Appointment date and time")
    duration_minutes: int = Field(default=30, description="Appointment duration in minutes (default: 30)")
    notes: Optional[str] = Field(None, description="Additional notes")


class AppointmentResponse(BaseModel):
    """Response schema with full appointment details"""
    id: UUID
    patient_id: UUID
    patient_name: str = Field(..., description="Patient's full name")
    specialist_id: Optional[UUID] = None
    specialist_name: Optional[str] = Field(None, description="Specialist's full name")
    appointment_date: datetime
    duration_minutes: int
    queue_number: Optional[int] = Field(None, description="Queue number for the day")
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SpecialistResponse(BaseModel):
    """Response schema for specialist/doctor details"""
    id: str
    full_name: str
    specialization: str
    phone_number: Optional[str] = None
    email: str

    model_config = {"from_attributes": True}


class TimeSlot(BaseModel):
    """Single time slot for appointments"""
    start_time: datetime
    end_time: datetime
    is_available: bool
    booked_by: Optional[str] = None  # Patient name if booked


class AvailabilityResponse(BaseModel):
    """Response for specialist availability"""
    specialist_id: str
    specialist_name: str
    specialization: str
    date: str  # YYYY-MM-DD format
    available_slots: list[TimeSlot]
    total_available: int


class AppointmentListResponse(BaseModel):
    """Response for listing appointments by specialist"""
    specialist_name: str
    specialization: str
    date: str  # YYYY-MM-DD format
    appointments: list[AppointmentResponse]
    total_appointments: int


class SpecializationResponse(BaseModel):
    """Response for list of specializations"""
    specialization: str
    specialist_count: int
