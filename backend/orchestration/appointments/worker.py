from __future__ import annotations

import asyncio
import concurrent.futures
import logging
import sys

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
    if not settings.TEMPORAL_ENABLED:
        # Previously this flag only gated the confirm/cancel/reschedule API
        # endpoints -- the worker itself started and fully orchestrated
        # bookings regardless of its value. That let TEMPORAL_ENABLED=false
        # (the config default) silently mean nothing if a worker happened to
        # be running. Make it an actual kill switch: refuse to start.
        logger.error(
            "TEMPORAL_ENABLED is false -- refusing to start the worker. "
            "Set TEMPORAL_ENABLED=true in backend/.env if appointment "
            "orchestration should actually run."
        )
        sys.exit(1)

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


def _run_main() -> None:
    """Plain sync entry point so it's picklable for watchfiles' subprocess
    restart on Windows (spawn start method can't pickle a lambda/closure)."""
    asyncio.run(main())


if __name__ == "__main__":
    if "--reload" in sys.argv:
        # Unlike uvicorn's --reload, editing workflow.py/activities.py/
        # contracts.py previously had zero effect on a running worker -- it
        # kept executing whatever was loaded at startup until manually
        # killed and restarted, which is exactly what produced confusing,
        # hard-to-attribute failures earlier. This mirrors uvicorn's own
        # reload mechanism (same watchfiles package) for local development.
        from pathlib import Path

        from watchfiles import run_process

        # run_process spawns the actual worker as a second process (this one
        # just watches files and restarts it), so seeing two python.exe
        # processes here is expected, not a duplicate/leak. On Windows that
        # child briefly shows up under the base Python install's path rather
        # than this venv's -- that's CPython's own venv-spawn redirect
        # (bpo-35797): it re-execs through the base interpreter with
        # __PYVENV_LAUNCHER__ set, which re-activates this same venv, so the
        # child still runs with this venv's site-packages and dependencies.
        backend_dir = str(Path(__file__).resolve().parents[2])
        logger.info("Starting worker with --reload, watching %s", backend_dir)
        run_process(backend_dir, target=_run_main)
    else:
        _run_main()
