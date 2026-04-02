from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from backend.core.deps import get_current_user, get_db
from backend.models.appointment import Appointment
from backend.models.patient import Patient
from backend.models.user import User, UserRole
from backend.schemas.appointment import (
    AppointmentCreate,
    AppointmentResponse,
    AppointmentUpdate,
    AvailabilityResponse,
    AppointmentListResponse,
    SpecializationResponse,
    SpecialistResponse,
)
from backend.services.appointment_service import AppointmentService

router = APIRouter()


@router.get(
    "/specializations",
    response_model=List[SpecializationResponse],
    summary="Get All Specializations",
    description="List all available specializations with specialist count",
)
def get_specializations(db: Session = Depends(get_db)) -> Any:
    return AppointmentService.get_specializations(db)


@router.get(
    "/specialists/{specialization}",
    response_model=List[SpecialistResponse],
    summary="Get Specialists by Specialization",
    description="Get all doctors for a given specialization",
)
def get_specialists_by_specialization(
    specialization: str,
    db: Session = Depends(get_db),
) -> Any:
    return AppointmentService.get_specialists_by_specialization(db, specialization)


@router.get(
    "/availability/{specialist_name}",
    response_model=List[AvailabilityResponse],
    summary="Get Specialist Availability",
    description="Get available time slots for a specialist for next 14 days",
)
def get_specialist_availability(
    specialist_name: str,
    days_ahead: int = Query(14, ge=1, le=30, description="Number of days to check (1-30)"),
    db: Session = Depends(get_db),
) -> Any:
    return AppointmentService.get_specialist_availability(db, specialist_name, days_ahead)


@router.post(
    "/",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Appointment",
    description="Create a role-aware appointment",
)
def book_appointment(
    appointment_in: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    result = AppointmentService.create_appointment(db, appointment_in, current_user)
    return result.appointment


@router.patch(
    "/{appointment_id}",
    response_model=AppointmentResponse,
    summary="Update Appointment",
    description="Modify an appointment if you created it or if you are an admin",
)
def update_appointment(
    appointment_id: str,
    appointment_in: AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    result = AppointmentService.update_appointment(db, appointment_id, appointment_in, current_user)
    return result.appointment


@router.delete(
    "/{appointment_id}",
    response_model=AppointmentResponse,
    summary="Cancel Appointment",
    description="Cancel an appointment if you created it or if you are an admin",
)
def delete_appointment(
    appointment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    result = AppointmentService.cancel_appointment(db, appointment_id, current_user)
    return result.appointment


@router.get(
    "/patient/{patient_id}",
    response_model=List[AppointmentResponse],
    summary="Get Appointments by Patient",
    description="Retrieve all appointments for a specific patient",
)
def get_appointments_by_patient(
    patient_id: str,
    status_filter: Optional[str] = Query(
        None,
        alias="status",
        description="Filter by appointment status (PENDING, CONFIRMED, COMPLETED, CANCELLED)",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    return AppointmentService.get_appointments_by_patient(
        db,
        patient_id,
        status_filter,
        current_user=current_user,
    )


@router.get(
    "/specialist/{specialist_name}",
    response_model=AppointmentListResponse,
    summary="Get Appointments by Specialist",
    description="Retrieve appointments for a specific specialist",
)
def get_appointments_by_specialist(
    specialist_name: str,
    date: Optional[str] = Query(None, description="Filter by date (YYYY-MM-DD format)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    if current_user.role not in [UserRole.DOCTOR, UserRole.CLINICAL_SPECIALIST, UserRole.ADMIN, UserRole.FRONTLINE_STAFF]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view appointments",
        )

    return AppointmentService.get_appointments_by_specialist(db, specialist_name, date)


@router.get(
    "/{appointment_id}",
    response_model=AppointmentResponse,
    summary="Get Appointment",
    description="Get a single appointment by ID",
)
def get_appointment(
    appointment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    return AppointmentService.get_appointment_by_id(db, appointment_id, current_user=current_user)


@router.get(
    "/",
    response_model=List[AppointmentResponse],
    summary="List All Appointments",
    description="Retrieve appointments with optional filters",
)
def list_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
) -> Any:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view all appointments",
        )

    appointments = db.query(Appointment).offset(skip).limit(limit).all()
    return [AppointmentService._serialize_appointment(db, apt) for apt in appointments]