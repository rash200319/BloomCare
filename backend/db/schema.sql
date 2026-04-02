-- BloomCare PostgreSQL Schema

CREATE SCHEMA IF NOT EXISTS "BloomCare";
SET search_path TO "BloomCare";

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUMS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'FRONTLINE_STAFF', 'DOCTOR', 'CLINICAL_SPECIALIST', 'PATIENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

ALTER TABLE patients
ADD COLUMN IF NOT EXISTS age INT;

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

-- APPOINTMENTS
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    specialist_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by_role VARCHAR(50) NOT NULL DEFAULT 'FRONTLINE_STAFF',
    appointment_type VARCHAR(100) NOT NULL DEFAULT 'PRENATAL_CHECKUP',
    appointment_date TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 30,
    queue_number INT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_appointment_status CHECK (status IN ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT chk_appointment_type CHECK (appointment_type IN (
        'PRENATAL_CHECKUP',
        'ULTRASOUND_SCAN',
        'ROUTINE_FOLLOW_UP',
        'LAB_TEST',
        'GLUCOSE_SCREENING',
        'BLOOD_TEST',
        'HIGH_RISK_FOLLOW_UP',
        'MEDICAL_INTERVENTION'
    ))
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