"""
Appointment Management Service
Handles appointment scheduling, role-based access, creator tracking, and status transitions.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, func, text
from sqlalchemy.orm import Session

from backend.models.appointment import Appointment
from backend.models.patient import Patient
from backend.models.screening import Stage1Screening, Stage2Diagnostic
from backend.models.user import User, UserRole
from backend.schemas.appointment import (
    AppointmentActionResponse,
    AppointmentCreate,
    AppointmentListResponse,
    AppointmentResponse,
    AppointmentUpdate,
    AvailabilityResponse,
    SpecializationResponse,
    SpecialistResponse,
    TimeSlot,
)



def _AS():
    """Late-bound combined AppointmentService (avoids circular imports)."""
    from backend.services.appointment_service import AppointmentService
    return AppointmentService


class AppointmentBooking:
    @staticmethod
    def create_appointment(
        db: Session,
        appointment_in: AppointmentCreate,
        current_user: object,
    ) -> AppointmentActionResponse:
        role = _AS()._normalize_role(
            getattr(current_user, "role", ""))
        if role == UserRole.PATIENT.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Patients cannot create appointments",
            )

        patient = _AS()._resolve_patient(
            db, appointment_in.patient_id)
        specialist = _AS()._resolve_specialist(
            db,
            appointment_in.specialist_id,
            appointment_in.specialist_name,
        )

        appointment_type = _AS()._normalize_type(
            appointment_in.appointment_type)
        if appointment_type is None:
            appointment_type = _AS()._default_appointment_type(
                role)

        _AS()._validate_role_for_type(role, appointment_type)

        # Ensure appointment_date is timezone-aware (UTC) for comparison with database records
        appointment_date = appointment_in.appointment_date
        if appointment_date.tzinfo is None:
            appointment_date = appointment_date.replace(tzinfo=timezone.utc)

        now = datetime.now(timezone.utc)
        if appointment_date < now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Appointment date must be in the future",
            )

        # Check for double booking by fetching appointments in a time window
        new_appointment_end = appointment_date + \
            timedelta(minutes=appointment_in.duration_minutes)

        existing_appointments = db.query(Appointment).filter(
            and_(
                Appointment.specialist_id == specialist.id,
                Appointment.status != "CANCELLED",
            )
        ).all()

        # Check for overlaps in Python
        for existing in existing_appointments:
            # Ensure existing appointment date is timezone-aware (SQLite returns naive datetimes)
            existing_apt_date = existing.appointment_date
            if existing_apt_date.tzinfo is None:
                existing_apt_date = existing_apt_date.replace(
                    tzinfo=timezone.utc)

            existing_end = existing_apt_date + \
                timedelta(minutes=existing.duration_minutes)
            # Check if new appointment overlaps with existing: new_start < existing_end AND new_end > existing_start
            if appointment_date < existing_end and new_appointment_end > existing_apt_date:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This time slot is already booked for the specialist",
                )

        # Get next queue number for the day
        # Create timezone-aware start and end of day
        appointment_day = appointment_date.date()
        day_start = datetime.combine(
            appointment_day, datetime.min.time()).replace(tzinfo=timezone.utc)
        day_end = datetime.combine(
            appointment_day, datetime.max.time()).replace(tzinfo=timezone.utc)

        queue_count = db.query(func.count(Appointment.id)).filter(
            and_(
                Appointment.specialist_id == specialist.id,
                Appointment.appointment_date >= day_start,
                Appointment.appointment_date < day_end,
                Appointment.status != "CANCELLED",
            )
        ).scalar() or 0
        queue_number = queue_count + 1

        creator_id = str(getattr(current_user, "id", "")) if getattr(current_user, "id", None) else None
        import sys
        print(f"[CREATE-APT] current_user.id: {getattr(current_user, 'id', 'NO-ID')}, creator_id: {creator_id}", file=sys.stderr)
        
        appointment = Appointment(
            id=str(__import__("uuid").uuid4()),
            patient_id=patient.id,
            specialist_id=specialist.id,
            created_by_id=creator_id,
            created_by_role=role,
            appointment_type=appointment_type,
            appointment_date=appointment_date,
            duration_minutes=appointment_in.duration_minutes,
            queue_number=queue_number,
            status="PENDING",
            notes=appointment_in.notes,
        )

        db.add(appointment)
        db.commit()
        db.refresh(appointment)

        return AppointmentActionResponse(
            appointment=_AS()._serialize_appointment(
                db, appointment, patient=patient, specialist=specialist),
            message="Appointment created successfully",
        )

    @staticmethod
    def create_appointment_by_nic(
        db: Session,
        patient_nic: str,
        patient_full_name: str,
        specialist_name: str,
        appointment_date: datetime,
        appointment_type: str = "PRENATAL_CHECKUP",
        notes: Optional[str] = None,
        duration_minutes: int = 30,
        current_user: object = None,
    ) -> AppointmentActionResponse:
        """Create appointment using patient NIC instead of patient_id"""

        # Resolve patient by national_id
        patient = db.query(Patient).filter(
            Patient.national_id == patient_nic).first()
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Patient with NIC '{patient_nic}' not found",
            )

        # Verify patient full name matches
        if patient.full_name.lower() != patient_full_name.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Patient name mismatch. Expected '{patient.full_name}', got '{patient_full_name}'",
            )

        # Resolve specialist by full_name
        specialist = db.query(User).filter(
            User.full_name == specialist_name,
            User.role.in_([UserRole.CLINICAL_SPECIALIST.value]),
        ).first()
        if not specialist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Specialist '{specialist_name}' not found",
            )

        # Normalize appointment type
        normalized_type = _AS()._normalize_type(appointment_type)
        if normalized_type is None:
            normalized_type = "PRENATAL_CHECKUP"

        # Ensure appointment_date is timezone-aware (UTC) for comparison
        apt_date = appointment_date
        if apt_date.tzinfo is None:
            apt_date = apt_date.replace(tzinfo=timezone.utc)

        # Validate appointment date is in future
        now = datetime.now(timezone.utc)
        if apt_date < now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Appointment date must be in the future",
            )

        # Check for double booking using SQLite-compatible query
        appointment_date_str = apt_date.isoformat()
        appointment_end = apt_date + timedelta(minutes=duration_minutes)
        appointment_end_str = appointment_end.isoformat()

        overlapping = db.execute(
            text(
                """
                SELECT COUNT(*) FROM appointments
                WHERE specialist_id = :specialist_id
                AND status NOT IN ('CANCELLED', 'COMPLETED')
                AND appointment_date < :end_time
                AND datetime(appointment_date, '+' || duration_minutes || ' minutes') > :start_time
                """
            ),
            {
                "specialist_id": str(specialist.id),
                "start_time": appointment_date_str,
                "end_time": appointment_end_str,
            },
        ).scalar()

        if overlapping and overlapping > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This time slot is already booked for the specialist",
            )

        # Get queue number for the day (SQLite-compatible)
        queue_number = db.execute(
            text(
                """
                SELECT COALESCE(MAX(queue_number), 0) + 1
                FROM appointments
                WHERE specialist_id = :specialist_id
                AND DATE(appointment_date) = DATE(:appointment_date)
                AND status NOT IN ('CANCELLED', 'COMPLETED')
                """
            ),
            {
                "specialist_id": str(specialist.id),
                "appointment_date": appointment_date_str,
            },
        ).scalar() or 1

        # Capture creator information from current_user
        creator_id = None
        creator_role = "SYSTEM"
        if current_user:
            creator_id = str(getattr(current_user, "id", "")) if getattr(current_user, "id", None) else None
            creator_role = _AS()._normalize_role(getattr(current_user, "role", ""))
            import sys
            print(f"[CREATE-APT-NIC] current_user.id: {getattr(current_user, 'id', 'NO-ID')}, creator_id: {creator_id}, creator_role: {creator_role}", file=sys.stderr)

        # Create appointment
        appointment = Appointment(
            id=str(__import__("uuid").uuid4()),
            patient_id=patient.id,
            specialist_id=specialist.id,
            created_by_id=creator_id,
            created_by_role=creator_role,
            appointment_type=normalized_type,
            appointment_date=apt_date,
            duration_minutes=duration_minutes,
            queue_number=queue_number,
            status="PENDING",
            notes=notes,
        )

        db.add(appointment)
        db.commit()
        db.refresh(appointment)

        return AppointmentActionResponse(
            appointment=_AS()._serialize_appointment(
                db, appointment, patient=patient, specialist=specialist),
            message="Appointment created successfully",
        )

    @staticmethod
    def update_appointment(
        db: Session,
        appointment_id: str,
        appointment_in: AppointmentUpdate,
        current_user: object,
    ) -> AppointmentActionResponse:
        appointment = db.query(Appointment).filter(
            Appointment.id == appointment_id).first()
        if not appointment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Appointment '{appointment_id}' not found",
            )

        if not _AS()._can_manage_appointment(current_user, appointment):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator or an admin can modify this appointment",
            )

        if appointment_in.status is not None:
            requested_status = _AS()._normalize_status(
                appointment_in.status)
            _AS()._ensure_allowed_status_transition(
                appointment.status, requested_status)
            appointment.status = requested_status

        if appointment_in.appointment_date is not None:
            # Ensure appointment_date is timezone-aware (UTC) for comparison
            update_appointment_date = appointment_in.appointment_date
            if update_appointment_date.tzinfo is None:
                update_appointment_date = update_appointment_date.replace(
                    tzinfo=timezone.utc)

            now = datetime.now(timezone.utc)
            if update_appointment_date < now:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Appointment date must be in the future",
                )
            appointment.appointment_date = update_appointment_date

        if appointment_in.duration_minutes is not None:
            appointment.duration_minutes = appointment_in.duration_minutes

        if appointment_in.appointment_type is not None:
            normalized_type = _AS()._normalize_type(
                appointment_in.appointment_type)
            if normalized_type not in _AS().ALL_APPOINTMENT_TYPES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported appointment type '{appointment_in.appointment_type}'",
                )
            _AS()._validate_role_for_type(
                getattr(current_user, "role", ""), normalized_type)
            appointment.appointment_type = normalized_type

        if appointment_in.notes is not None:
            appointment.notes = appointment_in.notes

        db.commit()
        db.refresh(appointment)

        return AppointmentActionResponse(
            appointment=_AS()._serialize_appointment(
                db, appointment),
            message="Appointment updated successfully",
        )

    @staticmethod
    def cancel_appointment(
        db: Session,
        appointment_id: str,
        current_user: object,
    ) -> AppointmentActionResponse:
        appointment = db.query(Appointment).filter(
            Appointment.id == appointment_id).first()
        if not appointment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Appointment '{appointment_id}' not found",
            )

        if not _AS()._can_manage_appointment(current_user, appointment):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator or an admin can cancel this appointment",
            )

        appointment.status = "CANCELLED"
        db.commit()
        db.refresh(appointment)

        # Create cancellation notification for FLS
        from backend.services.notification_service import NotificationService
        from backend.models.patient import Patient
        import sys
        
        try:
            patient = db.query(Patient).filter(Patient.id == appointment.patient_id).first()
            specialist_name = getattr(current_user, "full_name", "Unknown")
            
            print(f"[DELETE-CANCEL] Creating cancellation notification", file=sys.stderr)
            print(f"[DELETE-CANCEL] Appointment created_by_id: {appointment.created_by_id}", file=sys.stderr)
            print(f"[DELETE-CANCEL] Patient found: {patient is not None}", file=sys.stderr)
            
            # If cancelled by FLS, notify the creator; if cancelled by specialist, notify FLS
            if appointment.created_by_id and patient:
                print(f"[DELETE-CANCEL] Calling create_appointment_cancellation_notification", file=sys.stderr)
                NotificationService.create_appointment_cancellation_notification(
                    db,
                    recipient_id=appointment.created_by_id,
                    appointment_id=appointment_id,
                    patient_name=patient.full_name,
                    specialist_name=specialist_name,
                    appointment_date=appointment.appointment_date,
                    reason="Cancelled by staff",
                )
                print(f"[DELETE-CANCEL] Cancellation notification created successfully", file=sys.stderr)
            else:
                print(f"[DELETE-CANCEL] Skipping - missing created_by_id or patient", file=sys.stderr)
        except Exception as e:
            import traceback
            print(f"[DELETE-CANCEL ERROR] Error creating cancellation notification: {e}", file=sys.stderr)
            print(f"[DELETE-CANCEL TRACEBACK] {traceback.format_exc()}", file=sys.stderr)
            # Don't fail the cancellation if notification creation fails
            pass

        return AppointmentActionResponse(
            appointment=_AS()._serialize_appointment(
                db, appointment),
            message="Appointment cancelled successfully",
        )

    @staticmethod
    def book_appointment(
        db: Session,
        patient_id: str,
        specialist_name: str,
        appointment_date: datetime,
        duration_minutes: int = 30,
        notes: str = None,
    ) -> AppointmentResponse:
        """Backward-compatible wrapper for older clients."""
        payload = AppointmentCreate(
            patient_id=patient_id,
            specialist_name=specialist_name,
            appointment_date=appointment_date,
            duration_minutes=duration_minutes,
            notes=notes,
        )

        # Legacy booking always maps to a standard prenatal appointment.
        appointment = _AS().create_appointment(
            db, payload, current_user=_LegacySystemUser())
        return appointment.appointment

