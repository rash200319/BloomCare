-- Adds the patient_notification_preferences table backing the
-- PatientNotificationPreference model and /api/v1/notification-preferences
-- endpoints. The model and API existed without a matching table/migration;
-- this closes that gap so the endpoints and the appointment reminder sweep
-- (backend/services/appointment_reminder_service.py) work against a real DB.
-- Apply with the BloomCare schema on the search_path or run as a schema owner.

CREATE TABLE IF NOT EXISTS "BloomCare".patient_notification_preferences (
    patient_id UUID PRIMARY KEY REFERENCES "BloomCare".patients(id) ON DELETE CASCADE,
    preferred_language VARCHAR(2) NOT NULL DEFAULT 'EN',
    reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_hours VARCHAR(100) NOT NULL DEFAULT '24,2',
    phone_number VARCHAR(50),
    email_address VARCHAR(255),
    push_token TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
