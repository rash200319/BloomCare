-- BloomCare PostgreSQL Schema
-- 
-- RECENT CHANGES (April 2026):
-- 1. Added OTP Records table (otp_records) for password reset and two-factor authentication
-- 2. Updated appointments.status constraint to include 'SCHEDULED' status for auto-escalation
-- 3. Enhanced trigger_auto_escalate() function to set appointment status to 'SCHEDULED'
--
-- FEATURES:
-- - Two-stage maternal risk screening (Stage 1: Edge/Mobile, Stage 2: Server ML)
-- - OTP-based password reset for patients and staff
-- - Automatic appointment escalation for high-risk cases
-- - Patient longitudinal tracking with screening reports
-- - Medical prescriptions management
-- - Device sync logging for offline-first mobile app

CREATE SCHEMA IF NOT EXISTS "BloomCare";
SET search_path TO "BloomCare";

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUMS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'FRONTLINE_STAFF', 'CLINICAL_SPECIALIST', 'PATIENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Existing databases may still have legacy OBSERTITIAN enum label.
-- migrate_roles.sql upgrades those DBs to CLINICAL_SPECIALIST.

DO $$ BEGIN
    CREATE TYPE risk_tier AS ENUM ('routine_care', 'escalate');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role user_role DEFAULT 'FRONTLINE_STAFF',
    is_active BOOLEAN DEFAULT TRUE,
    first_time_login BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    specialization VARCHAR(100), -- For specialists, e.g., "Obstetrics", "Cardiology"
    phone_number VARCHAR(20)
);

-- PATIENTS
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    national_id VARCHAR(100) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    age INT,
    due_date DATE,
    contact_number VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    hashed_password VARCHAR(255) NOT NULL,
    emergency_contact VARCHAR(50),
    blood_group VARCHAR(10),
    first_time_login BOOLEAN DEFAULT TRUE,
    registered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    assigned_worker_id UUID REFERENCES users(id) ON DELETE SET NULL
);



-- OTP RECORDS (One-Time Password for password reset and authentication)
CREATE TABLE IF NOT EXISTS otp_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User References (patient or staff - one will be set, other will be NULL)
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- OTP Data
    otp_code VARCHAR(6) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    otp_type VARCHAR(50) NOT NULL CHECK (otp_type IN ('PASSWORD_RESET', 'FIRST_LOGIN', 'LOGIN_VERIFICATION', 'ACCOUNT_VERIFICATION')),
    destination VARCHAR(255) NOT NULL,  -- Phone number or email
    
    -- Verification Status
    is_verified BOOLEAN DEFAULT FALSE,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    
    -- Request Metadata
    ip_address VARCHAR(50),
    user_agent VARCHAR(512)
);

-- OTP Indexes
CREATE INDEX IF NOT EXISTS idx_otp_records_patient_id ON otp_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_otp_records_staff_id ON otp_records(staff_id);
CREATE INDEX IF NOT EXISTS idx_otp_records_otp_code ON otp_records(otp_code);
CREATE INDEX IF NOT EXISTS idx_otp_records_otp_type ON otp_records(otp_type);
CREATE INDEX IF NOT EXISTS idx_otp_records_is_verified ON otp_records(is_verified);
CREATE INDEX IF NOT EXISTS idx_otp_records_expires_at ON otp_records(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_records_created_at ON otp_records(created_at);

-- LONGITUDINAL SCREENING REPORTS
CREATE TABLE IF NOT EXISTS screening_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    general_risk_flag VARCHAR(10) NOT NULL CHECK (general_risk_flag IN ('High', 'Low')),
    probability_score DECIMAL(6,5) NOT NULL CHECK (probability_score >= 0 AND probability_score <= 1),
    triggers JSONB NOT NULL DEFAULT '[]'::jsonb,
    screened_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- STAGE 1
CREATE TABLE IF NOT EXISTS stage1_screenings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES users(id) ON DELETE SET NULL,
    encounter_id VARCHAR(100),
    gestational_age_weeks INT NOT NULL,

    age INT,
    systolic INT,
    diastolic INT,
    bmi DECIMAL(5,2),
    heart_rate INT,
    temperature DECIMAL(4,1),
    blood_sugar DECIMAL(5,2),
    hemoglobin DECIMAL(4,2),
    pcos BOOLEAN,
    previous_complications BOOLEAN,
    preexisting_diabetes BOOLEAN,
    mental_health INTEGER,
    sleep_pattern INTEGER,
    exercise INTEGER,
    education INTEGER,

    edge_risk_classification risk_tier,
    edge_risk_score DECIMAL(4,3),
    
    -- Contributing factors that led to high risk (feature importance from model)
    contributing_factors JSONB,
    -- Disease-priority context for Stage 2 model selection
    -- Example: {"recommended_primary_disease":"preeclampsia","scores":{"preeclampsia":0.72,"gdm":0.41,"preterm":0.38},"reasons":[...]}
    stage2_priority JSONB,
    
    device_id VARCHAR(100),

    collected_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP

);

