from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func
from sqlalchemy.exc import IntegrityError
from temporalio import activity
from temporalio.exceptions import ApplicationError

from backend.core.config import settings
from backend.db.session import SessionLocal
from backend.models.appointment import Appointment
from backend.models.appointment_operation import AppointmentBookingOperation
from backend.models.appointment_slot_reservation import AppointmentSlotReservation
from backend.models.notification_delivery import NotificationDelivery
from backend.models.notification import Notification
from backend.models.patient import Patient
from backend.models.user import User
from backend.orchestration.appointments.contracts import (
    BookingTiming,
    FinalizeDecisionInput,
    NotificationInput,
    OperationRef,
    RescheduleActivityInput,
    RescheduleResult,
)
from backend.schemas.notification import NotificationCreate
from backend.services.appointment_service import AppointmentService
from backend.services.notification_service import NotificationService
from backend.services.slot_reservation_service import SlotReservationService, SlotUnavailableError


def _operation(db, operation_id: str) -> AppointmentBookingOperation:
    operation = db.query(AppointmentBookingOperation).filter(
        AppointmentBookingOperation.id == operation_id
    ).first()
    if not operation:
        raise ApplicationError("Booking operation not found", non_retryable=True, type="OPERATION_NOT_FOUND")
    return operation


def _reject(db, operation: AppointmentBookingOperation, code: str, message: str) -> None:
    operation.status = "REJECTED"
    operation.error_code = code
    operation.error_message = message
    operation.completed_at = datetime.now(timezone.utc)
    db.commit()


@activity.defn
def validate_booking(input: OperationRef) -> None:
    db = SessionLocal()
    try:
        operation = _operation(db, input.operation_id)
        if operation.appointment_id:
            return
        operation.status = "VALIDATING"
        db.commit()

        patient = db.query(Patient).filter(
            Patient.id == operation.patient_id, Patient.is_active.is_(True)
        ).first()
        specialist = db.query(User).filter(
            User.id == operation.specialist_id, User.is_active.is_(True)
        ).first()
        now = datetime.now(timezone.utc)
        appointment_date = operation.appointment_date
        if appointment_date.tzinfo is None:
            appointment_date = appointment_date.replace(tzinfo=timezone.utc)

        error: tuple[str, str] | None = None
        if not patient:
            error = ("PATIENT_INVALID", "The patient account is inactive or unavailable")
        elif not specialist or not AppointmentService._is_specialist_role(specialist.role):
            error = ("SPECIALIST_INVALID", "The selected specialist is inactive or unavailable")
        elif appointment_date <= now:
            error = ("APPOINTMENT_IN_PAST", "Appointment date must be in the future")
        elif operation.duration_minutes < 15 or operation.duration_minutes > 240:
            error = ("DURATION_INVALID", "Appointment duration is outside the allowed range")
        elif operation.appointment_type not in AppointmentService.STANDARD_APPOINTMENT_TYPES:
            error = ("TYPE_INVALID", "Patient self-service supports standard appointment types only")

        if error:
            _reject(db, operation, *error)
            raise ApplicationError(error[1], non_retryable=True, type=error[0])
    finally:
        db.close()


@activity.defn
def reserve_booking_slot(input: OperationRef) -> str:
    db = SessionLocal()
    try:
        operation = _operation(db, input.operation_id)
        existing = db.query(AppointmentSlotReservation).filter(
            AppointmentSlotReservation.operation_id == operation.id,
            AppointmentSlotReservation.schedule_version == operation.schedule_version,
        ).first()
        if existing:
            return existing.id

        operation.status = "RESERVING_SLOT"
        try:
            reservation = SlotReservationService.reserve(
                db,
                operation_id=operation.id,
                specialist_id=operation.specialist_id,
                starts_at=operation.appointment_date,
                duration_minutes=operation.duration_minutes,
                schedule_version=operation.schedule_version,
                ttl_minutes=settings.APPOINTMENT_RESERVATION_TTL_MINUTES,
            )
            db.commit()
            return reservation.id
        except SlotUnavailableError as exc:
            db.rollback()
            operation = _operation(db, input.operation_id)
            _reject(db, operation, "SLOT_UNAVAILABLE", str(exc))
            raise ApplicationError(str(exc), non_retryable=True, type="SLOT_UNAVAILABLE") from exc
    finally:
        db.close()


