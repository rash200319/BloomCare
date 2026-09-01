from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from backend.core.deps import get_current_user, get_current_active_user, get_db
from backend.models.appointment import Appointment
from backend.models.patient import Patient
from backend.models.user import User, UserRole
from backend.schemas.appointment import (
    AppointmentCreate,
    AppointmentCreateByNIC,
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
def get_specializations(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
) -> Any:
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
    _current_user: User = Depends(get_current_active_user),
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
    days_ahead: int = Query(
        14, ge=1, le=30, description="Number of days to check (1-30)"),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
) -> Any:
    return AppointmentService.get_specialist_availability(db, specialist_name, days_ahead)


@router.post(
    "/by-nic",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Appointment by Patient NIC",
    description="Create appointment using patient national ID, full name, specialist name, date, type, and notes",
)
def create_appointment_by_nic(
    appointment_in: AppointmentCreateByNIC,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Create a new appointment using patient NIC instead of patient_id.

    **Required Fields:**
    - **patient_nic**: Patient's national ID (e.g., "NIC-900000001V")
    - **patient_full_name**: Patient's full name (verified against NIC)
    - **specialist_name**: Specialist's full name (e.g., "Dr. John Smith")
    - **appointment_date**: Appointment date and time (ISO 8601 format)
    - **appointment_type**: Type of appointment (PRENATAL_CHECKUP, ULTRASOUND_SCAN, etc)
    - **notes**: Additional appointment notes (optional)
    - **duration_minutes**: Appointment duration in minutes (default: 30)

    **Example Request:**
    ```json
    {
        "patient_nic": "NIC-900000001V",
        "patient_full_name": "Nimalka Fernando",
        "specialist_name": "Dr. Sarah Johnson",
        "appointment_date": "2026-04-15T10:30:00",
        "appointment_type": "PRENATAL_CHECKUP",
        "notes": "Patient reports ongoing headaches",
        "duration_minutes": 30
    }
    ```
    """
    result = AppointmentService.create_appointment_by_nic(
        db,
        appointment_in.patient_nic,
        appointment_in.patient_full_name,
        appointment_in.specialist_name,
        appointment_in.appointment_date,
        appointment_in.appointment_type,
        appointment_in.notes,
        appointment_in.duration_minutes,
        current_user,
    )
    return result.appointment


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
    result = AppointmentService.create_appointment(
        db, appointment_in, current_user)
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
    result = AppointmentService.update_appointment(
        db, appointment_id, appointment_in, current_user)
    return result.appointment


@router.patch(
    "/{appointment_id}/status",
    response_model=AppointmentResponse,
    summary="Update Appointment Status",
    description="Update appointment status - specialists can update their own assignments",
)
def update_appointment_status(
    appointment_id: str,
    status_update: AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Update only the status of an appointment.
    Specialists can update appointments assigned to them.
    """
    appointment = db.query(Appointment).filter(
        Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Appointment '{appointment_id}' not found",
        )

    if not AppointmentService._can_update_appointment_status(current_user, appointment):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the assigned specialist or creator can update this appointment status",
        )

    if not status_update.status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be provided",
        )

    requested_status = AppointmentService._normalize_status(
        status_update.status)
    AppointmentService._ensure_allowed_status_transition(
        appointment.status, requested_status)
    
    old_status = appointment.status
    actor_id = str(getattr(current_user, "id", "") or "") or None
    appointment.status = requested_status

    if requested_status == "CANCELLED":
        cancellation_reason = getattr(status_update, "notes", None)
        if cancellation_reason:
            appointment.reason_for_cancellation = cancellation_reason
        appointment.cancelled_by_id = actor_id
        appointment.cancelled_at = datetime.now(timezone.utc)
    elif requested_status == "COMPLETED":
        appointment.completed_by_id = actor_id
        appointment.completed_at = datetime.now(timezone.utc)

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to save appointment status: {exc}",
        ) from exc
    db.refresh(appointment)

    # Create notifications for status changes
    from backend.services.notification_service import NotificationService
    from backend.models.patient import Patient
    import sys
    
    try:
        patient = db.query(Patient).filter(Patient.id == appointment.patient_id).first()
        print(f"[NOTIFICATION] Status change: {old_status} → {requested_status}", file=sys.stderr)
        print(f"[NOTIFICATION] Appointment created_by_id: {appointment.created_by_id}", file=sys.stderr)
        print(f"[NOTIFICATION] Patient found: {patient is not None}", file=sys.stderr)
        
        # Send notification to staff member who created the appointment for status changes
        if appointment.created_by_id and patient:
            if requested_status == "CONFIRMED" and old_status != "CONFIRMED":
                # Appointment confirmed by doctor
                print(f"[NOTIFICATION] Creating CONFIRMED notification", file=sys.stderr)
                NotificationService.create_appointment_confirmation_notification(
                    db,
                    recipient_id=appointment.created_by_id,
                    appointment_id=appointment_id,
                    patient_name=patient.full_name,
                    specialist_name=current_user.full_name or "Unknown",
                    appointment_date=appointment.appointment_date,
                )
                print(f"[NOTIFICATION] CONFIRMED notification created", file=sys.stderr)
            
            elif requested_status == "CANCELLED" and old_status != "CANCELLED":
                # Appointment cancelled by doctor or admin
                print(f"[NOTIFICATION] Creating CANCELLED notification", file=sys.stderr)
                NotificationService.create_appointment_notification(db, appointment, "CANCELLED")
                print(f"[NOTIFICATION] CANCELLED notification created", file=sys.stderr)
            
            elif requested_status == "COMPLETED" and old_status != "COMPLETED":
                # Appointment completed
                print(f"[NOTIFICATION] Creating COMPLETED notification", file=sys.stderr)
                NotificationService.create_appointment_notification(db, appointment, "COMPLETED")
                print(f"[NOTIFICATION] COMPLETED notification created", file=sys.stderr)
            else:
                print(f"[NOTIFICATION] No notification sent for status {requested_status}", file=sys.stderr)
        else:
            print(f"[NOTIFICATION] Skipping - created_by_id or patient is missing", file=sys.stderr)
    except Exception as e:
        import traceback
        print(f"[NOTIFICATION ERROR] Error creating notification: {e}", file=sys.stderr)
        print(f"[NOTIFICATION TRACEBACK] {traceback.format_exc()}", file=sys.stderr)
        # Don't fail the appointment update if notification creation fails
        pass

    return AppointmentService._serialize_appointment(db, appointment)


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
    result = AppointmentService.cancel_appointment(
        db, appointment_id, current_user)
    return result.appointment