-- STAGE 2
CREATE TABLE IF NOT EXISTS stage2_diagnostics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    specialist_id UUID REFERENCES users(id) ON DELETE SET NULL,
    stage1_screening_id UUID REFERENCES stage1_screenings(id) ON DELETE SET NULL,
    gestational_age_weeks INT NOT NULL,

    -- Disease being checked (from stage 1 high risk)
    primary_disease_checked VARCHAR(50),
    model_used VARCHAR(100),

    sflt1_plgf_ratio DECIMAL(8,2),
    plgf_absolute DECIMAL(8,2),
    papp_a DECIMAL(8,2),
    cervical_length_mm DECIMAL(5,2),

    metabolomics JSONB,
    doppler JSONB,
    
    -- Disease-specific inputs
    disease_specific_inputs JSONB,

    cluster_profile JSONB,
    condition_probabilities JSONB,
    explainability_data JSONB,
    input_snapshot JSONB,
    overall_severity_score DECIMAL(4,3),
    dominant_condition VARCHAR(100),

    evaluated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE stage2_diagnostics
ADD COLUMN IF NOT EXISTS explainability_data JSONB;

ALTER TABLE stage2_diagnostics
ADD COLUMN IF NOT EXISTS input_snapshot JSONB;

-- STAGE 2 RECOMMENDATIONS (doctor manually selects which disease to check based on stage 1 report)
CREATE TABLE IF NOT EXISTS stage2_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    stage1_screening_id UUID REFERENCES stage1_screenings(id) ON DELETE CASCADE,
    
    -- Disease selected by doctor to check
    primary_disease_to_check VARCHAR(50) NOT NULL,  -- e.g., "preeclampsia", "gdm", "preterm"
    model_to_use VARCHAR(100),
    
    -- Clinical reasoning from doctor
    clinical_notes TEXT,
    
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ -- When this recommendation expires
);

-- PATIENT REPORTS (downloadable health reports)
CREATE TABLE IF NOT EXISTS patient_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    stage1_screening_id UUID REFERENCES stage1_screenings(id) ON DELETE CASCADE,
    stage2_diagnostic_id UUID REFERENCES stage2_diagnostics(id) ON DELETE SET NULL,
    
    report_type VARCHAR(50) NOT NULL,  -- "stage1", "stage2", "combined"
    report_title VARCHAR(255),
    
    -- Report content (PDF, JSON, or HTML)
    content_type VARCHAR(50),  -- "pdf", "json", "html"
    report_content JSONB,
    
    -- File metadata
    file_path VARCHAR(500),  -- S3 or local path
    file_size INT,
    
    generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    generated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ
);

