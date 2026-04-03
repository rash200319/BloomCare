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


class AppointmentService:
    """Service for managing appointments."""

    WORKING_START_HOUR = 8
    WORKING_END_HOUR = 17
    SLOT_DURATION_MINUTES = 30

    STANDARD_APPOINTMENT_TYPES = {
        "PRENATAL_CHECKUP",
        "ULTRASOUND_SCAN",
        "ROUTINE_FOLLOW_UP",
    }

    DOCTOR_APPOINTMENT_TYPES = {
        "LAB_TEST",
        "GLUCOSE_SCREENING",
        "BLOOD_TEST",
        "HIGH_RISK_FOLLOW_UP",
        "MEDICAL_INTERVENTION",
    }

    ALL_APPOINTMENT_TYPES = STANDARD_APPOINTMENT_TYPES | DOCTOR_APPOINTMENT_TYPES

    STATUS_FLOW = {
        "PENDING": {"CONFIRMED", "CANCELLED"},
        "CONFIRMED": {"COMPLETED", "CANCELLED"},
        "COMPLETED": {"CANCELLED"},
        "CANCELLED": set(),
    }

    @staticmethod
    def _role_value(role: object) -> str:
        return role.value if hasattr(role, "value") else str(role)

    @staticmethod
    def _normalize_role(role: object) -> str:
        role_value = AppointmentService._role_value(role).upper()
        if role_value == UserRole.CLINICAL_SPECIALIST.value:
            return UserRole.DOCTOR.value
        return role_value

    @staticmethod
    def _is_doctor_role(role: object) -> bool:
        return AppointmentService._normalize_role(role) == UserRole.DOCTOR.value

    @staticmethod
    def _is_staff_role(role: object) -> bool:
        return AppointmentService._normalize_role(role) == UserRole.FRONTLINE_STAFF.value

    @staticmethod
    def _is_admin_role(role: object) -> bool:
        return AppointmentService._normalize_role(role) == UserRole.ADMIN.value

    @staticmethod
    def _normalize_status(status_value: str) -> str:
        normalized = status_value.strip().upper()
        if normalized == "SCHEDULED":
            return "PENDING"
        return normalized

    @staticmethod
    def _normalize_type(appointment_type: Optional[str]) -> Optional[str]:
        if appointment_type is None:
            return None

        normalized = appointment_type.strip().upper().replace("-", "_").replace(" ", "_")
        aliases = {
            "PRENATAL": "PRENATAL_CHECKUP",
            "PRENATAL_CHECKUP": "PRENATAL_CHECKUP",
            "ULTRASOUND": "ULTRASOUND_SCAN",
            "ULTRASOUND_SCAN": "ULTRASOUND_SCAN",
            "ROUTINE_FOLLOWUP": "ROUTINE_FOLLOW_UP",
            "ROUTINE_FOLLOW_UP": "ROUTINE_FOLLOW_UP",
            "GLUCOSE": "GLUCOSE_SCREENING",
            "GLUCOSE_SCREENING": "GLUCOSE_SCREENING",
            "BLOOD": "BLOOD_TEST",
            "BLOOD_TEST": "BLOOD_TEST",
            "LAB": "LAB_TEST",
            "LAB_TEST": "LAB_TEST",
            "HIGH_RISK": "HIGH_RISK_FOLLOW_UP",
            "HIGH_RISK_FOLLOW_UP": "HIGH_RISK_FOLLOW_UP",
            "MEDICAL_INTERVENTION": "MEDICAL_INTERVENTION",
        }
        return aliases.get(normalized, normalized)

    @staticmethod
    def _default_appointment_type(role: object) -> str:
        if AppointmentService._is_doctor_role(role):
            return "HIGH_RISK_FOLLOW_UP"
        if AppointmentService._is_staff_role(role):
            return "PRENATAL_CHECKUP"
        return "PRENATAL_CHECKUP"

    @staticmethod
    def _validate_role_for_type(role: object, appointment_type: str) -> None:
        normalized_role = AppointmentService._normalize_role(role)
        if normalized_role == UserRole.ADMIN.value:
            return

        if normalized_role == UserRole.FRONTLINE_STAFF.value and appointment_type not in AppointmentService.STANDARD_APPOINTMENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Frontline staff can only create standard prenatal appointments",
            )

        if AppointmentService._is_doctor_role(normalized_role) and appointment_type not in AppointmentService.DOCTOR_APPOINTMENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Doctors can only create specialized appointments",
            )

        if normalized_role not in {
            UserRole.ADMIN.value,
            UserRole.FRONTLINE_STAFF.value,
            UserRole.DOCTOR.value,
        }:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only staff or doctors can create appointments",
            )

    @staticmethod
    def _ensure_allowed_status_transition(current_status: str, new_status: str) -> None:
        current_status = AppointmentService._normalize_status(current_status)
        new_status = AppointmentService._normalize_status(new_status)

        if current_status == new_status:
            return

        if new_status == "CANCELLED":
            return

        allowed_next = AppointmentService.STATUS_FLOW.get(
            current_status, set())
        if new_status not in allowed_next:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid appointment status transition from {current_status} to {new_status}",
            )

    @staticmethod
    def _appointment_type_allowed_for_current_role(role: object, appointment_type: str) -> None:
        normalized_type = AppointmentService._normalize_type(appointment_type)
        if normalized_type is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Appointment type is required",
            )

        if normalized_type not in AppointmentService.ALL_APPOINTMENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported appointment type '{appointment_type}'",
            )

        AppointmentService._validate_role_for_type(role, normalized_type)

    @staticmethod
    def _resolve_specialist(db: Session, specialist_id: Optional[str], specialist_name: Optional[str]) -> User:
        query = db.query(User).filter(
            User.is_active == True,  # noqa: E712
            User.role.in_([UserRole.DOCTOR, UserRole.CLINICAL_SPECIALIST]),
        )

        specialist = None
        if specialist_id:
            specialist = query.filter(User.id == specialist_id).first()
            if specialist is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Specialist '{specialist_id}' not found",
                )

        if specialist_name:
            specialist_by_name = query.filter(
                User.full_name.ilike(f"%{specialist_name}%")).first()
            if specialist_by_name is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Specialist '{specialist_name}' not found",
                )

            if specialist and str(specialist.id) != str(specialist_by_name.id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Specialist ID and specialist name do not match",
                )
            specialist = specialist_by_name

        if specialist is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A specialist must be provided",
            )

        return specialist

    @staticmethod
    def _resolve_patient(db: Session, patient_id: str) -> Patient:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Patient with ID '{patient_id}' not found",
            )
        return patient

    @staticmethod
    def _fetch_creator(db: Session, creator_id: Optional[str]) -> Optional[User]:
        if not creator_id:
            return None
        return db.query(User).filter(User.id == creator_id).first()

    @staticmethod
    def _serialize_appointment(
        db: Session,
        appointment: Appointment,
        patient: Optional[Patient] = None,
        specialist: Optional[User] = None,
        creator: Optional[User] = None,
    ) -> AppointmentResponse:
        if patient is None:
            patient = db.query(Patient).filter(
                Patient.id == appointment.patient_id).first()
        if specialist is None and appointment.specialist_id:
            specialist = db.query(User).filter(
                User.id == appointment.specialist_id).first()
        if creator is None and appointment.created_by_id:
            creator = db.query(User).filter(
                User.id == appointment.created_by_id).first()

        # Get latest patient risk assessment from Stage1Screening
        latest_screening = db.query(Stage1Screening).filter(
            Stage1Screening.patient_id == appointment.patient_id
        ).order_by(Stage1Screening.collected_at.desc()).first()

        patient_risk_level = None
        patient_risk_score = None
        if latest_screening:
            patient_risk_level = latest_screening.edge_risk_classification.value if latest_screening.edge_risk_classification else None
            patient_risk_score = float(
                latest_screening.edge_risk_score) if latest_screening.edge_risk_score else None

        return AppointmentResponse(
            id=appointment.id,
            patient_id=appointment.patient_id,
            patient_name=patient.full_name if patient else "Unknown",
            specialist_id=str(
                appointment.specialist_id) if appointment.specialist_id else None,
            specialist_name=specialist.full_name if specialist else None,
            created_by_id=str(
                appointment.created_by_id) if appointment.created_by_id else None,
            created_by_role=AppointmentService._normalize_role(
                appointment.created_by_role),
            appointment_type=appointment.appointment_type,
            appointment_date=appointment.appointment_date,
            duration_minutes=appointment.duration_minutes,
            queue_number=appointment.queue_number,
            status=AppointmentService._normalize_status(appointment.status),
            notes=appointment.notes,
            created_at=appointment.created_at,
            updated_at=appointment.updated_at,
            patient_risk_level=patient_risk_level,
            patient_risk_score=patient_risk_score,
        )

    @staticmethod
    def _can_view_patient_appointments(db: Session, current_user: object, patient: Patient) -> bool:
        role = AppointmentService._normalize_role(
            getattr(current_user, "role", ""))

        if role == UserRole.ADMIN.value:
            return True

        if role == UserRole.PATIENT.value:
            return str(getattr(current_user, "id", "")) == str(patient.id)

        if role == UserRole.FRONTLINE_STAFF.value:
            return str(getattr(patient, "assigned_worker_id", "")) == str(getattr(current_user, "id", ""))

        if role == UserRole.DOCTOR.value:
            doctor_id = str(getattr(current_user, "id", ""))
            assigned_by_stage2 = db.query(Stage2Diagnostic.id).filter(
                Stage2Diagnostic.patient_id == patient.id,
                Stage2Diagnostic.specialist_id == doctor_id,
            ).first()
            if assigned_by_stage2:
                return True

            assigned_as_specialist = db.query(Appointment.id).filter(
                Appointment.patient_id == patient.id,
                Appointment.specialist_id == doctor_id,
            ).first()
            return assigned_as_specialist is not None

        return False

    @staticmethod
    def _can_manage_appointment(current_user: object, appointment: Appointment) -> bool:
        role = AppointmentService._normalize_role(
            getattr(current_user, "role", ""))
        if role == UserRole.ADMIN.value:
            return True
        return str(getattr(current_user, "id", "")) == str(getattr(appointment, "created_by_id", ""))

    @staticmethod
    def _can_update_appointment_status(current_user: object, appointment: Appointment) -> bool:
        """Allow specialists assigned to appointment or admins to update status"""
        role = AppointmentService._normalize_role(
            getattr(current_user, "role", ""))
        if role == UserRole.ADMIN.value:
            return True
        # Allow the specialist assigned to this appointment to update status
        if role in [UserRole.DOCTOR.value, UserRole.CLINICAL_SPECIALIST.value]:
            return str(getattr(current_user, "id", "")) == str(getattr(appointment, "specialist_id", ""))
        # Allow the creator to update status
        return str(getattr(current_user, "id", "")) == str(getattr(appointment, "created_by_id", ""))

    @staticmethod
    def get_specializations(db: Session) -> list[SpecializationResponse]:
        specialists = db.query(
            User.specialization,
            func.count(User.id).label("specialist_count")
        ).filter(
            and_(
                User.role.in_([UserRole.DOCTOR, UserRole.CLINICAL_SPECIALIST]),
                User.specialization.isnot(None),
                User.is_active == True,  # noqa: E712
            )
        ).group_by(User.specialization).all()

        return [
            SpecializationResponse(
                specialization=spec.specialization,
                specialist_count=spec.specialist_count,
            )
            for spec in specialists
        ]

    @staticmethod
    def get_specialists_by_specialization(
        db: Session, specialization: str
    ) -> list[SpecialistResponse]:
        specialists = db.query(User).filter(
            and_(
                User.role.in_([UserRole.DOCTOR, UserRole.CLINICAL_SPECIALIST]),
                User.specialization.ilike(f"%{specialization}%"),
                User.is_active == True,  # noqa: E712
            )
        ).all()

        if not specialists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No specialists found for specialization '{specialization}'",
            )

        return [
            SpecialistResponse(
                id=str(spec.id),
                full_name=spec.full_name,
                specialization=spec.specialization,
                phone_number=spec.phone_number,
                email=spec.email,
            )
            for spec in specialists
        ]

    @staticmethod
    def create_appointment(
        db: Session,
        appointment_in: AppointmentCreate,
        current_user: object,
    ) -> AppointmentActionResponse:
        role = AppointmentService._normalize_role(
            getattr(current_user, "role", ""))
        if role == UserRole.PATIENT.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Patients cannot create appointments",
            )

        patient = AppointmentService._resolve_patient(
            db, appointment_in.patient_id)
        specialist = AppointmentService._resolve_specialist(
            db,
            appointment_in.specialist_id,
            appointment_in.specialist_name,
        )

        appointment_type = AppointmentService._normalize_type(
            appointment_in.appointment_type)
        if appointment_type is None:
            appointment_type = AppointmentService._default_appointment_type(
                role)

        AppointmentService._validate_role_for_type(role, appointment_type)

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

        appointment = Appointment(
            id=str(__import__("uuid").uuid4()),
            patient_id=patient.id,
            specialist_id=specialist.id,
            created_by_id=getattr(current_user, "id", None),
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
            appointment=AppointmentService._serialize_appointment(
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
            User.role.in_([UserRole.DOCTOR, UserRole.CLINICAL_SPECIALIST]),
        ).first()
        if not specialist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Specialist '{specialist_name}' not found",
            )

        # Normalize appointment type
        normalized_type = AppointmentService._normalize_type(appointment_type)
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

        # Create appointment
        appointment = Appointment(
            id=str(__import__("uuid").uuid4()),
            patient_id=patient.id,
            specialist_id=specialist.id,
            created_by_id=None,  # System-created
            created_by_role="SYSTEM",
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
            appointment=AppointmentService._serialize_appointment(
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

        if not AppointmentService._can_manage_appointment(current_user, appointment):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the creator or an admin can modify this appointment",
            )

        if appointment_in.status is not None:
            requested_status = AppointmentService._normalize_status(
                appointment_in.status)
            AppointmentService._ensure_allowed_status_transition(
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
            normalized_type = AppointmentService._normalize_type(
                appointment_in.appointment_type)
            if normalized_type not in AppointmentService.ALL_APPOINTMENT_TYPES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported appointment type '{appointment_in.appointment_type}'",
                )
            AppointmentService._validate_role_for_type(
                getattr(current_user, "role", ""), normalized_type)
            appointment.appointment_type = normalized_type

        if appointment_in.notes is not None:
            appointment.notes = appointment_in.notes

        db.commit()
        db.refresh(appointment)

        return AppointmentActionResponse(
            appointment=AppointmentService._serialize_appointment(
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

        if not AppointmentService._can_manage_appointment(current_user, appointment):
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
            
            # If cancelled by FLS, notify the creator; if cancelled by doctor, notify FLS
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
            appointment=AppointmentService._serialize_appointment(
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
        appointment = AppointmentService.create_appointment(
            db, payload, current_user=_LegacySystemUser())
        return appointment.appointment

    @staticmethod
    def get_appointments_by_specialist(
        db: Session,
        specialist_name: str,
        date: str = None,
    ) -> AppointmentListResponse:
        specialist = db.query(User).filter(
            and_(
                User.full_name.ilike(f"%{specialist_name}%"),
                User.role.in_([UserRole.DOCTOR, UserRole.CLINICAL_SPECIALIST]),
                User.is_active == True,  # noqa: E712
            )
        ).first()

        if not specialist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Specialist '{specialist_name}' not found",
            )

        query = db.query(Appointment).filter(
            and_(
                Appointment.specialist_id == specialist.id,
                Appointment.status != "CANCELLED",
            )
        )

        if date:
            try:
                filter_date = datetime.strptime(date, "%Y-%m-%d").date()
                query = query.filter(
                    func.date(Appointment.appointment_date) == filter_date)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid date format. Use YYYY-MM-DD",
                ) from exc

        appointments = query.order_by(
            func.date(Appointment.appointment_date),
            Appointment.queue_number,
        ).all()

        appointment_responses = [
            AppointmentService._serialize_appointment(db, apt)
            for apt in appointments
        ]

        return AppointmentListResponse(
            specialist_name=specialist.full_name,
            specialization=specialist.specialization or "General",
            date=date or "All dates",
            appointments=appointment_responses,
            total_appointments=len(appointment_responses),
        )

    @staticmethod
    def get_specialist_availability(
        db: Session,
        specialist_name: str,
        days_ahead: int = 14,
    ) -> list[AvailabilityResponse]:
        specialist = db.query(User).filter(
            and_(
                User.full_name.ilike(f"%{specialist_name}%"),
                User.role.in_([UserRole.DOCTOR, UserRole.CLINICAL_SPECIALIST]),
                User.is_active == True,  # noqa: E712
            )
        ).first()

        if not specialist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Specialist '{specialist_name}' not found",
            )

        availability_list = []
        now = datetime.now(timezone.utc)

        for day_offset in range(days_ahead):
            current_date = now.date() + timedelta(days=day_offset)

            if current_date.weekday() >= 5:
                continue

            slots = []
            current_time = datetime.combine(current_date, datetime.min.time()).replace(
                hour=AppointmentService.WORKING_START_HOUR,
                minute=0,
                second=0,
                tzinfo=timezone.utc,
            )
            end_time = current_time.replace(
                hour=AppointmentService.WORKING_END_HOUR,
                minute=0,
                second=0,
            )

            appointments_on_date = db.query(Appointment).filter(
                and_(
                    Appointment.specialist_id == specialist.id,
                    Appointment.appointment_date >= datetime.combine(
                        current_date, datetime.min.time()).replace(tzinfo=timezone.utc),
                    Appointment.appointment_date < datetime.combine(
                        current_date, datetime.max.time()).replace(tzinfo=timezone.utc),
                    Appointment.status != "CANCELLED",
                )
            ).all()

            while current_time < end_time:
                slot_end = current_time + \
                    timedelta(minutes=AppointmentService.SLOT_DURATION_MINUTES)

                booked = None
                for appointment in appointments_on_date:
                    # Ensure appointment date is timezone-aware (SQLite returns naive datetimes)
                    appt_date = appointment.appointment_date
                    if appt_date.tzinfo is None:
                        appt_date = appt_date.replace(tzinfo=timezone.utc)

                    appt_end = appt_date + \
                        timedelta(minutes=appointment.duration_minutes)
                    if appt_date <= current_time and appt_end > current_time:
                        booked = appointment
                        break

                patient_name = None
                if booked:
                    patient = db.query(Patient).filter(
                        Patient.id == booked.patient_id).first()
                    patient_name = patient.full_name if patient else "Unknown"

                slots.append(
                    TimeSlot(
                        start_time=current_time,
                        end_time=slot_end,
                        is_available=booked is None,
                        booked_by=patient_name,
                    )
                )

                current_time = slot_end

            availability_list.append(
                AvailabilityResponse(
                    specialist_id=str(specialist.id),
                    specialist_name=specialist.full_name,
                    specialization=specialist.specialization or "General",
                    date=current_date.strftime("%Y-%m-%d"),
                    available_slots=slots,
                    total_available=sum(
                        1 for slot in slots if slot.is_available),
                )
            )

        return availability_list

    @staticmethod
    def get_appointments_by_patient(
        db: Session,
        patient_id: str,
        status: str = None,
        current_user: Optional[object] = None,
    ) -> list[AppointmentResponse]:
        patient = AppointmentService._resolve_patient(db, patient_id)

        if current_user is not None and not AppointmentService._can_view_patient_appointments(db, current_user, patient):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this patient's appointments",
            )

        query = db.query(Appointment).filter(
            Appointment.patient_id == patient.id)

        if status:
            query = query.filter(Appointment.status ==
                                 AppointmentService._normalize_status(status))

        appointments = query.order_by(
            Appointment.appointment_date.desc()).all()

        return [
            AppointmentService._serialize_appointment(db, apt, patient=patient)
            for apt in appointments
        ]

    @staticmethod
    def get_appointment_by_id(
        db: Session,
        appointment_id: str,
        current_user: Optional[object] = None,
    ) -> AppointmentResponse:
        appointment = db.query(Appointment).filter(
            Appointment.id == appointment_id).first()
        if not appointment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Appointment '{appointment_id}' not found",
            )

        patient = AppointmentService._resolve_patient(
            db, appointment.patient_id)

        if current_user is not None and not AppointmentService._can_view_patient_appointments(db, current_user, patient):
            if not AppointmentService._can_manage_appointment(current_user, appointment):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view this appointment",
                )

        return AppointmentService._serialize_appointment(db, appointment, patient=patient)


class _LegacySystemUser:
    """Compatibility shim for legacy booking callers that did not pass a creator."""

    id = None
    role = UserRole.ADMIN
