-- BloomCare Temporal appointment orchestration migration (PostgreSQL 15+).
-- Apply with the BloomCare schema on the search_path or run as a schema owner.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "BloomCare".appointments
    ADD COLUMN IF NOT EXISTS booking_operation_id VARCHAR(36),
    ADD COLUMN IF NOT EXISTS schedule_version INTEGER NOT NULL DEFAULT 1;

-- Patient self-service bookings do not have a staff user to place in this
-- legacy creator column. Their actor is captured by patient_id on the booking
-- operation and created_by_role='PATIENT' on the appointment.
ALTER TABLE "BloomCare".appointments
    ALTER COLUMN created_by_id DROP NOT NULL;

ALTER TABLE "BloomCare".notifications
    ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(30) NOT NULL DEFAULT 'STAFF',
    ADD COLUMN IF NOT EXISTS deduplication_key VARCHAR(255);

-- Recipients can live in either users or patients, so this is a polymorphic
-- application-enforced reference rather than a users-only foreign key.
ALTER TABLE "BloomCare".notifications
    DROP CONSTRAINT IF EXISTS notifications_recipient_id_fkey;

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
        'BOOKING_REQUESTED',
        'BOOKING_CONFIRMATION_REQUIRED',
        'ESCALATION_ALERT'
    ));

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_deduplication_key
    ON "BloomCare".notifications (deduplication_key)
    WHERE deduplication_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS "BloomCare".appointment_booking_operations (
    id VARCHAR(36) PRIMARY KEY,
    workflow_id VARCHAR(255) NOT NULL UNIQUE,
    idempotency_key VARCHAR(255) NOT NULL,
    patient_id UUID NOT NULL REFERENCES "BloomCare".patients(id) ON DELETE CASCADE,
    specialist_id UUID NOT NULL REFERENCES "BloomCare".users(id) ON DELETE RESTRICT,
    appointment_id UUID REFERENCES "BloomCare".appointments(id) ON DELETE SET NULL,
    appointment_date TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    appointment_type VARCHAR(100) NOT NULL DEFAULT 'PRENATAL_CHECKUP',
    notes TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'REQUESTED',
    schedule_version INTEGER NOT NULL DEFAULT 1,
    decision_reason TEXT,
    error_code VARCHAR(100),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    CONSTRAINT uq_booking_patient_idempotency UNIQUE (patient_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS "BloomCare".appointment_slot_reservations (
    id VARCHAR(36) PRIMARY KEY,
    operation_id VARCHAR(36) NOT NULL REFERENCES "BloomCare".appointment_booking_operations(id) ON DELETE CASCADE,
    specialist_id UUID NOT NULL REFERENCES "BloomCare".users(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES "BloomCare".appointments(id) ON DELETE SET NULL,
    schedule_version INTEGER NOT NULL DEFAULT 1,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    expires_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_reservation_operation_version UNIQUE (operation_id, schedule_version)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'exclude_overlapping_specialist_reservations'
    ) THEN
        ALTER TABLE "BloomCare".appointment_slot_reservations
            ADD CONSTRAINT exclude_overlapping_specialist_reservations
            EXCLUDE USING gist (
                specialist_id WITH =,
                tstzrange(starts_at, ends_at, '[)') WITH &&
            ) WHERE (status = 'ACTIVE');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "BloomCare".workflow_outbox (
    id VARCHAR(36) PRIMARY KEY,
    operation_id VARCHAR(36) NOT NULL UNIQUE REFERENCES "BloomCare".appointment_booking_operations(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL DEFAULT 'START_APPOINTMENT_BOOKING',
    payload JSONB NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dispatched_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "BloomCare".notification_deliveries (
    id VARCHAR(36) PRIMARY KEY,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    operation_id VARCHAR(36) NOT NULL REFERENCES "BloomCare".appointment_booking_operations(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES "BloomCare".appointments(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL,
    recipient_type VARCHAR(30) NOT NULL,
    channel VARCHAR(30) NOT NULL DEFAULT 'IN_APP',
    notification_type VARCHAR(100) NOT NULL,
    schedule_version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    provider_message_id VARCHAR(255),
    last_error TEXT,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_booking_operation
    ON "BloomCare".appointments (booking_operation_id)
    WHERE booking_operation_id IS NOT NULL;
