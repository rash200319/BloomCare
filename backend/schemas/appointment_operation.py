from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class BookingOperationStatus(str, Enum):
    REQUESTED = "REQUESTED"
    VALIDATING = "VALIDATING"
    RESERVING_SLOT = "RESERVING_SLOT"
    CREATING_APPOINTMENT = "CREATING_APPOINTMENT"
    AWAITING_CONFIRMATION = "AWAITING_CONFIRMATION"
    CONFIRMED = "CONFIRMED"
    REMINDER_SCHEDULED = "REMINDER_SCHEDULED"
    RESCHEDULED = "RESCHEDULED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    FAILED = "FAILED"


class AppointmentBookingRequest(BaseModel):
    specialist_id: str = Field(..., min_length=1)
    appointment_date: datetime
    duration_minutes: int = Field(default=30, ge=15, le=240)
    appointment_type: str = Field(default="PRENATAL_CHECKUP", min_length=1, max_length=100)
    notes: Optional[str] = Field(default=None, max_length=2000)
    idempotency_key: str = Field(..., min_length=8, max_length=255)


class AppointmentOperationAccepted(BaseModel):
    operation_id: str
    workflow_id: str
    status: BookingOperationStatus
    appointment_id: Optional[str] = None
    status_url: str
    orchestration_notice: Optional[str] = None


class AppointmentOperationResponse(BaseModel):
    operation_id: str
    workflow_id: str
    patient_id: str
    specialist_id: str
    patient_name: Optional[str] = None
    specialist_name: Optional[str] = None
    appointment_id: Optional[str] = None
    appointment_date: datetime
    duration_minutes: int
    appointment_type: str
    status: BookingOperationStatus
    schedule_version: int
    decision_reason: Optional[str] = None
    reschedule_reason: Optional[str] = None
    confirmation_deadline: Optional[datetime] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    orchestration_notice: Optional[str] = None


class AppointmentDecision(str, Enum):
    CONFIRM = "CONFIRM"
    CANCEL = "CANCEL"
    COMPLETE = "COMPLETE"


class AppointmentDecisionRequest(BaseModel):
    decision: AppointmentDecision
    reason: Optional[str] = Field(default=None, max_length=1000)


class AppointmentRescheduleRequest(BaseModel):
    appointment_date: datetime
    duration_minutes: Optional[int] = Field(default=None, ge=15, le=240)
    reason: Optional[str] = Field(default=None, max_length=1000)


class AppointmentWorkflowCommandResponse(BaseModel):
    operation_id: str
    status: BookingOperationStatus
    message: str