@router.get(
    "/created-by/me",
    response_model=List[AppointmentResponse],
    summary="Get Appointments Created By Current User",
    description="Retrieve appointments created by the currently authenticated user",
)
def get_my_created_appointments(
    status_filter: Optional[str] = Query(
        None,
        alias="status",
        description="Filter by appointment status (PENDING, CONFIRMED, SCHEDULED, COMPLETED, CANCELLED)",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    return AppointmentService.get_appointments_created_by_user(
        db,
        current_user,
        status_filter,
    )


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
    date: Optional[str] = Query(
        None, description="Filter by date (YYYY-MM-DD format)"),
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
    summary="List Appointments",
    description="Retrieve appointments with optional filters. Specialists see only HIGH/MODERATE risk patients, admins see all",
)
def list_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    specialist_id: Optional[str] = Query(
        None, description="Filter by specialist ID"),
    appointment_status: Optional[str] = Query(
        None, description="Filter by status (PENDING, CONFIRMED, SCHEDULED, COMPLETED, CANCELLED)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
) -> Any:
    from sqlalchemy import and_, or_
    from backend.models.screening import Stage1Screening

    query = db.query(Appointment)

    # Specialists should always see appointments assigned to them.
    # In addition, include unassigned high-risk cases for triage workflows.
    if current_user.role in [UserRole.DOCTOR, UserRole.CLINICAL_SPECIALIST]:
        # Subquery to get patient IDs with high/moderate risk (escalate classification)
        high_risk_patients = db.query(Stage1Screening.patient_id).filter(
            Stage1Screening.edge_risk_classification == 'escalate',
            Stage1Screening.patient_id.isnot(None)
        ).distinct()

        # Show appointments where:
        # 1. Appointment is assigned to current specialist, OR
        # 2. Appointment is unassigned and patient is high-risk.
        query = query.filter(
            or_(
                Appointment.specialist_id == current_user.id,
                and_(
                    Appointment.specialist_id == None,  # noqa: E712
                    Appointment.patient_id.in_(high_risk_patients),
                ),
            )
        )
    # If specialist_id is provided in query params, use it (for backwards compatibility)
    elif specialist_id:
        high_risk_patients = db.query(Stage1Screening.patient_id).filter(
            Stage1Screening.edge_risk_classification == 'escalate',
            Stage1Screening.patient_id.isnot(None)
        ).distinct()
        query = query.filter(
            and_(
                Appointment.patient_id.in_(high_risk_patients),
                or_(
                    Appointment.specialist_id == specialist_id,
                    Appointment.specialist_id == None  # noqa: E712
                )
            )
        )
    # Otherwise only admins can view all without filtering
    elif current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view appointments",
        )

    # Filter by status if provided
    if appointment_status:
        query = query.filter(Appointment.status == appointment_status.upper())

    # Sort by appointment date
    appointments = query.order_by(
        Appointment.appointment_date).offset(skip).limit(limit).all()
    return [AppointmentService._serialize_appointment(db, apt) for apt in appointments]
