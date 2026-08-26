-- Adds BOOKING_FAILED to the notification_type check constraint so the
-- outbox relay (backend/orchestration/appointments/outbox_relay.py) can tell
-- a patient their self-service booking request could not be processed after
-- exhausting dispatch retries (WORKFLOW_OUTBOX_MAX_ATTEMPTS), instead of
-- leaving them polling a REQUESTED operation forever.
-- Apply with the BloomCare schema on the search_path or run as a schema owner.

ALTER TABLE "BloomCare".notifications
    DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

ALTER TABLE "BloomCare".notifications
    ADD CONSTRAINT notifications_notification_type_check CHECK (notification_type IN (
        'APPOINTMENT_CONFIRMED',
        'APPOINTMENT_CANCELLED',
        'APPOINTMENT_COMPLETED',
        'APPOINTMENT_PENDING',
        'APPOINTMENT_SCHEDULED',
        'APPOINTMENT_REMINDER',
        'APPOINTMENT_RESCHEDULED',
        'BOOKING_REQUESTED',
        'BOOKING_CONFIRMATION_REQUIRED',
        'BOOKING_FAILED',
        'ESCALATION_ALERT'
    ));
