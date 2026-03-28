-- BloomCare PostgreSQL Schema

CREATE SCHEMA IF NOT EXISTS hemas;
SET search_path TO hemas;

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

-- USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role user_role DEFAULT 'FRONTLINE_STAFF',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- PATIENTS
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    national_id VARCHAR(100) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    date_of_birth DATE,
    contact_number VARCHAR(50),
    emergency_contact VARCHAR(50),
    blood_group VARCHAR(10),
    registered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    assigned_worker_id UUID REFERENCES users(id) ON DELETE SET NULL
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

    edge_risk_classification risk_tier,
    edge_risk_score DECIMAL(4,3),
    device_id VARCHAR(100),

    collected_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- STAGE 2
CREATE TABLE IF NOT EXISTS stage2_diagnostics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    specialist_id UUID REFERENCES users(id) ON DELETE SET NULL,
    gestational_age_weeks INT NOT NULL,

    sflt1_plgf_ratio DECIMAL(8,2),
    plgf_absolute DECIMAL(8,2),
    papp_a DECIMAL(8,2),
    cervical_length_mm DECIMAL(5,2),

    metabolomics JSONB,
    doppler JSONB,

    cluster_profile JSONB,
    condition_probabilities JSONB,
    overall_severity_score DECIMAL(4,3),
    dominant_condition VARCHAR(100),

    evaluated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- APPOINTMENTS
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    specialist_id UUID REFERENCES users(id) ON DELETE SET NULL,
    appointment_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) DEFAULT 'SCHEDULED',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

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
CREATE TRIGGER trg_stage1_escalation
AFTER INSERT ON stage1_screenings
FOR EACH ROW
EXECUTE FUNCTION trigger_auto_escalate();