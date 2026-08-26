from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from temporalio import activity
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from backend.orchestration.appointments.contracts import (
    BookingDecisionCommand,
    BookingRescheduleCommand,
    BookingTiming,
    BookingWorkflowInput,
    FinalizeDecisionInput,
    NotificationInput,
    OperationRef,
    RescheduleActivityInput,
    RescheduleResult,
)
from backend.orchestration.appointments.workflow import AppointmentBookingWorkflow


@activity.defn(name="validate_booking")
async def mock_validate_booking(_input: OperationRef) -> None:
    return None


@activity.defn(name="reserve_booking_slot")
async def mock_reserve_booking_slot(_input: OperationRef) -> str:
    return "reservation-id"


@activity.defn(name="create_reserved_appointment")
async def mock_create_reserved_appointment(_input: OperationRef) -> str:
    return "appointment-id"


@activity.defn(name="send_booking_notification")
async def mock_send_booking_notification(_input: NotificationInput) -> bool:
    return True


@activity.defn(name="get_booking_timing")
async def mock_get_booking_timing(_input: OperationRef) -> BookingTiming:
    return BookingTiming(
        appointment_timestamp=(datetime.now(timezone.utc) + timedelta(days=2)).timestamp(),
        schedule_version=1,
        reminder_hours=[24, 2],
        confirmation_timeout_seconds=1,
    )


@activity.defn(name="finalize_booking_decision")
async def mock_finalize_booking_decision(input: FinalizeDecisionInput) -> str:
    return {
        "CONFIRM": "CONFIRMED",
        "CANCEL": "CANCELLED",
        "COMPLETE": "COMPLETED",
        "EXPIRE": "EXPIRED",
    }[input.decision]


@activity.defn(name="mark_reminders_scheduled")
async def mock_mark_reminders_scheduled(_input: OperationRef) -> None:
    return None


@activity.defn(name="reschedule_booking")
async def mock_reschedule_booking(input: RescheduleActivityInput) -> RescheduleResult:
    return RescheduleResult(
        appointment_timestamp=input.appointment_timestamp,
        schedule_version=input.target_schedule_version,
        reminder_hours=[24, 2],
        previous_status="AWAITING_CONFIRMATION",
    )


@pytest.mark.asyncio
async def test_workflow_durably_expires_without_human_confirmation():
    try:
        environment = await WorkflowEnvironment.start_time_skipping()
    except Exception as exc:  # pragma: no cover - only for restricted CI networks
        pytest.skip(f"Temporal test server is unavailable: {exc}")

    async with environment:
        async with Worker(
            environment.client,
            task_queue="test-appointments",
            workflows=[AppointmentBookingWorkflow],
            activities=[
                mock_validate_booking,
                mock_reserve_booking_slot,
                mock_create_reserved_appointment,
                mock_send_booking_notification,
                mock_get_booking_timing,
                mock_finalize_booking_decision,
                mock_mark_reminders_scheduled,
                mock_reschedule_booking,
            ],
        ):
            result = await environment.client.execute_workflow(
                AppointmentBookingWorkflow.run,
                BookingWorkflowInput(operation_id="operation-id"),
                id="test-booking-expiry",
                task_queue="test-appointments",
            )
            assert result == "EXPIRED"


@pytest.mark.asyncio
async def test_workflow_accepts_human_confirmation_and_completion_updates():
    try:
        environment = await WorkflowEnvironment.start_time_skipping()
    except Exception as exc:  # pragma: no cover - only for restricted CI networks
        pytest.skip(f"Temporal test server is unavailable: {exc}")

    async with environment:
        async with Worker(
            environment.client,
            task_queue="test-appointment-decisions",
            workflows=[AppointmentBookingWorkflow],
            activities=[
                mock_validate_booking,
                mock_reserve_booking_slot,
                mock_create_reserved_appointment,
                mock_send_booking_notification,
                mock_get_booking_timing,
                mock_finalize_booking_decision,
                mock_mark_reminders_scheduled,
                mock_reschedule_booking,
            ],
        ):
            handle = await environment.client.start_workflow(
                AppointmentBookingWorkflow.run,
                BookingWorkflowInput(operation_id="decision-operation"),
                id="test-booking-decision",
                task_queue="test-appointment-decisions",
            )

            for _ in range(200):
                if await handle.query(AppointmentBookingWorkflow.state) == "AWAITING_CONFIRMATION":
                    break
                await asyncio.sleep(0.01)
            else:
                pytest.fail("Workflow did not reach confirmation state")

            reschedule_message = await handle.execute_update(
                AppointmentBookingWorkflow.reschedule,
                BookingRescheduleCommand(
                    appointment_timestamp=(datetime.now(timezone.utc) + timedelta(days=3)).timestamp(),
                    duration_minutes=45,
                    reason="Patient requested a later date",
                ),
            )
            assert "schedule version 2" in reschedule_message

            message = await handle.execute_update(
                AppointmentBookingWorkflow.decide,
                BookingDecisionCommand(decision="CONFIRM"),
            )
            assert message == "CONFIRM applied"

            for _ in range(200):
                phase = await handle.query(AppointmentBookingWorkflow.state)
                if phase in {"REMINDER_SCHEDULED", "AWAITING_COMPLETION"}:
                    break
                await asyncio.sleep(0.01)
            else:
                pytest.fail("Workflow did not schedule reminders")

            await handle.execute_update(
                AppointmentBookingWorkflow.decide,
                BookingDecisionCommand(decision="COMPLETE"),
            )
            assert await handle.result() == "COMPLETED"