-- APPOINTMENTS (Optimized for simplified booking workflow with predefined time slots)
-- Status Workflow: SCHEDULED (auto-created) → COMPLETED (doctor) or CANCELLED (patient/staff)
-- PENDING and CONFIRMED retained for future extensibility but not used in current workflow
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    specialist_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Nullable for patient self-service bookings; the booking operation stores
    -- the authenticated patient responsible for those appointments.
    created_by_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    created_by_role VARCHAR(50) NOT NULL DEFAULT 'FRONTLINE_STAFF',
    appointment_type VARCHAR(100) NOT NULL DEFAULT 'PRENATAL_CHECKUP',
    appointment_date TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 30,
    queue_number INT NOT NULL DEFAULT 0,
    
    -- Status Workflow: SCHEDULED → COMPLETED | CANCELLED
    -- PENDING/CONFIRMED retained for future use
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
    
    -- Status change audit trail
    completed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    cancelled_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Set when the canceller isn't a staff user row (patient self-cancel via
    -- Temporal, or the workflow's own auto-expire timeout). Either this or
    -- cancelled_by_id must be set for a CANCELLED appointment (see
    -- chk_cancelled_appointment_audit below).
    cancelled_by_role VARCHAR(50),
    cancelled_at TIMESTAMPTZ,
    
    -- Notes and metadata
    notes TEXT,
    reason_for_cancellation VARCHAR(255),
    
    -- Timestamps with automatic updates via trigger
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Status validation: only allow defined states
    CONSTRAINT chk_appointment_status CHECK (
        status IN ('PENDING', 'CONFIRMED', 'SCHEDULED', 'COMPLETED', 'CANCELLED')
    ),
    
    -- Appointment type validation
    CONSTRAINT chk_appointment_type CHECK (appointment_type IN (
        'PRENATAL_CHECKUP',
        'ULTRASOUND_SCAN',
        'ROUTINE_FOLLOW_UP',
        'LAB_TEST',
        'GLUCOSE_SCREENING',
        'BLOOD_TEST',
        'HIGH_RISK_FOLLOW_UP',
        'MEDICAL_INTERVENTION'
    )),
    
    -- Queue number must be non-negative
    CONSTRAINT chk_queue_number CHECK (queue_number >= 0),
    
    -- Prevent double-booking: each specialist can have only one appointment per time slot
    -- UNIQUE constraint treats appointment_date as atomic slot identifier
    UNIQUE(specialist_id, appointment_date),
    
    -- Ensure completed and cancelled appointments have timestamp and actor recorded
    CONSTRAINT chk_completed_appointment_audit CHECK (
        (status = 'COMPLETED' AND completed_by_id IS NOT NULL AND completed_at IS NOT NULL)
        OR status != 'COMPLETED'
    ),
    CONSTRAINT chk_cancelled_appointment_audit CHECK (
        (status = 'CANCELLED' AND cancelled_at IS NOT NULL
            AND (cancelled_by_id IS NOT NULL OR cancelled_by_role IS NOT NULL))
        OR status != 'CANCELLED'
    )
);

-- NEW CHANGES: PRESCRIPTIONS
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    specialist_id UUID REFERENCES users(id) ON DELETE SET NULL,
    stage2_diagnostic_id UUID REFERENCES stage2_diagnostics(id) ON DELETE SET NULL,

    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    route VARCHAR(50),
    instructions TEXT,

    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);

