-- BloomCare PostgreSQL Schema

CREATE SCHEMA IF NOT EXISTS "BloomCare";
SET search_path TO "BloomCare";

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUMS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'FRONTLINE_STAFF', 'CLINICAL_SPECIALIST', 'PATIENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE risk_tier AS ENUM ('routine_care', 'escalate');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- SEQUENCES FOR USER ID GENERATION
CREATE SEQUENCE IF NOT EXISTS fls_id_sequence START 1;
CREATE SEQUENCE IF NOT EXISTS doc_id_sequence START 1;
CREATE SEQUENCE IF NOT EXISTS pat_id_sequence START 1;

-- USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    nic VARCHAR(100) UNIQUE NOT NULL,
    telephone VARCHAR(20) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    birthday DATE,
    hashed_password VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'FRONTLINE_STAFF',
    specialization VARCHAR(255),  -- Only for CLINICAL_SPECIALIST role
    is_active BOOLEAN DEFAULT TRUE,
    is_first_login BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- PATIENTS
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    national_id VARCHAR(100) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    age INT,
    date_of_birth DATE,
    contact_number VARCHAR(50),
    emergency_contact VARCHAR(50),
    blood_group VARCHAR(10),
    hashed_password VARCHAR(255) NOT NULL,
    registered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    assigned_worker_id UUID REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE patients
ADD COLUMN IF NOT EXISTS age INT;

-- INDEXES FOR USER_ID AND NIC
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_nic ON users(nic);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_national_id ON patients(national_id);

-- FUNCTION: Generate unique user_id based on role
CREATE OR REPLACE FUNCTION generate_user_id(p_role user_role)
RETURNS VARCHAR AS $$
DECLARE
    v_sequence_val BIGINT;
    v_prefix VARCHAR;
    v_user_id VARCHAR;
BEGIN
    IF p_role = 'FRONTLINE_STAFF' THEN
        v_sequence_val := nextval('fls_id_sequence');
        v_prefix := 'FLS';
    ELSIF p_role = 'CLINICAL_SPECIALIST' THEN
        v_sequence_val := nextval('doc_id_sequence');
        v_prefix := 'DOC';
    ELSIF p_role = 'PATIENT' THEN
        v_sequence_val := nextval('pat_id_sequence');
        v_prefix := 'PAT';
    ELSE
        RAISE EXCEPTION 'Invalid role for user_id generation: %', p_role;
    END IF;
    
    v_user_id := v_prefix || '-' || LPAD(v_sequence_val::TEXT, 4, '0');
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- TRIGGER: Auto-generate user_id on insert
CREATE OR REPLACE FUNCTION trigger_generate_user_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_id IS NULL OR NEW.user_id = '' THEN
        NEW.user_id := generate_user_id(NEW.role);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_user_id ON users;
CREATE TRIGGER trg_generate_user_id
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION trigger_generate_user_id();

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
    mental_health FLOAT,
    sleep_pattern FLOAT,
    exercise FLOAT,
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
    overall_severity_score DECIMAL(4,3),
    dominant_condition VARCHAR(100),

    evaluated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

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

-- APPOINTMENTS
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    specialist_id UUID REFERENCES users(id) ON DELETE SET NULL,
    appointment_date TIMESTAMPTZ NOT NULL,
    duration_minutes INT DEFAULT 30,  -- Appointment duration in minutes
    queue_number INT,  -- Queue number for the day (resets daily per specialist)
    status VARCHAR(50) DEFAULT 'SCHEDULED',  -- SCHEDULED, COMPLETED, CANCELLED
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES FOR APPOINTMENTS
CREATE INDEX IF NOT EXISTS idx_appointments_specialist_date ON appointments(specialist_id, DATE(appointment_date));
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_specialist_queue ON appointments(specialist_id, DATE(appointment_date), queue_number);

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

-- FUNCTION: Get next queue number for specialist on a given date
CREATE OR REPLACE FUNCTION get_next_queue_number(p_specialist_id UUID, p_appointment_date TIMESTAMPTZ)
RETURNS INT AS $$
DECLARE
    v_next_queue INT;
BEGIN
    SELECT COALESCE(MAX(queue_number), 0) + 1 INTO v_next_queue
    FROM appointments
    WHERE specialist_id = p_specialist_id
      AND DATE(appointment_date) = DATE(p_appointment_date)
      AND status != 'CANCELLED';
    
    RETURN v_next_queue;
END;
$$ LANGUAGE plpgsql;

-- FUNCTION: Check for double booking (same specialist, same date, overlapping time)
CREATE OR REPLACE FUNCTION check_double_booking(
    p_specialist_id UUID, 
    p_appointment_date TIMESTAMPTZ, 
    p_duration_minutes INT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_appointment_end TIMESTAMPTZ;
BEGIN
    v_appointment_end := p_appointment_date + (p_duration_minutes || ' minutes')::INTERVAL;
    
    RETURN EXISTS (
        SELECT 1 FROM appointments
        WHERE specialist_id = p_specialist_id
          AND DATE(appointment_date) = DATE(p_appointment_date)
          AND status != 'CANCELLED'
          AND appointment_date < v_appointment_end
          AND (appointment_date + (duration_minutes || ' minutes')::INTERVAL) > p_appointment_date
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

-- TRIGGER: Update appointments updated_at
DROP TRIGGER IF EXISTS trg_appointments_touch_updated_at ON appointments;
CREATE TRIGGER trg_appointments_touch_updated_at
BEFORE UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION touch_updated_at();

-- TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION trigger_auto_escalate()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.edge_risk_classification = 'escalate' THEN
        INSERT INTO appointments (patient_id, appointment_date, status, notes)
        VALUES (
            NEW.patient_id,
            CURRENT_TIMESTAMP + INTERVAL '1 day',
            'SCHEDULED',
            'AUTO-ESCALATED: urgent review required'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TRIGGER
DROP TRIGGER IF EXISTS trg_stage1_escalation ON stage1_screenings;
CREATE TRIGGER trg_stage1_escalation
AFTER INSERT ON stage1_screenings
FOR EACH ROW
EXECUTE FUNCTION trigger_auto_escalate();

-- TRIGGERS: updated_at
DROP TRIGGER IF EXISTS trg_patients_touch_updated_at ON patients;
CREATE TRIGGER trg_patients_touch_updated_at
BEFORE UPDATE ON patients
FOR EACH ROW
EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_stage1_touch_updated_at ON stage1_screenings;
CREATE TRIGGER trg_stage1_touch_updated_at
BEFORE UPDATE ON stage1_screenings
FOR EACH ROW
EXECUTE FUNCTION touch_updated_at();