@activity.defn
def create_reserved_appointment(input: OperationRef) -> str:
    db = SessionLocal()
    try:
        operation = _operation(db, input.operation_id)
        if operation.appointment_id:
            return str(operation.appointment_id)
        existing = db.query(Appointment).filter(
            Appointment.booking_operation_id == operation.id
        ).first()
        if existing:
            operation.appointment_id = existing.id
            db.commit()
            return str(existing.id)

        operation.status = "CREATING_APPOINTMENT"
        appointment_date = operation.appointment_date
        if appointment_date.tzinfo is None:
            appointment_date = appointment_date.replace(tzinfo=timezone.utc)
        day_start = appointment_date.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start.replace(hour=23, minute=59, second=59, microsecond=999999)
        queue_number = (
            db.query(func.count(Appointment.id))
            .filter(
                Appointment.specialist_id == operation.specialist_id,
                Appointment.appointment_date >= day_start,
                Appointment.appointment_date <= day_end,
                Appointment.status != "CANCELLED",
            )
            .scalar()
            or 0
        ) + 1

        appointment = Appointment(
            id=str(uuid.uuid4()),
            patient_id=operation.patient_id,
            specialist_id=operation.specialist_id,
            created_by_id=None,
            created_by_role="PATIENT",
            appointment_type=operation.appointment_type,
            appointment_date=operation.appointment_date,
            duration_minutes=operation.duration_minutes,
            queue_number=queue_number,
            status="PENDING",
            notes=operation.notes,
            booking_operation_id=operation.id,
            schedule_version=operation.schedule_version,
        )
        db.add(appointment)
        db.flush()
        reservation = db.query(AppointmentSlotReservation).filter(
            AppointmentSlotReservation.operation_id == operation.id,
            AppointmentSlotReservation.schedule_version == operation.schedule_version,
        ).first()
        if reservation:
            reservation.appointment_id = appointment.id
            reservation.expires_at = None
        operation.appointment_id = appointment.id
        operation.confirmation_deadline = datetime.now(timezone.utc) + timedelta(
            hours=settings.APPOINTMENT_CONFIRMATION_TIMEOUT_HOURS
        )
        operation.status = "AWAITING_CONFIRMATION"
        db.commit()
        return str(appointment.id)
    finally:
        db.close()


@activity.defn
def finalize_booking_decision(input: FinalizeDecisionInput) -> str:
    db = SessionLocal()
    try:
        operation = _operation(db, input.operation_id)
        appointment = db.query(Appointment).filter(Appointment.id == operation.appointment_id).first()
        if not appointment:
            raise ApplicationError("Appointment not found", non_retryable=True, type="APPOINTMENT_NOT_FOUND")

        decision = input.decision.strip().upper()
        now = datetime.now(timezone.utc)
        if decision == "CONFIRM":
            appointment.status = "CONFIRMED"
            operation.status = "CONFIRMED"
        elif decision in {"CANCEL", "EXPIRE"}:
            appointment.status = "CANCELLED"
            appointment.cancelled_at = now
            appointment.reason_for_cancellation = operation.decision_reason or (
                "Confirmation window expired" if decision == "EXPIRE" else "Cancelled"
            )
            # cancelled_by_id is a users.id FK, but a Temporal cancellation may
            # come from a patient (no users row) or the workflow's own
            # auto-expire timer (no actor at all). Attribute via
            # cancelled_by_role in those cases, matching the existing
            # created_by_id/created_by_role pattern. See
            # chk_cancelled_appointment_audit, which requires one or the other.
            if decision == "EXPIRE":
                appointment.cancelled_by_role = "SYSTEM_EXPIRE"
            elif input.actor_role and input.actor_role.upper() != "PATIENT" and input.actor_user_id:
                appointment.cancelled_by_id = input.actor_user_id
                appointment.cancelled_by_role = input.actor_role.upper()
            elif input.actor_role:
                appointment.cancelled_by_role = input.actor_role.upper()
            else:
                appointment.cancelled_by_role = "UNKNOWN"
            operation.status = "EXPIRED" if decision == "EXPIRE" else "CANCELLED"
            operation.completed_at = now
            SlotReservationService.release_for_operation(db, operation.id)
        elif decision == "COMPLETE":
            appointment.status = "COMPLETED"
            appointment.completed_at = now
            operation.status = "COMPLETED"
            operation.completed_at = now
        else:
            raise ApplicationError("Unsupported appointment decision", non_retryable=True, type="INVALID_DECISION")
        db.commit()
        return operation.status
    finally:
        db.close()


