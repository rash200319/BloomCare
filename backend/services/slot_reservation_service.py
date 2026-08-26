from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, text
from sqlalchemy.orm import Session

from backend.models.appointment_slot_reservation import AppointmentSlotReservation
from backend.models.appointment import Appointment


class SlotUnavailableError(ValueError):
    pass


class SlotReservationService:
    """Database-backed specialist interval reservations."""

    @staticmethod
    def reserve(
        db: Session,
        *,
        operation_id: str,
        specialist_id: str,
        starts_at: datetime,
        duration_minutes: int,
        schedule_version: int,
        ttl_minutes: int,
        exclude_operation_id: str | None = None,
        exclude_appointment_id: str | None = None,
        flush: bool = True,
    ) -> AppointmentSlotReservation:
        existing = (
            db.query(AppointmentSlotReservation)
            .filter(
                AppointmentSlotReservation.operation_id == operation_id,
                AppointmentSlotReservation.schedule_version == schedule_version,
            )
            .first()
        )
        if existing:
            return existing

        if starts_at.tzinfo is None:
            starts_at = starts_at.replace(tzinfo=timezone.utc)
        ends_at = starts_at + timedelta(minutes=duration_minutes)

        # Serialize reservations for one specialist on PostgreSQL. SQLite is a
        # demo fallback and cannot provide the same cross-process guarantee.
        if db.bind is not None and db.bind.dialect.name == "postgresql":
            db.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:key))"),
                {"key": f"appointment-slot:{specialist_id}"},
            )

        now = datetime.now(timezone.utc)
        expired = (
            db.query(AppointmentSlotReservation)
            .filter(
                AppointmentSlotReservation.specialist_id == specialist_id,
                AppointmentSlotReservation.status == "ACTIVE",
                AppointmentSlotReservation.appointment_id.is_(None),
                AppointmentSlotReservation.expires_at.isnot(None),
                AppointmentSlotReservation.expires_at <= now,
            )
            .all()
        )
        for reservation in expired:
            reservation.status = "EXPIRED"
            reservation.released_at = now

        conflict_query = db.query(AppointmentSlotReservation).filter(
            AppointmentSlotReservation.specialist_id == specialist_id,
            AppointmentSlotReservation.status == "ACTIVE",
            AppointmentSlotReservation.starts_at < ends_at,
            AppointmentSlotReservation.ends_at > starts_at,
        )
        if exclude_operation_id:
            conflict_query = conflict_query.filter(
                AppointmentSlotReservation.operation_id != exclude_operation_id
            )
        conflict = conflict_query.first()
        if conflict:
            raise SlotUnavailableError("The selected specialist slot is no longer available")

        # Reservations introduced by Temporal must also respect appointments
        # created through BloomCare's legacy staff/mobile endpoints.
        appointment_query = db.query(Appointment).filter(
            Appointment.specialist_id == specialist_id,
            Appointment.status.notin_(["CANCELLED", "COMPLETED"]),
        )
        if exclude_appointment_id:
            appointment_query = appointment_query.filter(Appointment.id != exclude_appointment_id)
        appointments = appointment_query.all()
        for appointment in appointments:
            existing_start = appointment.appointment_date
            if existing_start.tzinfo is None:
                existing_start = existing_start.replace(tzinfo=timezone.utc)
            existing_end = existing_start + timedelta(minutes=appointment.duration_minutes or 30)
            if starts_at < existing_end and ends_at > existing_start:
                raise SlotUnavailableError("The selected specialist slot is already booked")

        reservation = AppointmentSlotReservation(
            id=str(uuid.uuid4()),
            operation_id=operation_id,
            specialist_id=specialist_id,
            schedule_version=schedule_version,
            starts_at=starts_at,
            ends_at=ends_at,
            status="ACTIVE",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes),
        )
        db.add(reservation)
        if flush:
            db.flush()
        return reservation

    @staticmethod
    def release_for_operation(db: Session, operation_id: str) -> None:
        now = datetime.now(timezone.utc)
        reservations = (
            db.query(AppointmentSlotReservation)
            .filter(
                AppointmentSlotReservation.operation_id == operation_id,
                AppointmentSlotReservation.status == "ACTIVE",
            )
            .all()
        )
        for reservation in reservations:
            reservation.status = "RELEASED"
            reservation.released_at = now