-- NOTIFICATIONS (for appointment confirmations and other alerts)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
        'APPOINTMENT_CONFIRMED',
        'APPOINTMENT_CANCELLED',
        'APPOINTMENT_COMPLETED',
        'APPOINTMENT_PENDING',
        'APPOINTMENT_SCHEDULED',
        'APPOINTMENT_REMINDER',
        'APPOINTMENT_RESCHEDULED',
        'BOOKING_REQUESTED',
        'BOOKING_CONFIRMATION_REQUIRED',
        'ESCALATION_ALERT'
    )),
    
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Notification status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    -- Related data (JSON for flexibility)
    related_data JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Notification indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_appointment ON notifications(appointment_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON notifications(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- SYNC LOGS
CREATE TABLE IF NOT EXISTS sync_queue_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id VARCHAR(100),
    payload_hash VARCHAR(255) UNIQUE NOT NULL,
    sync_status VARCHAR(50) DEFAULT 'PENDING',
    error_message TEXT,
    received_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_patients_national_id ON patients(national_id);
CREATE INDEX IF NOT EXISTS idx_patients_contact_number ON patients(contact_number);
CREATE INDEX IF NOT EXISTS idx_screening_reports_patient_time ON screening_reports(patient_id, screened_at DESC);
CREATE INDEX IF NOT EXISTS idx_screening_reports_risk_flag ON screening_reports(general_risk_flag);
CREATE INDEX IF NOT EXISTS idx_stage1_patient_date ON stage1_screenings(patient_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_stage2_patient_date ON stage2_diagnostics(patient_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_creator ON appointments(created_by_id);
CREATE INDEX IF NOT EXISTS idx_appointments_specialist ON appointments(specialist_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_specialist_date ON appointments(specialist_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_specialist_day_queue ON appointments(specialist_id, ((appointment_date AT TIME ZONE 'UTC')::date), queue_number);
CREATE INDEX IF NOT EXISTS idx_appointments_completed ON appointments(completed_at) WHERE status = 'COMPLETED';
CREATE INDEX IF NOT EXISTS idx_appointments_cancelled ON appointments(cancelled_at) WHERE status = 'CANCELLED';

-- VIEW: High Risk Patients
CREATE OR REPLACE VIEW high_risk_patients_view AS
SELECT 
    p.id,
    p.full_name,
    p.contact_number,
    s2.dominant_condition,
    s2.overall_severity_score
FROM patients p
JOIN stage2_diagnostics s2 ON p.id = s2.patient_id
WHERE s2.overall_severity_score >= 0.65;

-- FUNCTION: Sync Conflict Check
CREATE OR REPLACE FUNCTION resolve_sync_conflict(p_hash VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM sync_queue_logs 
        WHERE payload_hash = p_hash AND sync_status = 'SUCCESS'
    );
END;
$$ LANGUAGE plpgsql;

-- FUNCTION: Generic updated_at touch
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TRIGGER FUNCTION: Auto-escalate high-risk patient screening to scheduled appointment
-- When Stage 1 screening marks a patient as 'escalate', automatically create SCHEDULED appointment
CREATE OR REPLACE FUNCTION trigger_auto_escalate()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.edge_risk_classification = 'escalate' THEN
        INSERT INTO appointments (
            patient_id,
            specialist_id,
            created_by_id,
            created_by_role,
            appointment_type,
            appointment_date,
            status,
            notes,
            queue_number
        )
        VALUES (
            NEW.patient_id,
            NULL,  -- No specialist assigned initially; will be assigned from doctor dashboard
            NEW.worker_id,  -- Frontline staff who conducted screening
            'FRONTLINE_STAFF',
            'HIGH_RISK_FOLLOW_UP',
            CURRENT_TIMESTAMP + INTERVAL '1 day',
            'SCHEDULED',
            'AUTO-ESCALATED: Patient marked as high-risk (escalate classification) - requires urgent review',
            0  -- Queue number will be generated/updated by backend
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TRIGGER FUNCTION: Automatically update appointment updated_at timestamp on modification
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TRIGGER FUNCTION: Validate appointment status transitions
-- Ensures only SCHEDULED → COMPLETED or CANCELLED transitions are allowed
CREATE OR REPLACE FUNCTION validate_appointment_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow status changes only for valid transitions
    IF OLD.status = 'SCHEDULED' THEN
        -- From SCHEDULED, can go to COMPLETED or CANCELLED
        IF NEW.status NOT IN ('SCHEDULED', 'COMPLETED', 'CANCELLED') THEN
            RAISE EXCEPTION 'Invalid status transition: % → %', OLD.status, NEW.status;
        END IF;
    ELSIF OLD.status IN ('COMPLETED', 'CANCELLED') THEN
        -- Cannot transition from terminal states
        RAISE EXCEPTION 'Cannot modify % appointment (status: %)', OLD.status, OLD.status;
    END IF;
    
    -- Auto-set completed_at and completed_by context when status changes to COMPLETED
    IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
        IF NEW.completed_at IS NULL THEN
            NEW.completed_at = CURRENT_TIMESTAMP;
        END IF;
    END IF;
    
    -- Auto-set cancelled_at when status changes to CANCELLED
    IF NEW.status = 'CANCELLED' AND OLD.status != 'CANCELLED' THEN
        IF NEW.cancelled_at IS NULL THEN
            NEW.cancelled_at = CURRENT_TIMESTAMP;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TRIGGERS: Apply to appointments table
-- Trigger 1: Auto-escalate high-risk screening to appointments
DROP TRIGGER IF EXISTS trg_stage1_escalation ON stage1_screenings;
CREATE TRIGGER trg_stage1_escalation
AFTER INSERT ON stage1_screenings
FOR EACH ROW
EXECUTE FUNCTION trigger_auto_escalate();

-- Trigger 2: Update appointments.updated_at on modification
DROP TRIGGER IF EXISTS trg_appointments_touch_updated_at ON appointments;
CREATE TRIGGER trg_appointments_touch_updated_at
BEFORE UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION touch_updated_at();

-- Trigger 3: Validate appointment status transitions (SCHEDULED → COMPLETED/CANCELLED)
DROP TRIGGER IF EXISTS trg_appointments_validate_status_transition ON appointments;
CREATE TRIGGER trg_appointments_validate_status_transition
BEFORE UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION validate_appointment_status_transition();

-- TRIGGERS: Apply to other tables
-- Trigger 4: Update patients.updated_at on modification
DROP TRIGGER IF EXISTS trg_patients_touch_updated_at ON patients;
CREATE TRIGGER trg_patients_touch_updated_at
BEFORE UPDATE ON patients
FOR EACH ROW
EXECUTE FUNCTION touch_updated_at();

-- Trigger 5: Update stage1_screenings.updated_at on modification
DROP TRIGGER IF EXISTS trg_stage1_touch_updated_at ON stage1_screenings;
CREATE TRIGGER trg_stage1_touch_updated_at
BEFORE UPDATE ON stage1_screenings
FOR EACH ROW
EXECUTE FUNCTION touch_updated_at();