@activity.defn
def get_booking_timing(input: OperationRef) -> BookingTiming:
    db = SessionLocal()
    try:
        operation = _operation(db, input.operation_id)
        appointment_date = operation.appointment_date
        if appointment_date.tzinfo is None:
            appointment_date = appointment_date.replace(tzinfo=timezone.utc)
        return BookingTiming(
            appointment_timestamp=appointment_date.timestamp(),
            schedule_version=operation.schedule_version,
            reminder_hours=settings.appointment_reminder_hours,
            confirmation_timeout_seconds=settings.APPOINTMENT_CONFIRMATION_TIMEOUT_HOURS * 3600,
        )
    finally:
        db.close()


@activity.defn
def reschedule_booking(input: RescheduleActivityInput) -> RescheduleResult:
    """Atomically replace a booked slot without exposing an unreserved gap."""
    db = SessionLocal()
    try:
        operation = _operation(db, input.operation_id)
        if operation.status in {"COMPLETED", "CANCELLED", "REJECTED", "EXPIRED", "FAILED"}:
            raise ApplicationError(
                f"Booking operation is already final: {operation.status}",
                non_retryable=True,
                type="OPERATION_FINAL",
            )
        appointment = db.query(Appointment).filter(
            Appointment.id == operation.appointment_id
        ).first()
        if not appointment:
            raise ApplicationError(
                "Appointment has not been created",
                non_retryable=True,
                type="APPOINTMENT_NOT_FOUND",
            )

        starts_at = datetime.fromtimestamp(input.appointment_timestamp, tz=timezone.utc)
        if operation.schedule_version >= input.target_schedule_version:
            return RescheduleResult(
                appointment_timestamp=operation.appointment_date.timestamp(),
                schedule_version=operation.schedule_version,
                reminder_hours=settings.appointment_reminder_hours,
                previous_status=operation.status,
            )
        if starts_at <= datetime.now(timezone.utc):
            raise ApplicationError(
                "Rescheduled appointment must be in the future",
                non_retryable=True,
                type="APPOINTMENT_IN_PAST",
            )
        if input.duration_minutes < 15 or input.duration_minutes > 240:
            raise ApplicationError(
                "Appointment duration is outside the allowed range",
                non_retryable=True,
                type="DURATION_INVALID",
            )

        previous_status = operation.status
        next_version = input.target_schedule_version
        try:
            # Check and stage the replacement first. The old row is changed to
            # RELEASED in the same transaction before flush, so PostgreSQL's
            # overlap constraint never observes a gap or two active versions.
            replacement = SlotReservationService.reserve(
                db,
                operation_id=operation.id,
                specialist_id=str(operation.specialist_id),
                starts_at=starts_at,
                duration_minutes=input.duration_minutes,
                schedule_version=next_version,
                ttl_minutes=settings.APPOINTMENT_RESERVATION_TTL_MINUTES,
                exclude_operation_id=operation.id,
                exclude_appointment_id=str(appointment.id),
                flush=False,
            )

            now = datetime.now(timezone.utc)
            old_reservations = db.query(AppointmentSlotReservation).filter(
                AppointmentSlotReservation.operation_id == operation.id,
                AppointmentSlotReservation.status == "ACTIVE",
                AppointmentSlotReservation.schedule_version != next_version,
            ).all()
            for old in old_reservations:
                old.status = "RELEASED"
                old.released_at = now

            day_start = starts_at.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start.replace(hour=23, minute=59, second=59, microsecond=999999)
            appointment.queue_number = (
                db.query(func.count(Appointment.id))
                .filter(
                    Appointment.specialist_id == operation.specialist_id,
                    Appointment.id != appointment.id,
                    Appointment.appointment_date >= day_start,
                    Appointment.appointment_date <= day_end,
                    Appointment.status != "CANCELLED",
                )
                .scalar()
                or 0
            ) + 1
            appointment.appointment_date = starts_at
            appointment.duration_minutes = input.duration_minutes
            appointment.schedule_version = next_version
            replacement.appointment_id = appointment.id
            replacement.expires_at = None

            operation.appointment_date = starts_at
            operation.duration_minutes = input.duration_minutes
            operation.schedule_version = next_version
            operation.reschedule_reason = input.reason
            operation.error_code = None
            operation.error_message = None
            operation.status = (
                "AWAITING_CONFIRMATION"
                if previous_status == "AWAITING_CONFIRMATION"
                else "RESCHEDULED"
            )
            db.commit()
        except (SlotUnavailableError, IntegrityError) as exc:
            db.rollback()
            message = "The requested replacement slot is unavailable"
            operation = _operation(db, input.operation_id)
            operation.error_code = "RESCHEDULE_SLOT_UNAVAILABLE"
            operation.error_message = message
            db.commit()
            raise ApplicationError(
                message,
                non_retryable=True,
                type="SLOT_UNAVAILABLE",
            ) from exc

        return RescheduleResult(
            appointment_timestamp=starts_at.timestamp(),
            schedule_version=next_version,
            reminder_hours=settings.appointment_reminder_hours,
            previous_status=previous_status,
        )
    finally:
        db.close()


