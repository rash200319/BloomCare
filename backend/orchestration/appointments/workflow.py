from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from backend.orchestration.appointments.activities import (
        create_reserved_appointment,
        finalize_booking_decision,
        get_booking_timing,
        mark_reminders_scheduled,
        reserve_booking_slot,
        send_booking_notification,
        validate_booking,
    )
    from backend.orchestration.appointments.contracts import (
        BookingDecisionCommand,
        BookingWorkflowInput,
        FinalizeDecisionInput,
        NotificationInput,
        OperationRef,
    )


@workflow.defn
class AppointmentBookingWorkflow:
    """Durable lifecycle for one patient appointment request."""

    def __init__(self) -> None:
        self._decision: str | None = None
        self._decision_processed = False
        self._phase = "STARTING"
        self._max_activity_attempts = 5
        self._activity_timeout_seconds = 30

    def _retry_policy(self) -> RetryPolicy:
        return RetryPolicy(
            initial_interval=timedelta(seconds=1),
            backoff_coefficient=2.0,
            maximum_interval=timedelta(seconds=30),
            maximum_attempts=self._max_activity_attempts,
        )

    async def _activity(self, fn, arg, *, result_type=None):
        kwargs = {
            "start_to_close_timeout": timedelta(seconds=self._activity_timeout_seconds),
            "retry_policy": self._retry_policy(),
        }
        if result_type is not None:
            kwargs["result_type"] = result_type
        return await workflow.execute_activity(fn, arg, **kwargs)

    @workflow.run
    async def run(self, input: BookingWorkflowInput) -> str:
        self._max_activity_attempts = max(1, input.max_activity_attempts)
        self._activity_timeout_seconds = max(1, input.activity_timeout_seconds)
        ref = OperationRef(operation_id=input.operation_id)
        self._phase = "VALIDATING"
        await self._activity(validate_booking, ref)

        self._phase = "RESERVING_SLOT"
        await self._activity(reserve_booking_slot, ref)

        self._phase = "CREATING_APPOINTMENT"
        await self._activity(create_reserved_appointment, ref)

        await self._activity(
            send_booking_notification,
            NotificationInput(input.operation_id, "BOOKING_REQUESTED", "PATIENT"),
        )
        await self._activity(
            send_booking_notification,
            NotificationInput(input.operation_id, "BOOKING_CONFIRMATION_REQUIRED", "SPECIALIST"),
        )

        timing = await self._activity(get_booking_timing, ref)
        self._phase = "AWAITING_CONFIRMATION"
        try:
            await workflow.wait_condition(
                lambda: self._decision is not None,
                timeout=timedelta(seconds=timing.confirmation_timeout_seconds),
            )
        except asyncio.TimeoutError:
            self._decision = "EXPIRE"

        decision = self._decision or "EXPIRE"
        state = await self._activity(
            finalize_booking_decision,
            FinalizeDecisionInput(input.operation_id, decision),
        )
        self._decision_processed = True
        if state != "CONFIRMED":
            await self._activity(
                send_booking_notification,
                NotificationInput(input.operation_id, "APPOINTMENT_CANCELLED", "PATIENT"),
            )
            self._phase = state
            return state

        await self._activity(
            send_booking_notification,
            NotificationInput(input.operation_id, "APPOINTMENT_CONFIRMED", "PATIENT"),
        )
        await self._activity(mark_reminders_scheduled, ref)
        self._decision = None
        self._phase = "REMINDER_SCHEDULED"

        for hours_before in timing.reminder_hours:
            reminder_at = datetime.fromtimestamp(
                timing.appointment_timestamp, tz=timezone.utc
            ) - timedelta(hours=hours_before)
            delay = reminder_at - workflow.now()
            if delay.total_seconds() <= 0:
                continue
            try:
                await workflow.wait_condition(
                    lambda: self._decision in {"CANCEL", "COMPLETE"},
                    timeout=delay,
                )
            except asyncio.TimeoutError:
                await self._activity(
                    send_booking_notification,
                    NotificationInput(
                        input.operation_id,
                        "APPOINTMENT_REMINDER",
                        "PATIENT",
                        occurrence=f"{hours_before}h",
                    ),
                )
                continue

            state = await self._activity(
                finalize_booking_decision,
                FinalizeDecisionInput(input.operation_id, self._decision or "CANCEL"),
            )
            self._decision_processed = True
            self._phase = state
            return state

        self._phase = "AWAITING_COMPLETION"
        await workflow.wait_condition(lambda: self._decision in {"CANCEL", "COMPLETE"})
        state = await self._activity(
            finalize_booking_decision,
            FinalizeDecisionInput(input.operation_id, self._decision or "COMPLETE"),
        )
        self._decision_processed = True
        self._phase = state
        return state

    @workflow.update
    async def decide(self, command: BookingDecisionCommand) -> str:
        decision = command.decision.strip().upper()
        if decision not in {"CONFIRM", "CANCEL", "COMPLETE"}:
            raise ValueError("Decision must be CONFIRM, CANCEL, or COMPLETE")
        if self._phase in {"COMPLETED", "CANCELLED", "EXPIRED", "REJECTED", "FAILED"}:
            raise ValueError(f"Workflow is already final: {self._phase}")
        if decision == "CONFIRM" and self._phase != "AWAITING_CONFIRMATION":
            raise ValueError("Confirmation is only allowed while awaiting confirmation")
        if decision == "COMPLETE" and self._phase not in {
            "REMINDER_SCHEDULED",
            "AWAITING_COMPLETION",
        }:
            raise ValueError("Completion is only allowed after confirmation")
        self._decision_processed = False
        self._decision = decision
        await workflow.wait_condition(lambda: self._decision_processed)
        return f"{decision} applied"

    @workflow.query
    def state(self) -> str:
        return self._phase
