from __future__ import annotations

import asyncio
import concurrent.futures
import logging

from temporalio.worker import Worker

from backend.core.config import settings
from backend.orchestration.appointments.activities import (
    create_reserved_appointment,
    finalize_booking_decision,
    get_booking_timing,
    mark_reminders_scheduled,
    reserve_booking_slot,
    reschedule_booking,
    send_booking_notification,
    validate_booking,
)
from backend.orchestration.appointments.outbox_relay import OutboxRelay
from backend.orchestration.appointments.temporal_client import get_temporal_client
from backend.orchestration.appointments.workflow import AppointmentBookingWorkflow

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main() -> None:
    client = await get_temporal_client()
    relay = OutboxRelay()
    relay_task = asyncio.create_task(relay.run())
    logger.info(
        "Starting BloomCare Temporal worker on task queue %s",
        settings.TEMPORAL_APPOINTMENT_TASK_QUEUE,
    )
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
            worker = Worker(
                client,
                task_queue=settings.TEMPORAL_APPOINTMENT_TASK_QUEUE,
                workflows=[AppointmentBookingWorkflow],
                activities=[
                    validate_booking,
                    reserve_booking_slot,
                    reschedule_booking,
                    create_reserved_appointment,
                    finalize_booking_decision,
                    get_booking_timing,
                    send_booking_notification,
                    mark_reminders_scheduled,
                ],
                activity_executor=executor,
            )
            await worker.run()
    finally:
        relay.stop()
        relay_task.cancel()
        await asyncio.gather(relay_task, return_exceptions=True)


if __name__ == "__main__":
    asyncio.run(main())