@activity.defn
def send_booking_notification(input: NotificationInput) -> bool:
    db = SessionLocal()
    try:
        operation = _operation(db, input.operation_id)
        if (
            input.schedule_version is not None
            and operation.schedule_version != input.schedule_version
        ):
            return False
        appointment = db.query(Appointment).filter(Appointment.id == operation.appointment_id).first()
        patient = db.query(Patient).filter(Patient.id == operation.patient_id).first()
        specialist = db.query(User).filter(User.id == operation.specialist_id).first()
        if not appointment or not patient or not specialist:
            raise ApplicationError("Notification context is unavailable", type="NOTIFICATION_CONTEXT_MISSING")

        recipient_type = input.recipient_type.strip().upper()
        recipient_id = patient.id if recipient_type == "PATIENT" else specialist.id
        key = (
            f"{operation.id}:{input.notification_type}:{recipient_type}:"
            f"v{operation.schedule_version}:{input.occurrence}:IN_APP"
        )
        delivery = db.query(NotificationDelivery).filter(
            NotificationDelivery.idempotency_key == key
        ).first()
        if delivery and delivery.status == "DELIVERED":
            return False
        if not delivery:
            delivery = NotificationDelivery(
                id=str(uuid.uuid4()),
                idempotency_key=key,
                operation_id=operation.id,
                appointment_id=appointment.id,
                recipient_id=recipient_id,
                recipient_type=recipient_type,
                channel="IN_APP",
                notification_type=input.notification_type,
                schedule_version=operation.schedule_version,
                status="PENDING",
            )
            db.add(delivery)
            db.flush()

        titles = {
            "BOOKING_REQUESTED": "Appointment Request Received",
            "BOOKING_CONFIRMATION_REQUIRED": "Appointment Confirmation Required",
            "APPOINTMENT_CONFIRMED": "Appointment Confirmed",
            "APPOINTMENT_CANCELLED": "Appointment Cancelled",
            "APPOINTMENT_REMINDER": "Appointment Reminder",
            "APPOINTMENT_RESCHEDULED": "Appointment Rescheduled",
        }
        title = titles.get(input.notification_type, "Appointment Update")
        when = appointment.appointment_date.strftime("%B %d, %Y at %I:%M %p")
        if input.notification_type == "BOOKING_CONFIRMATION_REQUIRED":
            message = f"Please review the appointment request for {patient.full_name} on {when}."
        elif input.notification_type == "APPOINTMENT_REMINDER":
            message = f"Reminder: the appointment with {specialist.full_name} is scheduled for {when}."
        elif input.notification_type == "APPOINTMENT_RESCHEDULED":
            message = (
                f"The appointment for {patient.full_name} has been moved to {when}."
                if recipient_type == "SPECIALIST"
                else f"The appointment with {specialist.full_name} has been moved to {when}."
            )
        else:
            message = f"Appointment with {specialist.full_name} on {when}: {title}."

        existing_notification = db.query(Notification).filter(
            Notification.deduplication_key == key
        ).first()
        if not existing_notification:
            NotificationService.create_notification(
                db,
                NotificationCreate(
                    recipient_id=str(recipient_id),
                    recipient_type=recipient_type,
                    appointment_id=str(appointment.id),
                    notification_type=input.notification_type,
                    title=title,
                    message=message,
                    related_data={
                        "operation_id": operation.id,
                        "appointment_date": appointment.appointment_date.isoformat(),
                        "schedule_version": operation.schedule_version,
                    },
                    deduplication_key=key,
                ),
            )
        delivery.status = "DELIVERED"
        delivery.attempt_count = (delivery.attempt_count or 0) + 1
        delivery.delivered_at = datetime.now(timezone.utc)
        db.commit()
        return True
    finally:
        db.close()


@activity.defn
def mark_reminders_scheduled(input: OperationRef) -> None:
    db = SessionLocal()
    try:
        operation = _operation(db, input.operation_id)
        if operation.status in {"CONFIRMED", "RESCHEDULED"}:
            operation.status = "REMINDER_SCHEDULED"
            db.commit()
    finally:
        db.close()
