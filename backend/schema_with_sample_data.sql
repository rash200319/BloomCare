-- ============================================================================
-- BloomCare PostgreSQL Database Schema with Sample Data
-- ============================================================================
-- Create this database and schema by running:
--   psql -U postgres -h localhost -f schema_with_sample_data.sql
-- ============================================================================

-- Create database (if it doesn't exist)
SELECT 'CREATE DATABASE bloomcare'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'bloomcare')\gexec

-- Connect to the bloomcare database
\c bloomcare

-- ============================================================================
-- ENUM Types
-- ============================================================================

CREATE TYPE userrole AS ENUM ('admin', 'doctor', 'frontline', 'patient');
CREATE TYPE risklevel AS ENUM ('low', 'moderate', 'high');
CREATE TYPE appointmentstatus AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');

-- ============================================================================
-- Users Table
-- ============================================================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(16) UNIQUE NOT NULL,
    username VARCHAR(64) UNIQUE NOT NULL,
    hashed_password VARCHAR(256) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    birthday DATE NOT NULL,
    address TEXT NOT NULL,
    telephone VARCHAR(20) NOT NULL,
    nic_number VARCHAR(20) UNIQUE NOT NULL,
    role userrole NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_user_id_format CHECK (user_id ~ '^(PAT|DOC|FLN|ADM)-\d{4}$')
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_nic_number ON users(nic_number);
CREATE INDEX idx_users_user_id ON users(user_id);

-- ============================================================================
-- Patients Table
-- ============================================================================

CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blood_group VARCHAR(5),
    gestational_week INTEGER,
    due_date DATE,
    pregnancy_status VARCHAR(100),
    current_risk_level risklevel,
    assigned_doctor_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patients_user_id ON patients(user_id);
CREATE INDEX idx_patients_assigned_doctor_id ON patients(assigned_doctor_id);

-- ============================================================================
-- Vitals Table
-- ============================================================================

