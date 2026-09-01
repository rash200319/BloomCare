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


class AppointmentRules:
    """Service for managing appointments."""

    WORKING_START_HOUR = 8
    WORKING_END_HOUR = 17
    SLOT_DURATION_MINUTES = 30

    STANDARD_APPOINTMENT_TYPES = {
        "PRENATAL_CHECKUP",
        "ULTRASOUND_SCAN",
        "ROUTINE_FOLLOW_UP",
    }

    SPECIALIST_APPOINTMENT_TYPES = {
        "LAB_TEST",
        "GLUCOSE_SCREENING",
        "BLOOD_TEST",
        "HIGH_RISK_FOLLOW_UP",
        "MEDICAL_INTERVENTION",
    }

    ALL_APPOINTMENT_TYPES = STANDARD_APPOINTMENT_TYPES | SPECIALIST_APPOINTMENT_TYPES

    # Doctors complete visits from PENDING/SCHEDULED without a required CONFIRMED step.
    STATUS_FLOW = {
        "PENDING": {"CONFIRMED", "SCHEDULED", "COMPLETED", "CANCELLED"},
        "SCHEDULED": {"PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"},
        "CONFIRMED": {"PENDING", "COMPLETED", "CANCELLED"},
        "COMPLETED": set(),
        "CANCELLED": set(),
    }

    @staticmethod
    def _role_value(role: object) -> str:
        return role.value if hasattr(role, "value") else str(role)

    @staticmethod
    def _normalize_role(role: object) -> str:
        value = _AS()._role_value(role).upper()
        # Legacy DB / JWT profile alias → canonical specialist role
        if value in {"OBSERTITIAN", "DOCTOR"}:
            return UserRole.CLINICAL_SPECIALIST.value
        return value

    @staticmethod
    def _is_specialist_role(role: object) -> bool:
        return _AS()._normalize_role(role) == UserRole.CLINICAL_SPECIALIST.value

    @staticmethod
    def _is_obstetrics_specialization_column(column) -> bool:
        return column.ilike("%obstetr%")

    @staticmethod
    def _is_staff_role(role: object) -> bool:
        return _AS()._normalize_role(role) == UserRole.FRONTLINE_STAFF.value

    @staticmethod
    def _is_admin_role(role: object) -> bool:
        return _AS()._normalize_role(role) == UserRole.ADMIN.value

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
        if _AS()._is_specialist_role(role):
            return "HIGH_RISK_FOLLOW_UP"
        if _AS()._is_staff_role(role):
            return "PRENATAL_CHECKUP"
        return "PRENATAL_CHECKUP"

    @staticmethod
    def _validate_role_for_type(role: object, appointment_type: str) -> None:
        normalized_role = _AS()._normalize_role(role)
        if normalized_role == UserRole.ADMIN.value:
            return

        if normalized_role == UserRole.FRONTLINE_STAFF.value and appointment_type not in _AS().STANDARD_APPOINTMENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Frontline staff can only create standard prenatal appointments",
            )

        if _AS()._is_specialist_role(normalized_role) and appointment_type not in _AS().SPECIALIST_APPOINTMENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Clinical specialists can only create specialized appointments",
            )

        if normalized_role not in {
            UserRole.ADMIN.value,
            UserRole.FRONTLINE_STAFF.value,
            UserRole.CLINICAL_SPECIALIST.value,
        }:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only staff or clinical specialists can create appointments",
            )

    @staticmethod
    def _ensure_allowed_status_transition(current_status: str, new_status: str) -> None:
        current_status = _AS()._normalize_status(current_status)
        new_status = _AS()._normalize_status(new_status)

        if current_status == new_status:
            return

        if new_status == "CANCELLED":
            return

        allowed_next = _AS().STATUS_FLOW.get(
            current_status, set())
        if new_status not in allowed_next:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid appointment status transition from {current_status} to {new_status}",
            )

    @staticmethod
    def _appointment_type_allowed_for_current_role(role: object, appointment_type: str) -> None:
        normalized_type = _AS()._normalize_type(appointment_type)
        if normalized_type is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Appointment type is required",
            )

        if normalized_type not in _AS().ALL_APPOINTMENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported appointment type '{appointment_type}'",
            )

        _AS()._validate_role_for_type(role, normalized_type)

    @staticmethod
    def _resolve_specialist(db: Session, specialist_id: Optional[str], specialist_name: Optional[str]) -> User:
        query = db.query(User).filter(
            User.is_active == True,  # noqa: E712
            User.role == UserRole.CLINICAL_SPECIALIST.value,
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
            created_by_role=_AS()._normalize_role(
                appointment.created_by_role),
            appointment_type=appointment.appointment_type,
            appointment_date=appointment.appointment_date,
            duration_minutes=appointment.duration_minutes,
            queue_number=appointment.queue_number,
            status=(appointment.status or "PENDING").strip().upper(),
            notes=appointment.notes,
            completed_by_id=getattr(appointment, "completed_by_id", None),
            completed_at=getattr(appointment, "completed_at", None),
            cancelled_by_id=getattr(appointment, "cancelled_by_id", None),
            cancelled_at=getattr(appointment, "cancelled_at", None),
            reason_for_cancellation=getattr(appointment, "reason_for_cancellation", None),
            created_at=appointment.created_at,
            updated_at=appointment.updated_at,
            patient_risk_level=patient_risk_level,
            patient_risk_score=patient_risk_score,
        )

    @staticmethod
    def _can_view_patient_appointments(db: Session, current_user: object, patient: Patient) -> bool:
        role = _AS()._normalize_role(
            getattr(current_user, "role", ""))

        if role == UserRole.ADMIN.value:
            return True

        if role == UserRole.PATIENT.value:
            return str(getattr(current_user, "id", "")) == str(patient.id)

        if role == UserRole.FRONTLINE_STAFF.value:
            return str(getattr(patient, "assigned_worker_id", "")) == str(getattr(current_user, "id", ""))

        if role == UserRole.CLINICAL_SPECIALIST.value:
            specialist_id = str(getattr(current_user, "id", ""))
            assigned_by_stage2 = db.query(Stage2Diagnostic.id).filter(
                Stage2Diagnostic.patient_id == patient.id,
                Stage2Diagnostic.specialist_id == specialist_id,
            ).first()
            if assigned_by_stage2:
                return True

            assigned_as_specialist = db.query(Appointment.id).filter(
                Appointment.patient_id == patient.id,
                Appointment.specialist_id == specialist_id,
            ).first()
            return assigned_as_specialist is not None

        return False

    @staticmethod
    def _can_manage_appointment(current_user: object, appointment: Appointment) -> bool:
        role = _AS()._normalize_role(
            getattr(current_user, "role", ""))
        if role == UserRole.ADMIN.value:
            return True
        return str(getattr(current_user, "id", "")) == str(getattr(appointment, "created_by_id", ""))

    @staticmethod
    def _can_update_appointment_status(current_user: object, appointment: Appointment) -> bool:
        """Allow admins, any specialist, or creator to update status"""
        role = _AS()._normalize_role(
            getattr(current_user, "role", ""))
        if role == UserRole.ADMIN.value:
            return True
        # Allow any specialist to update appointment status (obstetrician can change any appointment)
        if role == UserRole.CLINICAL_SPECIALIST.value:
            return True
        # Allow the creator to update status
        return str(getattr(current_user, "id", "")) == str(getattr(appointment, "created_by_id", ""))

