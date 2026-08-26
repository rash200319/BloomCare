from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from backend.db.session import SessionLocal
from backend.models.appointment_operation import AppointmentBookingOperation
from backend.models.workflow_outbox import WorkflowOutbox
from backend.orchestration.appointments.temporal_client import start_appointment_workflow

logger = logging.getLogger(__name__)


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

