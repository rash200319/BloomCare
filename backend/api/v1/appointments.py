from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from backend.core.deps import get_db, get_current_user
from backend.models.user import User, UserRole
from backend.schemas.appointment import (
    AppointmentCreate, AppointmentResponse, SpecialistResponse,
    AvailabilityResponse, AppointmentListResponse, SpecializationResponse
)
from backend.services.appointment_service import AppointmentService

router = APIRouter()


@router.get(
    "/specializations",
    response_model=List[SpecializationResponse],
    summary="Get All Specializations",
    description="List all available specializations with specialist count"
)
def get_specializations(db: Session = Depends(get_db)) -> Any:
    """
    Get list of all specializations available at the clinic.
    Each specialization shows the number of specialists.
    
    Returns:
    - **specialization**: Name of the specialization
    - **specialist_count**: Number of specialists in that field
    """
    return AppointmentService.get_specializations(db)


@router.get(
    "/specialists/{specialization}",
    response_model=List[SpecialistResponse],
    summary="Get Specialists by Specialization",
    description="Get all doctors for a given specialization"
)
def get_specialists_by_specialization(
    specialization: str,
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all active specialists for a given specialization.
    
    - **specialization**: Name of specialization (e.g., "Obstetrics", "Cardiology")
    
    Returns list of specialists with their details:
    - user_id, full_name, specialization, contact info
    """
    return AppointmentService.get_specialists_by_specialization(db, specialization)


@router.get(
    "/availability/{specialist_name}",
    response_model=List[AvailabilityResponse],
    summary="Get Specialist Availability",
    description="Get available time slots for a specialist for next 14 days"
)
def get_specialist_availability(
    specialist_name: str,
    days_ahead: int = Query(14, ge=1, le=30, description="Number of days to check (1-30)"),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get available appointment slots for a specialist.
    
    - **specialist_name**: Name of the specialist
    - **days_ahead**: Number of days to check ahead (default: 14, max: 30)
    
    Returns availability for each day with:
    - Available and booked time slots
    - Each slot is 30 minutes
    - Working hours: 8 AM to 5 PM
    - Weekends excluded
    """
    return AppointmentService.get_specialist_availability(
        db, specialist_name, days_ahead
    )


@router.post(
    "/",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Book Appointment",
    description="Create and book a new appointment"
)
def book_appointment(
    appointment_in: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Book an appointment for a patient with a specialist.
    
    **Request:**
    - **patient_id**: Patient's user ID (PAT-XXXX)
    - **specialist_name**: Specialist's full name
    - **appointment_date**: Date and time (ISO format)
    - **duration_minutes**: Duration in minutes (default: 30)
    - **notes**: Additional notes (optional)
    
    **Validation:**
    - Patient must exist
    - Specialist must be active clinical specialist
    - No double booking allowed
    - Date must be in the future
    
    **Returns:**
    - Appointment details with assigned queue number
    """
    # Only patients and admins can book appointments
    if current_user.role not in [UserRole.PATIENT, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients and admins can book appointments"
        )
    
    return AppointmentService.book_appointment(
        db,
        appointment_in.patient_id,
        appointment_in.specialist_name,
        appointment_in.appointment_date,
        appointment_in.duration_minutes,
        appointment_in.notes
    )


@router.get(
    "/specialist/{specialist_name}",
    response_model=AppointmentListResponse,
    summary="Get Appointments by Specialist",
    description="Retrieve appointments for a specific specialist"
)
def get_appointments_by_specialist(
    specialist_name: str,
    date: Optional[str] = Query(
        None,
        description="Filter by date (YYYY-MM-DD format)"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Get all appointments for a specialist, optionally filtered by date.
    
    **Parameters:**
    - **specialist_name**: Name of the specialist
    - **date**: Optional date filter (YYYY-MM-DD)
    
    **Returns:**
    - List of appointments ordered by queue number
    - Includes patient names and appointment details
    
    **Access:**
    - Only specialists, admins, and clinical staff can view
    """
    # Only specialists and admins can view appointments
    if current_user.role not in [UserRole.CLINICAL_SPECIALIST, UserRole.ADMIN, UserRole.FRONTLINE_STAFF]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view appointments"
        )
    
    return AppointmentService.get_appointments_by_specialist(db, specialist_name, date)


@router.get(
    "/",
    response_model=List[AppointmentResponse],
    summary="List All Appointments",
    description="Retrieve appointments with optional filters"
)
def list_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
) -> Any:
    """
    List all appointments (admin only).
    
    **Query Parameters:**
    - **skip**: Number of records to skip (for pagination)
    - **limit**: Maximum records to return (1-500)
    
    **Returns:**
    - List of appointments with full details
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view all appointments"
        )
    
    from backend.models.appointment import Appointment
    from backend.models.patient import Patient
    
    appointments = db.query(Appointment).offset(skip).limit(limit).all()
    
    result = []
    for apt in appointments:
        specialist = apt.specialist or None
        patient = db.query(Patient).filter(Patient.id == apt.patient_id).first()
        
        result.append(
            AppointmentResponse(
                id=apt.id,
                patient_id=apt.patient_id,
                patient_name=patient.full_name if patient else "Unknown",
                specialist_id=str(apt.specialist_id) if apt.specialist_id else None,
                specialist_name=specialist.full_name if specialist else None,
                appointment_date=apt.appointment_date,
                duration_minutes=apt.duration_minutes,
                queue_number=apt.queue_number,
                status=apt.status,
                notes=apt.notes,
                created_at=apt.created_at,
                updated_at=apt.updated_at
            )
        )
    
    return result
