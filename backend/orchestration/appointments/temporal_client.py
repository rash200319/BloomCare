from __future__ import annotations

from typing import Any

from backend.core.config import settings

_client: Any = None


async def get_temporal_client():
    """Return a process-local Temporal client, connecting lazily."""
    global _client
    if _client is not None:
        return _client

    from temporalio.client import Client

    kwargs: dict[str, Any] = {
        "namespace": settings.TEMPORAL_NAMESPACE,
        "tls": settings.TEMPORAL_TLS_ENABLED,
    }
    if settings.TEMPORAL_API_KEY:
        kwargs["api_key"] = settings.TEMPORAL_API_KEY
    _client = await Client.connect(settings.TEMPORAL_ADDRESS, **kwargs)
    return _client


async def start_appointment_workflow(operation_id: str, workflow_id: str) -> None:
    from temporalio.common import WorkflowIDReusePolicy

    from backend.orchestration.appointments.contracts import BookingWorkflowInput
    from backend.orchestration.appointments.workflow import AppointmentBookingWorkflow

    client = await get_temporal_client()
    await client.start_workflow(
        AppointmentBookingWorkflow.run,
        BookingWorkflowInput(
            operation_id=operation_id,
            max_activity_attempts=settings.TEMPORAL_MAX_ACTIVITY_ATTEMPTS,
            activity_timeout_seconds=settings.TEMPORAL_ACTIVITY_TIMEOUT_SECONDS,
        ),
        id=workflow_id,
        task_queue=settings.TEMPORAL_APPOINTMENT_TASK_QUEUE,
        id_reuse_policy=WorkflowIDReusePolicy.REJECT_DUPLICATE,
    )


async def submit_booking_decision(workflow_id: str, decision: str) -> str:
    from backend.orchestration.appointments.contracts import BookingDecisionCommand
    from backend.orchestration.appointments.workflow import AppointmentBookingWorkflow

    client = await get_temporal_client()
    handle = client.get_workflow_handle(workflow_id)
    return await handle.execute_update(
        AppointmentBookingWorkflow.decide,
        BookingDecisionCommand(decision=decision),
    )


async def submit_booking_reschedule(
    workflow_id: str,
    *,
    appointment_timestamp: float,
    duration_minutes: int,
    reason: str | None,
) -> str:
    from backend.orchestration.appointments.contracts import BookingRescheduleCommand
    from backend.orchestration.appointments.workflow import AppointmentBookingWorkflow

    client = await get_temporal_client()
    handle = client.get_workflow_handle(workflow_id)
    return await handle.execute_update(
        AppointmentBookingWorkflow.reschedule,
        BookingRescheduleCommand(
            appointment_timestamp=appointment_timestamp,
            duration_minutes=duration_minutes,
            reason=reason,
        ),
    )
