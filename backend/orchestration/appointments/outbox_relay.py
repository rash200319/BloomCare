from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from backend.core.config import settings
from backend.db.session import SessionLocal
from backend.models.appointment_operation import AppointmentBookingOperation
from backend.models.workflow_outbox import WorkflowOutbox
from backend.orchestration.appointments.temporal_client import start_appointment_workflow

logger = logging.getLogger(__name__)


def _fail_operation(db, operation: AppointmentBookingOperation) -> None:
    """Give up on a booking operation whose workflow could never be started.

    No appointment or reservation exists yet at this point (that only
    happens once the workflow itself runs), so there's nothing to release --
    just surface a clear, terminal error instead of leaving the patient
    polling a REQUESTED operation forever.
    """
    operation.status = "FAILED"
    operation.error_code = "ORCHESTRATION_UNAVAILABLE"
    operation.error_message = (
        "We couldn't process this booking request right now. Please try again "
        "later or contact the clinic directly."
    )
    operation.completed_at = datetime.now(timezone.utc)

    from backend.models.notification import Notification
    from backend.schemas.notification import NotificationCreate
    from backend.services.notification_service import NotificationService

    key = f"appt-operation-failed:{operation.id}"
    if not db.query(Notification).filter(Notification.deduplication_key == key).first():
        NotificationService.create_notification(
            db,
            NotificationCreate(
                recipient_id=str(operation.patient_id),
                recipient_type="PATIENT",
                notification_type="BOOKING_FAILED",
                title="Appointment Request Failed",
                message=(
                    "We couldn't process your appointment request. Please try "
                    "again or contact the clinic to book directly."
                ),
                related_data={"operation_id": operation.id},
                deduplication_key=key,
            ),
        )


async def dispatch_pending_once(limit: int = 20) -> int:
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        rows = (
            db.query(WorkflowOutbox)
            .filter(
                WorkflowOutbox.status == "PENDING",
                WorkflowOutbox.available_at <= now,
            )
            .order_by(WorkflowOutbox.created_at.asc())
            .limit(limit)
            .all()
        )
        dispatched = 0
        for row in rows:
            operation = db.query(AppointmentBookingOperation).filter(
                AppointmentBookingOperation.id == row.operation_id
            ).first()
            if not operation:
                row.status = "FAILED"
                row.last_error = "Booking operation no longer exists"
                continue
            try:
                await start_appointment_workflow(operation.id, operation.workflow_id)
                row.status = "DISPATCHED"
                row.dispatched_at = datetime.now(timezone.utc)
                row.last_error = None
                dispatched += 1
            except Exception as exc:
                # A duplicate workflow ID means an earlier attempt succeeded but
                # the process stopped before the outbox row was acknowledged.
                if exc.__class__.__name__ == "WorkflowAlreadyStartedError":
                    row.status = "DISPATCHED"
                    row.dispatched_at = datetime.now(timezone.utc)
                    row.last_error = None
                    dispatched += 1
                else:
                    row.attempt_count = (row.attempt_count or 0) + 1
                    row.last_error = str(exc)[:2000]
                    if row.attempt_count >= settings.WORKFLOW_OUTBOX_MAX_ATTEMPTS:
                        row.status = "FAILED"
                        logger.error(
                            "Temporal outbox dispatch permanently failed for %s after %s attempts: %s",
                            row.operation_id, row.attempt_count, exc,
                        )
                        _fail_operation(db, operation)
                    else:
                        delay = min(300, 2 ** min(row.attempt_count, 8))
                        row.available_at = datetime.now(timezone.utc) + timedelta(seconds=delay)
                        logger.warning("Temporal outbox dispatch failed for %s: %s", row.operation_id, exc)
            db.commit()
        return dispatched
    finally:
        db.close()


class OutboxRelay:
    def __init__(self, poll_seconds: float = 2.0) -> None:
        self.poll_seconds = poll_seconds
        self._stopping = False

    def stop(self) -> None:
        self._stopping = True

    async def run(self) -> None:
        while not self._stopping:
            await dispatch_pending_once()
            await asyncio.sleep(self.poll_seconds)

