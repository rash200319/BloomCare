from dataclasses import dataclass


@dataclass
class BookingWorkflowInput:
    operation_id: str
    max_activity_attempts: int = 5
    activity_timeout_seconds: int = 30


@dataclass
class OperationRef:
    operation_id: str


@dataclass
class BookingDecisionCommand:
    decision: str


@dataclass
class BookingRescheduleCommand:
    appointment_timestamp: float
    duration_minutes: int
    reason: str | None = None


@dataclass
class RescheduleActivityInput:
    operation_id: str
    appointment_timestamp: float
    duration_minutes: int
    target_schedule_version: int
    reason: str | None = None


@dataclass
class FinalizeDecisionInput:
    operation_id: str
    decision: str


@dataclass
class NotificationInput:
    operation_id: str
    notification_type: str
    recipient_type: str
    occurrence: str = "once"
    schedule_version: int | None = None


@dataclass
class BookingTiming:
    appointment_timestamp: float
    schedule_version: int
    reminder_hours: list[int]
    confirmation_timeout_seconds: int


@dataclass
class RescheduleResult:
    appointment_timestamp: float
    schedule_version: int
    reminder_hours: list[int]
    previous_status: str
