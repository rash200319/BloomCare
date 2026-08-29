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


class AppointmentQueries:
    @staticmethod
    def get_specializations(db: Session) -> list[SpecializationResponse]:
        specialists = db.query(
            User.specialization,
            func.count(User.id).label("specialist_count")
        ).filter(
            and_(
                User.role == UserRole.CLINICAL_SPECIALIST.value,
                User.specialization.isnot(None),
                _AS()._is_obstetrics_specialization_column(User.specialization),
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
                User.role == UserRole.CLINICAL_SPECIALIST.value,
                _AS()._is_obstetrics_specialization_column(User.specialization),
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
    def get_appointments_by_specialist(
        db: Session,
        specialist_name: str,
        date: str = None,
    ) -> AppointmentListResponse:
        specialist = db.query(User).filter(
            and_(
                User.full_name.ilike(f"%{specialist_name}%"),
                User.role.in_([UserRole.CLINICAL_SPECIALIST.value]),
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
            _AS()._serialize_appointment(db, apt)
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
                User.role.in_([UserRole.CLINICAL_SPECIALIST.value]),
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

        workday_start_hour = _AS().WORKING_START_HOUR
        workday_end_hour = _AS().WORKING_END_HOUR
        slot_duration = timedelta(minutes=_AS().SLOT_DURATION_MINUTES)

        for day_offset in range(days_ahead):
            current_date = now.date() + timedelta(days=day_offset)

            slots = []
            current_time = datetime.combine(current_date, datetime.min.time()).replace(
                hour=workday_start_hour,
                minute=0,
                second=0,
                tzinfo=timezone.utc,
            )
            end_time = current_time.replace(
                hour=workday_end_hour,
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
                slot_end = current_time + slot_duration

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
        patient = _AS()._resolve_patient(db, patient_id)

        if current_user is not None and not _AS()._can_view_patient_appointments(db, current_user, patient):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this patient's appointments",
            )

        query = db.query(Appointment).filter(
            Appointment.patient_id == patient.id)

        if status:
            query = query.filter(Appointment.status ==
                                 _AS()._normalize_status(status))

        appointments = query.order_by(
            Appointment.appointment_date.desc()).all()

        return [
            _AS()._serialize_appointment(db, apt, patient=patient)
            for apt in appointments
        ]

    @staticmethod
    def get_appointments_created_by_user(
        db: Session,
        current_user: object,
        status: Optional[str] = None,
    ) -> list[AppointmentResponse]:
        user_id = getattr(current_user, "id", None)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User context is required",
            )

        query = db.query(Appointment).filter(Appointment.created_by_id == user_id)

        if status:
            query = query.filter(
                Appointment.status == _AS()._normalize_status(status)
            )

        appointments = query.order_by(Appointment.created_at.desc()).all()
        return [_AS()._serialize_appointment(db, apt) for apt in appointments]

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

        patient = _AS()._resolve_patient(
            db, appointment.patient_id)

        if current_user is not None and not _AS()._can_view_patient_appointments(db, current_user, patient):
            if not _AS()._can_manage_appointment(current_user, appointment):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view this appointment",
                )

        return _AS()._serialize_appointment(db, appointment, patient=patient)