CREATE TABLE vitals (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    recorded_by_id INTEGER REFERENCES users(id),
    age FLOAT,
    bmi FLOAT,
    systolic FLOAT,
    diastolic FLOAT,
    heart_rate FLOAT,
    blood_sugar FLOAT,
    body_temperature FLOAT,
    hemoglobin FLOAT,
    pcos INTEGER,
    previous_complications INTEGER,
    preexisting_diabetes INTEGER,
    mental_health INTEGER,
    sleep_pattern INTEGER,
    exercise INTEGER,
    education INTEGER,
    synced_from_offline BOOLEAN DEFAULT FALSE,
    offline_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vitals_patient_id ON vitals(patient_id);
CREATE INDEX idx_vitals_recorded_by_id ON vitals(recorded_by_id);

-- ============================================================================
-- Risk Records Table
-- ============================================================================

CREATE TABLE risk_records (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    vitals_id INTEGER REFERENCES vitals(id),
    stage VARCHAR(10) NOT NULL,
    condition VARCHAR(50),
    probability FLOAT NOT NULL,
    risk_level risklevel NOT NULL,
    threshold FLOAT,
    recommendations JSONB,
    is_mock BOOLEAN DEFAULT FALSE,
    model_version VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risk_records_patient_id ON risk_records(patient_id);
CREATE INDEX idx_risk_records_stage ON risk_records(stage);

-- ============================================================================
-- Appointments Table
-- ============================================================================

CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id INTEGER REFERENCES users(id),
    appointment_type VARCHAR(100) NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time VARCHAR(10) NOT NULL,
    location VARCHAR(200),
    notes TEXT,
    status appointmentstatus DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);

-- ============================================================================
-- Sync Queue Table
-- ============================================================================

CREATE TABLE sync_queue (
    id SERIAL PRIMARY KEY,
    offline_id VARCHAR(64) UNIQUE NOT NULL,
    payload JSONB NOT NULL,
    synced_at TIMESTAMP WITH TIME ZONE,
    is_synced BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_queue_offline_id ON sync_queue(offline_id);
CREATE INDEX idx_sync_queue_is_synced ON sync_queue(is_synced);

-- ============================================================================
-- SAMPLE DATA - Users (Admin, Doctor, Frontline, Patients)
-- ============================================================================

-- Admin User
-- Password: admin123 (hashed with bcrypt, for demo purposes)
-- Real hashed value from passlib: $2b$12$gSvqqUPvlXP2tfVFaWK1Be7DlH.PKZbv5H8KnzzVgXXbVxzy990DW
INSERT INTO users (user_id, username, hashed_password, full_name, birthday, address, telephone, nic_number, role, is_active)
VALUES (
    'ADM-0001',
    'admin',
    '$2b$12$gSvqqUPvlXP2tfVFaWK1Be7DlH.PKZbv5H8KnzzVgXXbVxzy990DW',
    'Dr. Admin User',
    '1990-01-15'::DATE,
    '123 Admin Street, Capital City',
    '+94771234567',
    '200590123456',
    'admin',
    TRUE
);

-- Doctor Users
INSERT INTO users (user_id, username, hashed_password, full_name, birthday, address, telephone, nic_number, role, is_active)
VALUES 
(
    'DOC-0001',
    'dr_silva',
    '$2b$12$gSvqqUPvlXP2tfVFaWK1Be7DlH.PKZbv5H8KnzzVgXXbVxzy990DW',
    'Dr. Chaminda Silva',
    '1985-03-22'::DATE,
    '456 Medical Complex, Central Hospital',
    '+94771234568',
    '198503122345',
    'doctor',
    TRUE
),
(
    'DOC-0002',
    'dr_peiris',
    '$2b$12$gSvqqUPvlXP2tfVFaWK1Be7DlH.PKZbv5H8KnzzVgXXbVxzy990DW',
    'Dr. Amara Peiris',
    '1988-07-10'::DATE,
    '789 Maternity Ward, General Hospital',
    '+94771234569',
    '198807102345',
    'doctor',
    TRUE
);

-- Frontline Staff
INSERT INTO users (user_id, username, hashed_password, full_name, birthday, address, telephone, nic_number, role, is_active)
VALUES 
(
    'FLN-0001',
    'nurse_kamal',
    '$2b$12$gSvqqUPvlXP2tfVFaWK1Be7DlH.PKZbv5H8KnzzVgXXbVxzy990DW',
    'Nurse Kamal Ratnayake',
    '1992-05-14'::DATE,
    '321 Clinic Street, Rural Health Center',
    '+94771234570',
    '199205142345',
    'frontline',
    TRUE
);

-- Patient Users
INSERT INTO users (user_id, username, hashed_password, full_name, birthday, address, telephone, nic_number, role, is_active)
VALUES 
(
    'PAT-0001',
    'patient_nuwanthika',
    '$2b$12$gSvqqUPvlXP2tfVFaWK1Be7DlH.PKZbv5H8KnzzVgXXbVxzy990DW',
    'Nuwanthika Prasad',
    '1995-02-18'::DATE,
    '654 Residential Road, Colombo 05',
    '+94771234571',
    '199502182345',
    'patient',
    TRUE
),
(
    'PAT-0002',
    'patient_malini',
    '$2b$12$gSvqqUPvlXP2tfVFaWK1Be7DlH.PKZbv5H8KnzzVgXXbVxzy990DW',
    'Malini Jayasena',
    '1993-08-26'::DATE,
    '987 Garden Lane, Kandy',
    '+94771234572',
    '199308262345',
    'patient',
    TRUE
),
(
    'PAT-0003',
    'patient_sunethra',
    '$2b$12$gSvqqUPvlXP2tfVFaWK1Be7DlH.PKZbv5H8KnzzVgXXbVxzy990DW',
    'Sunethra Wickramasinghe',
    '1998-11-05'::DATE,
    '147 Mountain View, Galle',
    '+94771234573',
    '199811052345',
    'patient',
    TRUE
);

-- ============================================================================
-- SAMPLE DATA - Patients (Clinical Profiles)
-- ============================================================================

INSERT INTO patients (user_id, blood_group, gestational_week, due_date, pregnancy_status, current_risk_level, assigned_doctor_id)
VALUES 
(
    (SELECT id FROM users WHERE user_id = 'PAT-0001'),
    'O+',
    28,
    '2026-06-15'::DATE,
    'Active Pregnancy',
    'moderate',
    (SELECT id FROM users WHERE user_id = 'DOC-0001')
),
(
    (SELECT id FROM users WHERE user_id = 'PAT-0002'),
    'A+',
    32,
    '2026-05-20'::DATE,
    'Active Pregnancy',
    'low',
    (SELECT id FROM users WHERE user_id = 'DOC-0002')
),
(
    (SELECT id FROM users WHERE user_id = 'PAT-0003'),
    'B+',
    24,
    '2026-07-10'::DATE,
    'Active Pregnancy',
    'high',
    (SELECT id FROM users WHERE user_id = 'DOC-0001')
);

-- ============================================================================
-- SAMPLE DATA - Vitals
-- ============================================================================

INSERT INTO vitals (patient_id, recorded_by_id, age, bmi, systolic, diastolic, heart_rate, blood_sugar, body_temperature, hemoglobin, 
                   pcos, previous_complications, preexisting_diabetes, mental_health, sleep_pattern, exercise, education)
VALUES 
(
    (SELECT id FROM patients WHERE user_id = (SELECT id FROM users WHERE user_id = 'PAT-0001')),
    (SELECT id FROM users WHERE user_id = 'FLN-0001'),
    28.0,
    23.5,
    135.0,
    88.0,
    78.0,
    110.0,
    37.2,
    11.5,
    0,
    0,
    0,
    7,
    7,
    3,
    4
),
(
    (SELECT id FROM patients WHERE user_id = (SELECT id FROM users WHERE user_id = 'PAT-0002')),
    (SELECT id FROM users WHERE user_id = 'FLN-0001'),
    32.0,
    25.1,
    128.0,
    82.0,
    72.0,
    105.0,
    36.8,
    12.1,
    0,
    1,
    0,
    8,
    8,
    4,
    5
),
(
    (SELECT id FROM patients WHERE user_id = (SELECT id FROM users WHERE user_id = 'PAT-0003')),
    (SELECT id FROM users WHERE user_id = 'FLN-0001'),
    25.0,
    27.3,
    145.0,
    95.0,
    88.0,
    125.0,
    37.5,
    10.2,
    1,
    0,
    1,
    5,
    5,
    1,
    3
);

-- ============================================================================
-- SAMPLE DATA - Risk Records
-- ============================================================================

INSERT INTO risk_records (patient_id, vitals_id, stage, condition, probability, risk_level, threshold, recommendations, is_mock, model_version)
VALUES 
(
    (SELECT id FROM patients WHERE user_id = (SELECT id FROM users WHERE user_id = 'PAT-0001')),
    (SELECT id FROM vitals WHERE patient_id = (SELECT id FROM patients WHERE user_id = (SELECT id FROM users WHERE user_id = 'PAT-0001')) LIMIT 1),
    'stage1',
    NULL,
    0.35,
    'moderate',
    0.5,
    '["Monitor blood pressure closely", "Increase follow-up frequency", "Encourage physical activity"]'::JSONB,
    TRUE,
    'v1.0-mock'
),
(
    (SELECT id FROM patients WHERE user_id = (SELECT id FROM users WHERE user_id = 'PAT-0002')),
    (SELECT id FROM vitals WHERE patient_id = (SELECT id FROM patients WHERE user_id = (SELECT id FROM users WHERE user_id = 'PAT-0002')) LIMIT 1),
    'stage1',
    NULL,
    0.15,
    'low',
    0.5,
    '["Continue routine monitoring"]'::JSONB,
    TRUE,
    'v1.0-mock'
),
(
    (SELECT id FROM patients WHERE user_id = (SELECT id FROM users WHERE user_id = 'PAT-0003')),
    (SELECT id FROM vitals WHERE patient_id = (SELECT id FROM patients WHERE user_id = (SELECT id FROM users WHERE user_id = 'PAT-0003')) LIMIT 1),
    'stage1',
    NULL,
    0.72,
    'high',
    0.5,
    '["Urgent specialist consultation", "Frequent monitoring required", "Consider intervention"]'::JSONB,
    TRUE,
    'v1.0-mock'
);

-- ============================================================================
-- SAMPLE DATA - Appointments
-- ============================================================================

INSERT INTO appointments (patient_id, doctor_id, appointment_type, appointment_date, appointment_time, location, status)
VALUES 
(
    (SELECT id FROM patients WHERE user_id = (SELECT id FROM users WHERE user_id = 'PAT-0001')),
    (SELECT id FROM users WHERE user_id = 'DOC-0001'),
    'Routine Checkup',
    '2026-04-10'::DATE,
    '10:30',
    'Colombo Central Hospital - Office 204',
    'confirmed'
),
(
    (SELECT id FROM patients WHERE user_id = (SELECT id FROM users WHERE user_id = 'PAT-0002')),
    (SELECT id FROM users WHERE user_id = 'DOC-0002'),
    'Ultrasound Scan',
    '2026-04-12'::DATE,
    '14:00',
    'General Hospital - Imaging Unit',
    'pending'
),
(
    (SELECT id FROM patients WHERE user_id = (SELECT id FROM users WHERE user_id = 'PAT-0003')),
    (SELECT id FROM users WHERE user_id = 'DOC-0001'),
    'Risk Assessment',
    '2026-04-08'::DATE,
    '11:00',
    'Colombo Central Hospital - Risk Assessment Unit',
    'confirmed'
);

-- ============================================================================
-- Verify Data Insert
-- ============================================================================

SELECT 'Database setup complete!' AS status;

SELECT COUNT(*) as total_users FROM users;
SELECT COUNT(*) as total_patients FROM patients;
SELECT COUNT(*) as total_vitals FROM vitals;
SELECT COUNT(*) as total_risk_records FROM risk_records;
SELECT COUNT(*) as total_appointments FROM appointments;
