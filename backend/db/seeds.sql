-- BloomCare seed data (PostgreSQL)
-- Includes core demo accounts plus extended clinician/patient sample data.
-- Run with:
--   psql -d bloomcare_db -f backend/db/seeds.sql
-- Password for all seeded accounts: rash2003

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
SET search_path TO "BloomCare", public;

-- -----------------------------------------------------------------------------
-- 1) USERS
-- Password for all users: rash2003
-- -----------------------------------------------------------------------------
INSERT INTO users (id, email, hashed_password, full_name, role, is_active)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'hospitaladmin@bloomcare.health',      crypt('rash2003', gen_salt('bf')), 'Hospital Admin Demo',      'ADMIN',               TRUE),
    ('22222222-2222-2222-2222-222222222222', 'frontline.staff@bloomcare.health',    crypt('rash2003', gen_salt('bf')), 'Frontline Staff Demo',     'FRONTLINE_STAFF',     TRUE),
    ('33333333-3333-3333-3333-333333333333', 'obstetrician@bloomcare.health',         crypt('rash2003', gen_salt('bf')), 'Obstetrician Demo',        'CLINICAL_SPECIALIST', TRUE),
    ('55555555-5555-5555-5555-555555555555', 'obstetrician2@bloomcare.health',        crypt('rash2003', gen_salt('bf')), 'Obstetrician Demo 2',      'CLINICAL_SPECIALIST', TRUE)
ON CONFLICT (email)
DO UPDATE SET
    hashed_password = EXCLUDED.hashed_password,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

-- Remove legacy seeded patient user (patients should only exist in patients table)
DELETE FROM users
WHERE id = '44444444-4444-4444-4444-444444444444'
    OR email = 'patient.demo@bloomcare.health'
    OR email = 'specialist.demo@bloomcare.health';

-- -----------------------------------------------------------------------------
-- 2) PATIENTS
-- -----------------------------------------------------------------------------
INSERT INTO patients (
    id, national_id, full_name, age, contact_number, emergency_contact,
    blood_group, assigned_worker_id, hashed_password, registered_at, updated_at
)
VALUES
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'NIC-900000001V',
        'Nimalka Fernando',
        28,
        '0771234501',
        '0771234502',
        'O+',
        '22222222-2222-2222-2222-222222222222',
        crypt('rash2003', gen_salt('bf')),
        NOW() - INTERVAL '20 days',
        NOW()
    ),
    
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'NIC-900000002V',
        'Sanduni Perera',
        31,
        '0771234601',
        '0771234602',
        'A+',
        '22222222-2222-2222-2222-222222222222',
        crypt('rash2003', gen_salt('bf')),
        NOW() - INTERVAL '15 days',
        NOW()
    )
ON CONFLICT (id)
DO UPDATE SET
    national_id = EXCLUDED.national_id,
    full_name = EXCLUDED.full_name,
    age = EXCLUDED.age,
    contact_number = EXCLUDED.contact_number,
    emergency_contact = EXCLUDED.emergency_contact,
    blood_group = EXCLUDED.blood_group,
    assigned_worker_id = EXCLUDED.assigned_worker_id,
    hashed_password = EXCLUDED.hashed_password,
    updated_at = EXCLUDED.updated_at;

-- -----------------------------------------------------------------------------
-- 3) STAGE 1 SCREENINGS
-- -----------------------------------------------------------------------------
INSERT INTO stage1_screenings (
    id, patient_id, worker_id, encounter_id, gestational_age_weeks,
    age, systolic, diastolic, bmi, heart_rate, temperature,
    blood_sugar, hemoglobin, pcos, previous_complications, preexisting_diabetes,
    mental_health, sleep_pattern, exercise, education,
    edge_risk_classification, edge_risk_score,
    contributing_factors, stage2_priority,
    device_id, collected_at, synced_at, updated_at
)
VALUES
    (
        'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '22222222-2222-2222-2222-222222222222',
        'web-enc-0001',
        20,
        28, 120, 80, 24.5, 78, 36.8,
        95.0, 12.0, FALSE, FALSE, FALSE,
        3, 7, 3, 4,
        'routine_care', 0.320,
        '{"triggers":["Routine follow-up"],"bp_status":"Normal","observation":"Seeded Stage 1 baseline"}'::jsonb,
        '{"recommended_primary_disease":"routine_follow_up","risk_flag":"Low"}'::jsonb,
        'web-frontline-dashboard',
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '2 days'
    ),
    (
        'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '22222222-2222-2222-2222-222222222222',
        'web-enc-0002',
        31,
        31, 142, 92, 29.1, 104, 37.4,
        126.0, 10.9, TRUE, TRUE, FALSE,
        7, 4, 1, 3,
        'escalate', 0.780,
        '{"triggers":["Urgent BP recheck","Stage 2 referral"],"bp_status":"Elevated","observation":"Seeded high-risk case"}'::jsonb,
        '{"recommended_primary_disease":"preeclampsia","risk_flag":"High"}'::jsonb,
        'web-frontline-dashboard',
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '1 day'
    )
ON CONFLICT (id)
DO UPDATE SET
    patient_id = EXCLUDED.patient_id,
    worker_id = EXCLUDED.worker_id,
    encounter_id = EXCLUDED.encounter_id,
    gestational_age_weeks = EXCLUDED.gestational_age_weeks,
    age = EXCLUDED.age,
    systolic = EXCLUDED.systolic,
    diastolic = EXCLUDED.diastolic,
    bmi = EXCLUDED.bmi,
    heart_rate = EXCLUDED.heart_rate,
    temperature = EXCLUDED.temperature,
    blood_sugar = EXCLUDED.blood_sugar,
    hemoglobin = EXCLUDED.hemoglobin,
    pcos = EXCLUDED.pcos,
    previous_complications = EXCLUDED.previous_complications,
    preexisting_diabetes = EXCLUDED.preexisting_diabetes,
    mental_health = EXCLUDED.mental_health,
    sleep_pattern = EXCLUDED.sleep_pattern,
    exercise = EXCLUDED.exercise,
    education = EXCLUDED.education,
    edge_risk_classification = EXCLUDED.edge_risk_classification,
    edge_risk_score = EXCLUDED.edge_risk_score,
    contributing_factors = EXCLUDED.contributing_factors,
    stage2_priority = EXCLUDED.stage2_priority,
    device_id = EXCLUDED.device_id,
    collected_at = EXCLUDED.collected_at,
    synced_at = EXCLUDED.synced_at,
    updated_at = EXCLUDED.updated_at;

-- -----------------------------------------------------------------------------
-- 4) SCREENING REPORTS (longitudinal)
-- -----------------------------------------------------------------------------
INSERT INTO screening_reports (
    id, patient_id, general_risk_flag, probability_score, triggers, screened_at, recorded_by
)
VALUES
    (
        'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'Low', 0.32000,
        '["Routine follow-up"]'::jsonb,
        NOW() - INTERVAL '2 days',
        '22222222-2222-2222-2222-222222222222'
    ),
    (
        'f4f4f4f4-f4f4-f4f4-f4f4-f4f4f4f4f4f4',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'High', 0.78000,
        '["Urgent BP recheck","Stage 2 referral"]'::jsonb,
        NOW() - INTERVAL '1 day',
        '22222222-2222-2222-2222-222222222222'
    )
ON CONFLICT (id)
DO UPDATE SET
    patient_id = EXCLUDED.patient_id,
    general_risk_flag = EXCLUDED.general_risk_flag,
    probability_score = EXCLUDED.probability_score,
    triggers = EXCLUDED.triggers,
    screened_at = EXCLUDED.screened_at,
    recorded_by = EXCLUDED.recorded_by;

-- -----------------------------------------------------------------------------
-- 5) STAGE 2 RECOMMENDATIONS
-- -----------------------------------------------------------------------------
INSERT INTO stage2_recommendations (
    id, patient_id, stage1_screening_id, primary_disease_to_check, model_to_use,
    clinical_notes, created_by, created_at, expires_at
)
VALUES
    (
        '12121212-1212-1212-1212-121212121212',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2',
        'preeclampsia',
        'stage2_preeclampsia_model_v1',
        'High BP + elevated risk score from Stage 1.',
        '33333333-3333-3333-3333-333333333333',
        NOW() - INTERVAL '20 hours',
        NOW() + INTERVAL '7 days'
    )
ON CONFLICT (id)
DO UPDATE SET
    patient_id = EXCLUDED.patient_id,
    stage1_screening_id = EXCLUDED.stage1_screening_id,
    primary_disease_to_check = EXCLUDED.primary_disease_to_check,
    model_to_use = EXCLUDED.model_to_use,
    clinical_notes = EXCLUDED.clinical_notes,
    created_by = EXCLUDED.created_by,
    created_at = EXCLUDED.created_at,
    expires_at = EXCLUDED.expires_at;

-- -----------------------------------------------------------------------------
-- 6) STAGE 2 DIAGNOSTICS
-- -----------------------------------------------------------------------------
INSERT INTO stage2_diagnostics (
    id, patient_id, specialist_id, stage1_screening_id, gestational_age_weeks,
    primary_disease_checked, model_used,
    sflt1_plgf_ratio, plgf_absolute, papp_a, cervical_length_mm,
    metabolomics, doppler, disease_specific_inputs,
    cluster_profile, condition_probabilities, explainability_data, input_snapshot,
    overall_severity_score, dominant_condition, evaluated_at
)
VALUES
    (
        '34343434-3434-3434-3434-343434343434',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '55555555-5555-5555-5555-555555555555',
        'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2',
        31,
        'preeclampsia',
        'stage2_preeclampsia_model_v1',
        72.40, 82.10, 1.80, 28.00,
        '{"panel":"basic","status":"completed"}'::jsonb,
        '{"umbilical_artery_pi":1.2,"uterine_notching":true}'::jsonb,
        '{"symptoms":["headache","edema"]}'::jsonb,
        '{"cluster":"A2"}'::jsonb,
        '{"preeclampsia":0.81,"gdm":0.19}'::jsonb,
        '{"feature_importance":{"sflt1_plgf_ratio":0.42,"cervical_length_mm":0.21,"papp_a":0.18},"notes":"Seeded explainability snapshot"}'::jsonb,
        '{"gestational_age_weeks":31,"primary_disease_checked":"preeclampsia","input_quality":"complete"}'::jsonb,
        0.810,
        'preeclampsia',
        NOW() - INTERVAL '18 hours'
    )
ON CONFLICT (id)
DO UPDATE SET
    patient_id = EXCLUDED.patient_id,
    specialist_id = EXCLUDED.specialist_id,
    stage1_screening_id = EXCLUDED.stage1_screening_id,
    gestational_age_weeks = EXCLUDED.gestational_age_weeks,
    primary_disease_checked = EXCLUDED.primary_disease_checked,
    model_used = EXCLUDED.model_used,
    sflt1_plgf_ratio = EXCLUDED.sflt1_plgf_ratio,
    plgf_absolute = EXCLUDED.plgf_absolute,
    papp_a = EXCLUDED.papp_a,
    cervical_length_mm = EXCLUDED.cervical_length_mm,
    metabolomics = EXCLUDED.metabolomics,
    doppler = EXCLUDED.doppler,
    disease_specific_inputs = EXCLUDED.disease_specific_inputs,
    cluster_profile = EXCLUDED.cluster_profile,
    condition_probabilities = EXCLUDED.condition_probabilities,
    explainability_data = EXCLUDED.explainability_data,
    input_snapshot = EXCLUDED.input_snapshot,
    overall_severity_score = EXCLUDED.overall_severity_score,
    dominant_condition = EXCLUDED.dominant_condition,
    evaluated_at = EXCLUDED.evaluated_at;

-- -----------------------------------------------------------------------------
-- 7) PATIENT REPORTS
-- -----------------------------------------------------------------------------
INSERT INTO patient_reports (
    id, patient_id, stage1_screening_id, stage2_diagnostic_id,
    report_type, report_title, content_type, report_content,
    file_path, file_size, generated_by, generated_at, expires_at
)
VALUES
    (
        '56565656-5656-5656-5656-565656565656',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1',
        NULL,
        'stage1',
        'Stage 1 Screening Report - Baseline',
        'json',
        '{"risk":"Low","source":"seed"}'::jsonb,
        NULL,
        NULL,
        '22222222-2222-2222-2222-222222222222',
        NOW() - INTERVAL '2 days',
        NULL
    ),
    (
        '78787878-7878-7878-7878-787878787878',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2',
        '34343434-3434-3434-3434-343434343434',
        'combined',
        'Combined Stage 1 + Stage 2 Report',
        'json',
        '{"risk":"High","dominant_condition":"preeclampsia","source":"seed"}'::jsonb,
        NULL,
        NULL,
        '33333333-3333-3333-3333-333333333333',
        NOW() - INTERVAL '16 hours',
        NULL
    )
ON CONFLICT (id)
DO UPDATE SET
    patient_id = EXCLUDED.patient_id,
    stage1_screening_id = EXCLUDED.stage1_screening_id,
    stage2_diagnostic_id = EXCLUDED.stage2_diagnostic_id,
    report_type = EXCLUDED.report_type,
    report_title = EXCLUDED.report_title,
    content_type = EXCLUDED.content_type,
    report_content = EXCLUDED.report_content,
    file_path = EXCLUDED.file_path,
    file_size = EXCLUDED.file_size,
    generated_by = EXCLUDED.generated_by,
    generated_at = EXCLUDED.generated_at,
    expires_at = EXCLUDED.expires_at;

-- -----------------------------------------------------------------------------
-- 8) APPOINTMENTS
-- -----------------------------------------------------------------------------
INSERT INTO appointments (
    id, patient_id, specialist_id, created_by_id, created_by_role, appointment_type,
    appointment_date, duration_minutes, queue_number, status, notes, created_at
)
VALUES
    (
        '90909090-9090-9090-9090-909090909090',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '33333333-3333-3333-3333-333333333333',
        '33333333-3333-3333-3333-333333333333',
        'CLINICAL_SPECIALIST',
        'HIGH_RISK_FOLLOW_UP',
        NOW() + INTERVAL '1 day',
        30,
        1,
        'SCHEDULED',
        'Seeded follow-up appointment for elevated risk case.',
        NOW()
    )
ON CONFLICT (id)
DO UPDATE SET
    patient_id = EXCLUDED.patient_id,
    specialist_id = EXCLUDED.specialist_id,
    created_by_id = EXCLUDED.created_by_id,
    created_by_role = EXCLUDED.created_by_role,
    appointment_type = EXCLUDED.appointment_type,
    appointment_date = EXCLUDED.appointment_date,
    duration_minutes = EXCLUDED.duration_minutes,
    queue_number = EXCLUDED.queue_number,
    status = EXCLUDED.status,
    notes = EXCLUDED.notes,
    created_at = EXCLUDED.created_at;

-- -----------------------------------------------------------------------------
-- 9) NOTIFICATIONS
-- -----------------------------------------------------------------------------
INSERT INTO notifications (
    id, recipient_id, appointment_id, notification_type, title, message,
    is_read, read_at, related_data, created_at
)
VALUES
    (
        '91919191-9191-9191-9191-919191919191',
        '33333333-3333-3333-3333-333333333333',
        '90909090-9090-9090-9090-909090909090',
        'APPOINTMENT_SCHEDULED',
        'High-risk follow-up scheduled',
        'A high-risk follow-up appointment has been scheduled for review.',
        FALSE,
        NULL,
        '{"source":"seed","priority":"high"}'::jsonb,
        NOW() - INTERVAL '12 hours'
    )
ON CONFLICT (id)
DO UPDATE SET
    recipient_id = EXCLUDED.recipient_id,
    appointment_id = EXCLUDED.appointment_id,
    notification_type = EXCLUDED.notification_type,
    title = EXCLUDED.title,
    message = EXCLUDED.message,
    is_read = EXCLUDED.is_read,
    read_at = EXCLUDED.read_at,
    related_data = EXCLUDED.related_data,
    created_at = EXCLUDED.created_at;

-- -----------------------------------------------------------------------------
-- 10) PRESCRIPTIONS
-- -----------------------------------------------------------------------------
INSERT INTO prescriptions (
    id, patient_id, specialist_id, stage2_diagnostic_id,
    medication_name, dosage, frequency, route, instructions,
    start_date, end_date, is_active, created_at
)
VALUES
    (
        'c9c9c9c9-c9c9-c9c9-c9c9-c9c9c9c9c9c9',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '33333333-3333-3333-3333-333333333333',
        NULL,
        'Aspirin',
        '75mg',
        'Once daily',
        'Oral',
        'Take after meals in the morning',
        CURRENT_DATE - INTERVAL '3 days',
        CURRENT_DATE + INTERVAL '27 days',
        TRUE,
        NOW() - INTERVAL '3 days'
    ),
    (
        'd9d9d9d9-d9d9-d9d9-d9d9-d9d9d9d9d9d9',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '33333333-3333-3333-3333-333333333333',
        '34343434-3434-3434-3434-343434343434',
        'Insulin',
        '10 units',
        'Twice daily',
        'Injection',
        'Use as prescribed before meals',
        CURRENT_DATE - INTERVAL '1 day',
        CURRENT_DATE + INTERVAL '29 days',
        TRUE,
        NOW() - INTERVAL '1 day'
    )
ON CONFLICT (id)
DO UPDATE SET
    patient_id = EXCLUDED.patient_id,
    specialist_id = EXCLUDED.specialist_id,
    stage2_diagnostic_id = EXCLUDED.stage2_diagnostic_id,
    medication_name = EXCLUDED.medication_name,
    dosage = EXCLUDED.dosage,
    frequency = EXCLUDED.frequency,
    route = EXCLUDED.route,
    instructions = EXCLUDED.instructions,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    is_active = EXCLUDED.is_active,
    created_at = EXCLUDED.created_at;

-- -----------------------------------------------------------------------------
-- 11) OTP RECORDS
-- -----------------------------------------------------------------------------
INSERT INTO otp_records (
    id, patient_id, staff_id, otp_code, otp_hash, otp_type, destination,
    is_verified, attempts, max_attempts, created_at, expires_at, verified_at,
    ip_address, user_agent
)
VALUES
    (
        'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        NULL,
        '123456',
        crypt('123456', gen_salt('bf')),
        'PASSWORD_RESET',
        '0771234501',
        FALSE,
        0,
        5,
        NOW() - INTERVAL '10 minutes',
        NOW() + INTERVAL '20 minutes',
        NULL,
        '127.0.0.1',
        'seed-script'
    ),
    (
        'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1',
        NULL,
        '22222222-2222-2222-2222-222222222222',
        '654321',
        crypt('654321', gen_salt('bf')),
        'LOGIN_VERIFICATION',
        'frontline.staff@bloomcare.health',
        TRUE,
        1,
        5,
        NOW() - INTERVAL '30 minutes',
        NOW() + INTERVAL '30 minutes',
        NOW() - INTERVAL '25 minutes',
        '127.0.0.1',
        'seed-script'
    )
ON CONFLICT (id)
DO UPDATE SET
    patient_id = EXCLUDED.patient_id,
    staff_id = EXCLUDED.staff_id,
    otp_code = EXCLUDED.otp_code,
    otp_hash = EXCLUDED.otp_hash,
    otp_type = EXCLUDED.otp_type,
    destination = EXCLUDED.destination,
    is_verified = EXCLUDED.is_verified,
    attempts = EXCLUDED.attempts,
    max_attempts = EXCLUDED.max_attempts,
    created_at = EXCLUDED.created_at,
    expires_at = EXCLUDED.expires_at,
    verified_at = EXCLUDED.verified_at,
    ip_address = EXCLUDED.ip_address,
    user_agent = EXCLUDED.user_agent;

-- -----------------------------------------------------------------------------
-- 12) SYNC QUEUE LOGS
-- -----------------------------------------------------------------------------
INSERT INTO sync_queue_logs (
    id, device_id, payload_hash, sync_status, error_message, received_at
)
VALUES
    (
        'abababab-abab-abab-abab-abababababab',
        'web-frontline-dashboard',
        'seed-payload-hash-0001',
        'SUCCESS',
        NULL,
        NOW() - INTERVAL '1 day'
    )
ON CONFLICT (payload_hash)
DO UPDATE SET
    sync_status = EXCLUDED.sync_status,
    error_message = EXCLUDED.error_message,
    received_at = EXCLUDED.received_at;

-- =============================================================================
-- EXTENDED SAMPLE DATA
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) USERS (10 clinician accounts + admin/frontline support)
-- Password for all users: rash2003
-- -----------------------------------------------------------------------------
INSERT INTO users (
    id, email, hashed_password, full_name, role, is_active,
    first_time_login, specialization, phone_number
)
VALUES
    -- Support roles
    ('90000000-0000-0000-0000-000000000001', 'admin.extended@bloomcare.health',           crypt('rash2003', gen_salt('bf')), 'Admin Extended',            'ADMIN',               TRUE, FALSE, 'Hospital Operations', '0779000001'),
    ('90000000-0000-0000-0000-000000000002', 'frontline.extended@bloomcare.health',       crypt('rash2003', gen_salt('bf')), 'Frontline Extended',        'FRONTLINE_STAFF',     TRUE, FALSE, 'Community Maternal Care', '0779000002'),

    -- 10 obstetricians
    ('90000000-0000-0000-0000-000000000101', 'obstetrician01@bloomcare.health',             crypt('rash2003', gen_salt('bf')), 'Dr. Ayesha Perera',         'CLINICAL_SPECIALIST',         TRUE, FALSE, 'Obstetrics', '0779100101'),
    ('90000000-0000-0000-0000-000000000102', 'obstetrician02@bloomcare.health',             crypt('rash2003', gen_salt('bf')), 'Dr. Malith Fernando',       'CLINICAL_SPECIALIST',         TRUE, FALSE, 'Maternal-Fetal Medicine', '0779100102'),
    ('90000000-0000-0000-0000-000000000103', 'obstetrician03@bloomcare.health',             crypt('rash2003', gen_salt('bf')), 'Dr. Senuri Jayasinghe',     'CLINICAL_SPECIALIST',         TRUE, FALSE, 'Obstetrics', '0779100103'),
    ('90000000-0000-0000-0000-000000000104', 'obstetrician04@bloomcare.health',             crypt('rash2003', gen_salt('bf')), 'Dr. Kavidu Silva',          'CLINICAL_SPECIALIST',         TRUE, FALSE, 'Endocrinology', '0779100104'),
    ('90000000-0000-0000-0000-000000000105', 'obstetrician05@bloomcare.health',             crypt('rash2003', gen_salt('bf')), 'Dr. Rashmi Wijesuriya',     'CLINICAL_SPECIALIST',         TRUE, FALSE, 'Internal Medicine', '0779100105'),
    ('90000000-0000-0000-0000-000000000106', 'obstetrician06@bloomcare.health',             crypt('rash2003', gen_salt('bf')), 'Dr. Tharindu Ekanayake',    'CLINICAL_SPECIALIST',         TRUE, FALSE, 'Obstetrics', '0779100106'),
    ('90000000-0000-0000-0000-000000000107', 'obstetrician07@bloomcare.health',             crypt('rash2003', gen_salt('bf')), 'Dr. Nethmi Abeykoon',       'CLINICAL_SPECIALIST',         TRUE, FALSE, 'Cardiology', '0779100107'),
    ('90000000-0000-0000-0000-000000000108', 'obstetrician08@bloomcare.health',             crypt('rash2003', gen_salt('bf')), 'Dr. Lakshan Herath',        'CLINICAL_SPECIALIST',         TRUE, FALSE, 'Nephrology', '0779100108'),
    ('90000000-0000-0000-0000-000000000109', 'obstetrician09@bloomcare.health',             crypt('rash2003', gen_salt('bf')), 'Dr. Imesha Ranasinghe',     'CLINICAL_SPECIALIST',         TRUE, FALSE, 'Critical Care', '0779100109'),
    ('90000000-0000-0000-0000-000000000110', 'obstetrician10@bloomcare.health',             crypt('rash2003', gen_salt('bf')), 'Dr. Pahan de Mel',          'CLINICAL_SPECIALIST',         TRUE, FALSE, 'Maternal-Fetal Medicine', '0779100110')
ON CONFLICT (email)
DO UPDATE SET
    hashed_password = EXCLUDED.hashed_password,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    first_time_login = EXCLUDED.first_time_login,
    specialization = EXCLUDED.specialization,
    phone_number = EXCLUDED.phone_number;

-- -----------------------------------------------------------------------------
-- 2) PATIENT (single patient at >=20 weeks)
-- Password: rash2003
-- -----------------------------------------------------------------------------
INSERT INTO patients (
    id, national_id, full_name, age, due_date, contact_number, is_active,
    hashed_password, emergency_contact, blood_group, first_time_login,
    registered_at, updated_at, assigned_worker_id
)
VALUES
    (
        '91000000-0000-0000-0000-000000000001',
        'NIC-910000001V',
        'Dinethra Kumari',
        29,
        CURRENT_DATE + INTERVAL '16 weeks',
        '0779200001',
        TRUE,
        crypt('rash2003', gen_salt('bf')),
        '0779200002',
        'B+',
        FALSE,
        NOW() - INTERVAL '30 days',
        NOW(),
        '90000000-0000-0000-0000-000000000002'
    )
ON CONFLICT (id)
DO UPDATE SET
    national_id = EXCLUDED.national_id,
    full_name = EXCLUDED.full_name,
    age = EXCLUDED.age,
    due_date = EXCLUDED.due_date,
    contact_number = EXCLUDED.contact_number,
    is_active = EXCLUDED.is_active,
    hashed_password = EXCLUDED.hashed_password,
    emergency_contact = EXCLUDED.emergency_contact,
    blood_group = EXCLUDED.blood_group,
    first_time_login = EXCLUDED.first_time_login,
    updated_at = EXCLUDED.updated_at,
    assigned_worker_id = EXCLUDED.assigned_worker_id;

-- -----------------------------------------------------------------------------
-- 3) STAGE 1 SCREENINGS
-- -----------------------------------------------------------------------------
INSERT INTO stage1_screenings (
    id, patient_id, worker_id, encounter_id, gestational_age_weeks,
    age, systolic, diastolic, bmi, heart_rate, temperature,
    blood_sugar, hemoglobin, pcos, previous_complications, preexisting_diabetes,
    mental_health, sleep_pattern, exercise, education,
    edge_risk_classification, edge_risk_score,
    contributing_factors, stage2_priority,
    device_id, collected_at, synced_at, updated_at
)
VALUES
    (
        '92000000-0000-0000-0000-000000000001',
        '91000000-0000-0000-0000-000000000001',
        '90000000-0000-0000-0000-000000000002',
        'extended-enc-0001',
        24,
        29, 138, 90, 27.4, 96, 37.2,
        122.4, 10.8, TRUE, TRUE, FALSE,
        6, 4, 2, 4,
        'escalate', 0.742,
        '{"triggers":["Elevated blood pressure","History of complications"],"bp_status":"Elevated","notes":"Extended seed high-risk case"}'::jsonb,
        '{"recommended_primary_disease":"preeclampsia","scores":{"preeclampsia":0.74,"gdm":0.46,"preterm":0.39}}'::jsonb,
        'mobile-midwife-device-01',
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '2 days'
    )
ON CONFLICT (id)
DO UPDATE SET
    patient_id = EXCLUDED.patient_id,
    worker_id = EXCLUDED.worker_id,
    encounter_id = EXCLUDED.encounter_id,
    gestational_age_weeks = EXCLUDED.gestational_age_weeks,
    age = EXCLUDED.age,
    systolic = EXCLUDED.systolic,
    diastolic = EXCLUDED.diastolic,
    bmi = EXCLUDED.bmi,
    heart_rate = EXCLUDED.heart_rate,
    temperature = EXCLUDED.temperature,
    blood_sugar = EXCLUDED.blood_sugar,
    hemoglobin = EXCLUDED.hemoglobin,
    pcos = EXCLUDED.pcos,
    previous_complications = EXCLUDED.previous_complications,
    preexisting_diabetes = EXCLUDED.preexisting_diabetes,
    mental_health = EXCLUDED.mental_health,
    sleep_pattern = EXCLUDED.sleep_pattern,
    exercise = EXCLUDED.exercise,
    education = EXCLUDED.education,
    edge_risk_classification = EXCLUDED.edge_risk_classification,
    edge_risk_score = EXCLUDED.edge_risk_score,
    contributing_factors = EXCLUDED.contributing_factors,
    stage2_priority = EXCLUDED.stage2_priority,
    device_id = EXCLUDED.device_id,
    collected_at = EXCLUDED.collected_at,
    synced_at = EXCLUDED.synced_at,
    updated_at = EXCLUDED.updated_at;

-- -----------------------------------------------------------------------------
-- 4) SCREENING REPORTS
-- -----------------------------------------------------------------------------
INSERT INTO screening_reports (
    id, patient_id, general_risk_flag, probability_score, triggers, screened_at, recorded_by
)
VALUES
    (
        '93000000-0000-0000-0000-000000000001',
        '91000000-0000-0000-0000-000000000001',
        'High',
        0.74200,
        '["Elevated blood pressure","History of complications"]'::jsonb,
        NOW() - INTERVAL '2 days',
        '90000000-0000-0000-0000-000000000002'
    )
ON CONFLICT (id)
DO UPDATE SET
    patient_id = EXCLUDED.patient_id,
    general_risk_flag = EXCLUDED.general_risk_flag,
    probability_score = EXCLUDED.probability_score,
    triggers = EXCLUDED.triggers,
    screened_at = EXCLUDED.screened_at,
    recorded_by = EXCLUDED.recorded_by;

-- -----------------------------------------------------------------------------
-- 5) STAGE 2 RECOMMENDATIONS
-- -----------------------------------------------------------------------------
INSERT INTO stage2_recommendations (
    id, patient_id, stage1_screening_id, primary_disease_to_check, model_to_use,
    clinical_notes, created_by, created_at, expires_at
)
VALUES
    (
        '94000000-0000-0000-0000-000000000001',
        '91000000-0000-0000-0000-000000000001',
        '92000000-0000-0000-0000-000000000001',
        'preeclampsia',
        'stage2_preeclampsia_model_v1',
        'Escalated from Stage 1 due to high BP profile and prior complications.',
        '90000000-0000-0000-0000-000000000101',
        NOW() - INTERVAL '36 hours',
        NOW() + INTERVAL '6 days'
    )
ON CONFLICT (id)
DO UPDATE SET
    patient_id = EXCLUDED.patient_id,
    stage1_screening_id = EXCLUDED.stage1_screening_id,
    primary_disease_to_check = EXCLUDED.primary_disease_to_check,
    model_to_use = EXCLUDED.model_to_use,
    clinical_notes = EXCLUDED.clinical_notes,
    created_by = EXCLUDED.created_by,
    created_at = EXCLUDED.created_at,
    expires_at = EXCLUDED.expires_at;

-- -----------------------------------------------------------------------------
-- 6) STAGE 2 DIAGNOSTICS
-- -----------------------------------------------------------------------------
INSERT INTO stage2_diagnostics (
    id, patient_id, specialist_id, stage1_screening_id, gestational_age_weeks,
    primary_disease_checked, model_used,
    sflt1_plgf_ratio, plgf_absolute, papp_a, cervical_length_mm,
    metabolomics, doppler, disease_specific_inputs,
    cluster_profile, condition_probabilities, explainability_data, input_snapshot,
    overall_severity_score, dominant_condition, evaluated_at
)
VALUES
    (
        '95000000-0000-0000-0000-000000000001',
        '91000000-0000-0000-0000-000000000001',
        '90000000-0000-0000-0000-000000000107',
        '92000000-0000-0000-0000-000000000001',
        24,
        'preeclampsia',
        'stage2_preeclampsia_model_v1',
        66.80, 84.00, 1.70, 30.00,
        '{"panel":"extended","status":"completed"}'::jsonb,
        '{"umbilical_artery_pi":1.3,"uterine_notching":true}'::jsonb,
        '{"symptoms":["headache","mild edema"],"bp_trend":"upward"}'::jsonb,
        '{"cluster":"A3"}'::jsonb,
        '{"preeclampsia":0.79,"gdm":0.28,"preterm":0.25}'::jsonb,
        '{"feature_importance":{"sflt1_plgf_ratio":0.44,"blood_pressure":0.26,"papp_a":0.17}}'::jsonb,
        '{"gestational_age_weeks":24,"primary_disease_checked":"preeclampsia","input_quality":"complete"}'::jsonb,
        0.790,
        'preeclampsia',
        NOW() - INTERVAL '24 hours'
    )
ON CONFLICT (id)
DO UPDATE SET
    patient_id = EXCLUDED.patient_id,
    specialist_id = EXCLUDED.specialist_id,
    stage1_screening_id = EXCLUDED.stage1_screening_id,
    gestational_age_weeks = EXCLUDED.gestational_age_weeks,
    primary_disease_checked = EXCLUDED.primary_disease_checked,
    model_used = EXCLUDED.model_used,
    sflt1_plgf_ratio = EXCLUDED.sflt1_plgf_ratio,
    plgf_absolute = EXCLUDED.plgf_absolute,
    papp_a = EXCLUDED.papp_a,
    cervical_length_mm = EXCLUDED.cervical_length_mm,
    metabolomics = EXCLUDED.metabolomics,
    doppler = EXCLUDED.doppler,
    disease_specific_inputs = EXCLUDED.disease_specific_inputs,
    cluster_profile = EXCLUDED.cluster_profile,
    condition_probabilities = EXCLUDED.condition_probabilities,
    explainability_data = EXCLUDED.explainability_data,
    input_snapshot = EXCLUDED.input_snapshot,
    overall_severity_score = EXCLUDED.overall_severity_score,
    dominant_condition = EXCLUDED.dominant_condition,
    evaluated_at = EXCLUDED.evaluated_at;

-- -----------------------------------------------------------------------------
-- 7) PATIENT REPORTS
-- -----------------------------------------------------------------------------
INSERT INTO patient_reports (
    id, patient_id, stage1_screening_id, stage2_diagnostic_id,
    report_type, report_title, content_type, report_content,
    file_path, file_size, generated_by, generated_at, expires_at
)
VALUES
    (
        '96000000-0000-0000-0000-000000000001',
        '91000000-0000-0000-0000-000000000001',
        '92000000-0000-0000-0000-000000000001',
        '95000000-0000-0000-0000-000000000001',
        'combined',
        'Extended Combined Maternal Risk Report',
        'json',
        '{"risk":"High","dominant_condition":"preeclampsia","source":"extended-seed"}'::jsonb,
        NULL,
        NULL,
        '90000000-0000-0000-0000-000000000101',
        NOW() - INTERVAL '20 hours',
        NULL
    )
ON CONFLICT (id)
DO UPDATE SET
    patient_id = EXCLUDED.patient_id,
    stage1_screening_id = EXCLUDED.stage1_screening_id,
    stage2_diagnostic_id = EXCLUDED.stage2_diagnostic_id,
    report_type = EXCLUDED.report_type,
    report_title = EXCLUDED.report_title,
    content_type = EXCLUDED.content_type,
    report_content = EXCLUDED.report_content,
    file_path = EXCLUDED.file_path,
    file_size = EXCLUDED.file_size,
    generated_by = EXCLUDED.generated_by,
    generated_at = EXCLUDED.generated_at,
    expires_at = EXCLUDED.expires_at;

-- -----------------------------------------------------------------------------
-- 8) APPOINTMENTS
-- -----------------------------------------------------------------------------
INSERT INTO appointments (
    id, patient_id, specialist_id, created_by_id, created_by_role, appointment_type,
    appointment_date, duration_minutes, queue_number, status, notes,
    completed_by_id, completed_at, cancelled_by_id, cancelled_at,
    reason_for_cancellation, created_at, updated_at
)
VALUES
    (
        '97000000-0000-0000-0000-000000000001',
        '91000000-0000-0000-0000-000000000001',
        '90000000-0000-0000-0000-000000000102',
        '90000000-0000-0000-0000-000000000002',
        'FRONTLINE_STAFF',
        'HIGH_RISK_FOLLOW_UP',
        NOW() + INTERVAL '1 day',
        30,
        1,
        'SCHEDULED',
        'Auto-seeded high-risk follow-up appointment.',
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NOW() - INTERVAL '6 hours',
        NOW() - INTERVAL '6 hours'
    )
ON CONFLICT (id)
DO UPDATE SET
    patient_id = EXCLUDED.patient_id,
    specialist_id = EXCLUDED.specialist_id,
    created_by_id = EXCLUDED.created_by_id,
    created_by_role = EXCLUDED.created_by_role,
    appointment_type = EXCLUDED.appointment_type,
    appointment_date = EXCLUDED.appointment_date,
    duration_minutes = EXCLUDED.duration_minutes,
    queue_number = EXCLUDED.queue_number,
    status = EXCLUDED.status,
    notes = EXCLUDED.notes,
    completed_by_id = EXCLUDED.completed_by_id,
    completed_at = EXCLUDED.completed_at,
    cancelled_by_id = EXCLUDED.cancelled_by_id,
    cancelled_at = EXCLUDED.cancelled_at,
    reason_for_cancellation = EXCLUDED.reason_for_cancellation,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at;

-- -----------------------------------------------------------------------------
-- 9) PRESCRIPTIONS
-- -----------------------------------------------------------------------------
INSERT INTO prescriptions (
    id, patient_id, specialist_id, stage2_diagnostic_id,
    medication_name, dosage, frequency, route, instructions,
    start_date, end_date, is_active, created_at
)
VALUES
    (
        '98000000-0000-0000-0000-000000000001',
        '91000000-0000-0000-0000-000000000001',
        '90000000-0000-0000-0000-000000000101',
        '95000000-0000-0000-0000-000000000001',
        'Aspirin',
        '75mg',
        'Once daily',
        'Oral',
        'Take after dinner and monitor blood pressure daily.',
        CURRENT_DATE - INTERVAL '2 days',
        CURRENT_DATE + INTERVAL '28 days',
        TRUE,
        NOW() - INTERVAL '1 day'
    )
ON CONFLICT (id)
DO UPDATE SET
    patient_id = EXCLUDED.patient_id,
    specialist_id = EXCLUDED.specialist_id,
    stage2_diagnostic_id = EXCLUDED.stage2_diagnostic_id,
    medication_name = EXCLUDED.medication_name,
    dosage = EXCLUDED.dosage,
    frequency = EXCLUDED.frequency,
    route = EXCLUDED.route,
    instructions = EXCLUDED.instructions,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    is_active = EXCLUDED.is_active,
    created_at = EXCLUDED.created_at;

-- -----------------------------------------------------------------------------
-- 10) NOTIFICATIONS
-- -----------------------------------------------------------------------------
INSERT INTO notifications (
    id, recipient_id, appointment_id, notification_type, title, message,
    is_read, read_at, related_data, created_at
)
VALUES
    (
        '99000000-0000-0000-0000-000000000001',
        '90000000-0000-0000-0000-000000000102',
        '97000000-0000-0000-0000-000000000001',
        'APPOINTMENT_SCHEDULED',
        'High-risk follow-up assigned',
        'A scheduled high-risk appointment has been assigned to you.',
        FALSE,
        NULL,
        '{"source":"extended-seed","priority":"high"}'::jsonb,
        NOW() - INTERVAL '5 hours'
    )
ON CONFLICT (id)
DO UPDATE SET
    recipient_id = EXCLUDED.recipient_id,
    appointment_id = EXCLUDED.appointment_id,
    notification_type = EXCLUDED.notification_type,
    title = EXCLUDED.title,
    message = EXCLUDED.message,
    is_read = EXCLUDED.is_read,
    read_at = EXCLUDED.read_at,
    related_data = EXCLUDED.related_data,
    created_at = EXCLUDED.created_at;

-- -----------------------------------------------------------------------------
-- 11) OTP RECORDS
-- -----------------------------------------------------------------------------
INSERT INTO otp_records (
    id, patient_id, staff_id, otp_code, otp_hash, otp_type, destination,
    is_verified, attempts, max_attempts, created_at, expires_at, verified_at,
    ip_address, user_agent
)
VALUES
    (
        '9a000000-0000-0000-0000-000000000001',
        '91000000-0000-0000-0000-000000000001',
        NULL,
        '112233',
        crypt('112233', gen_salt('bf')),
        'LOGIN_VERIFICATION',
        '0779200001',
        FALSE,
        0,
        5,
        NOW() - INTERVAL '5 minutes',
        NOW() + INTERVAL '25 minutes',
        NULL,
        '127.0.0.1',
        'extended-seed-script'
    ),
    (
        '9a000000-0000-0000-0000-000000000002',
        NULL,
        '90000000-0000-0000-0000-000000000101',
        '445566',
        crypt('445566', gen_salt('bf')),
        'FIRST_LOGIN',
        'obstetrician01@bloomcare.health',
        TRUE,
        1,
        5,
        NOW() - INTERVAL '40 minutes',
        NOW() + INTERVAL '20 minutes',
        NOW() - INTERVAL '35 minutes',
        '127.0.0.1',
        'extended-seed-script'
    )
ON CONFLICT (id)
DO UPDATE SET
    patient_id = EXCLUDED.patient_id,
    staff_id = EXCLUDED.staff_id,
    otp_code = EXCLUDED.otp_code,
    otp_hash = EXCLUDED.otp_hash,
    otp_type = EXCLUDED.otp_type,
    destination = EXCLUDED.destination,
    is_verified = EXCLUDED.is_verified,
    attempts = EXCLUDED.attempts,
    max_attempts = EXCLUDED.max_attempts,
    created_at = EXCLUDED.created_at,
    expires_at = EXCLUDED.expires_at,
    verified_at = EXCLUDED.verified_at,
    ip_address = EXCLUDED.ip_address,
    user_agent = EXCLUDED.user_agent;

-- -----------------------------------------------------------------------------
-- 12) SYNC QUEUE LOGS
-- -----------------------------------------------------------------------------
INSERT INTO sync_queue_logs (
    id, device_id, payload_hash, sync_status, error_message, received_at
)
VALUES
    (
        '9b000000-0000-0000-0000-000000000001',
        'mobile-midwife-device-01',
        'extended-seed-payload-0001',
        'SUCCESS',
        NULL,
        NOW() - INTERVAL '3 hours'
    )
ON CONFLICT (payload_hash)
DO UPDATE SET
    sync_status = EXCLUDED.sync_status,
    error_message = EXCLUDED.error_message,
    received_at = EXCLUDED.received_at;

-- =============================================================================
-- WALKTHROUGH ADDITIONS (new rows only — does not replace existing seeds)
-- Password: rash2003
--   Ishara Madushani     900000003V   high GDM, Stage 1 only (enter labs)
--   Kavindi Jayawardena  900000004V   preterm, COMPLETED appointment
--   Tharushi Silva       900000005V   registered, never screened
--   Menaka Bandara       900000006V   low→high trend, cancelled + new slot
-- =============================================================================

ALTER TABLE stage1_screenings ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

DO $$
BEGIN
    ALTER TABLE stage1_screenings DISABLE TRIGGER trg_stage1_escalation;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

INSERT INTO patients (
    id, national_id, full_name, age, due_date, contact_number, emergency_contact,
    blood_group, assigned_worker_id, hashed_password, is_active, first_time_login,
    registered_at, updated_at
)
VALUES
    (
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '900000003V',
        'Ishara Madushani',
        34,
        CURRENT_DATE + INTERVAL '12 weeks',
        '0771234701', '0771234702', 'B+',
        '22222222-2222-2222-2222-222222222222',
        crypt('rash2003', gen_salt('bf')),
        TRUE, FALSE,
        NOW() - INTERVAL '40 days', NOW()
    ),
    (
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        '900000004V',
        'Kavindi Jayawardena',
        26,
        CURRENT_DATE + INTERVAL '14 weeks',
        '0771234801', '0771234802', 'AB+',
        '22222222-2222-2222-2222-222222222222',
        crypt('rash2003', gen_salt('bf')),
        TRUE, FALSE,
        NOW() - INTERVAL '50 days', NOW()
    ),
    (
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        '900000005V',
        'Tharushi Silva',
        24,
        CURRENT_DATE + INTERVAL '24 weeks',
        '0771234901', '0771234902', 'O-',
        '22222222-2222-2222-2222-222222222222',
        crypt('rash2003', gen_salt('bf')),
        TRUE, FALSE,
        NOW() - INTERVAL '5 days', NOW()
    ),
    (
        'aaaabbbb-cccc-dddd-eeee-ffff00000002',
        '900000006V',
        'Menaka Bandara',
        37,
        CURRENT_DATE + INTERVAL '12 weeks',
        '0771234101', '0771234102', 'B-',
        '22222222-2222-2222-2222-222222222222',
        crypt('rash2003', gen_salt('bf')),
        TRUE, FALSE,
        NOW() - INTERVAL '80 days', NOW()
    )
ON CONFLICT DO NOTHING;

INSERT INTO stage1_screenings (
    id, patient_id, worker_id, encounter_id, gestational_age_weeks,
    age, systolic, diastolic, bmi, heart_rate, temperature,
    blood_sugar, hemoglobin, pcos, previous_complications, preexisting_diabetes,
    mental_health, sleep_pattern, exercise, education,
    edge_risk_classification, edge_risk_score,
    contributing_factors, stage2_priority,
    device_id, collected_at, synced_at, updated_at, reviewed_at
)
VALUES
    (
        'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '22222222-2222-2222-2222-222222222222',
        'web-enc-ishara-w28',
        28, 34, 128, 84, 32.4, 88, 36.9,
        168.0, 11.1, TRUE, FALSE, TRUE,
        5, 5, 1, 4,
        'escalate', 0.790,
        '{"triggers":["Marked hyperglycemia","BMI 32","Pre-existing diabetes"],"bp_status":"Watch","observation":"GDM pathway"}'::jsonb,
        '{"recommended_primary_disease":"gdm","risk_flag":"High"}'::jsonb,
        'web-frontline-dashboard',
        NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours',
        NULL
    ),
    (
        'd4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4',
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        '22222222-2222-2222-2222-222222222222',
        'web-enc-kavindi-w26',
        26, 26, 122, 78, 22.1, 92, 36.7,
        98.0, 11.8, FALSE, TRUE, FALSE,
        4, 6, 2, 5,
        'escalate', 0.770,
        '{"triggers":["Prior preterm birth","Cramping"],"bp_status":"Normal","observation":"Preterm surveillance"}'::jsonb,
        '{"recommended_primary_disease":"preterm","risk_flag":"High"}'::jsonb,
        'web-frontline-dashboard',
        NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days',
        NOW() - INTERVAL '1 day'
    ),
    (
        'a6a6a6a6-a6a6-a6a6-a6a6-a6a6a6a6a6a6',
        'aaaabbbb-cccc-dddd-eeee-ffff00000002',
        '22222222-2222-2222-2222-222222222222',
        'web-enc-menaka-w20',
        20, 37, 124, 80, 26.2, 80, 36.7,
        102.0, 11.6, FALSE, FALSE, FALSE,
        3, 6, 2, 5,
        'routine_care', 0.360,
        '{"triggers":["Advanced maternal age"],"bp_status":"Normal","observation":"AMA baseline"}'::jsonb,
        '{"recommended_primary_disease":"routine_follow_up","risk_flag":"Low"}'::jsonb,
        'web-frontline-dashboard',
        NOW() - INTERVAL '56 days', NOW() - INTERVAL '56 days', NOW() - INTERVAL '56 days',
        NULL
    ),
    (
        'b7b7b7b7-b7b7-b7b7-b7b7-b7b7b7b7b7b7',
        'aaaabbbb-cccc-dddd-eeee-ffff00000002',
        '22222222-2222-2222-2222-222222222222',
        'web-enc-menaka-w28',
        28, 37, 146, 94, 27.8, 98, 37.1,
        118.0, 10.7, FALSE, TRUE, FALSE,
        6, 4, 1, 5,
        'escalate', 0.810,
        '{"triggers":["New hypertension","AMA","Rising BMI"],"bp_status":"Elevated","observation":"Converted to high risk"}'::jsonb,
        '{"recommended_primary_disease":"preeclampsia","risk_flag":"High"}'::jsonb,
        'web-frontline-dashboard',
        NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days',
        NULL
    )
ON CONFLICT DO NOTHING;

INSERT INTO screening_reports (
    id, patient_id, general_risk_flag, probability_score, triggers, screened_at, recorded_by
)
VALUES
    ('aa000003-0000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'High', 0.79000, '["Marked hyperglycemia","BMI 32"]'::jsonb, NOW() - INTERVAL '6 hours', '22222222-2222-2222-2222-222222222222'),
    ('aa000004-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'High', 0.77000, '["Prior preterm birth","Cramping"]'::jsonb, NOW() - INTERVAL '4 days', '22222222-2222-2222-2222-222222222222'),
    ('aa000006-0000-0000-0000-000000000001', 'aaaabbbb-cccc-dddd-eeee-ffff00000002', 'Low',  0.36000, '["Advanced maternal age"]'::jsonb, NOW() - INTERVAL '56 days', '22222222-2222-2222-2222-222222222222'),
    ('aa000006-0000-0000-0000-000000000002', 'aaaabbbb-cccc-dddd-eeee-ffff00000002', 'High', 0.81000, '["New hypertension","AMA"]'::jsonb, NOW() - INTERVAL '3 days', '22222222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;

INSERT INTO stage2_recommendations (
    id, patient_id, stage1_screening_id, primary_disease_to_check, model_to_use,
    clinical_notes, created_by, created_at, expires_at
)
VALUES
    (
        'bb000003-0000-0000-0000-000000000001',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3',
        'gdm', 'Differential PE/GDM/PTB',
        'Enter HbA1c/OGTT on Differential and run evaluation.',
        '33333333-3333-3333-3333-333333333333',
        NOW() - INTERVAL '5 hours', NOW() + INTERVAL '7 days'
    ),
    (
        'bb000004-0000-0000-0000-000000000001',
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        'd4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4',
        'preterm', 'Differential PE/GDM/PTB',
        'Cervical length and fFN already recorded.',
        '55555555-5555-5555-5555-555555555555',
        NOW() - INTERVAL '3 days', NOW() + INTERVAL '4 days'
    )
ON CONFLICT DO NOTHING;

INSERT INTO stage2_diagnostics (
    id, patient_id, specialist_id, stage1_screening_id, gestational_age_weeks,
    primary_disease_checked, model_used,
    sflt1_plgf_ratio, plgf_absolute, papp_a, cervical_length_mm,
    metabolomics, doppler, disease_specific_inputs,
    cluster_profile, condition_probabilities, explainability_data, input_snapshot,
    overall_severity_score, dominant_condition, evaluated_at
)
VALUES
    (
        '35353535-3535-3535-3535-353535353535',
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        '55555555-5555-5555-5555-555555555555',
        'd4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4',
        26, 'preterm', 'Differential PE/GDM/PTB',
        22.00, 140.00, 2.10, 21.50,
        '{"panel":"PTB","status":"completed"}'::jsonb,
        '{"umbilical_artery_pi":0.92,"uterine_notching":false}'::jsonb,
        '{"ffn_result":true,"cervical_length_mm":21.5}'::jsonb,
        '{"cluster":"PTB-short-cervix"}'::jsonb,
        '{"preeclampsia":{"risk_level":"low","probability":0.16},"gdm":{"risk_level":"low","probability":0.11},"preterm_birth":{"risk_level":"high","probability":0.78},"primary_risk":"preterm_birth"}'::jsonb,
        '{"model":"Differential PE/GDM/PTB","features":[{"feature":"Cervical Length","importance":0.46,"contribution":0.41,"direction":"increase","value":"21.5 mm","status":"low","clinical_hint":"Length <= 25 mm raises preterm risk"}]}'::jsonb,
        '{"age":26,"bmi":22.1,"cervical_length_mm":21.5,"ffn_result":true}'::jsonb,
        0.780, 'preterm_birth', NOW() - INTERVAL '2 days'
    )
ON CONFLICT DO NOTHING;

INSERT INTO patient_reports (
    id, patient_id, stage1_screening_id, stage2_diagnostic_id,
    report_type, report_title, content_type, report_content,
    file_path, file_size, generated_by, generated_at, expires_at
)
VALUES
    (
        'cc000004-0000-0000-0000-000000000001',
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        'd4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4',
        '35353535-3535-3535-3535-353535353535',
        'combined', 'Combined Stage 1 + Stage 2 Report - Kavindi Jayawardena', 'json',
        '{"dominant_condition":"preterm_birth","source":"walkthrough-addition"}'::jsonb,
        NULL, NULL, '55555555-5555-5555-5555-555555555555', NOW() - INTERVAL '2 days', NULL
    )
ON CONFLICT DO NOTHING;

INSERT INTO appointments (
    id, patient_id, specialist_id, created_by_id, created_by_role, appointment_type,
    appointment_date, duration_minutes, queue_number, status, notes,
    completed_by_id, completed_at, cancelled_by_id, cancelled_at,
    reason_for_cancellation, created_at, updated_at
)
VALUES
    (
        'a0909090-a090-a090-a090-a09090909090',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '33333333-3333-3333-3333-333333333333',
        '22222222-2222-2222-2222-222222222222',
        'FRONTLINE_STAFF', 'GLUCOSE_SCREENING',
        date_trunc('day', NOW()) + INTERVAL '2 days' + INTERVAL '9 hours 30 minutes',
        30, 2, 'SCHEDULED',
        'Walkthrough: open Differential, type HbA1c/OGTT, run evaluation.',
        NULL, NULL, NULL, NULL, NULL,
        NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours'
    ),
    (
        'b0909090-b090-b090-b090-b09090909090',
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        '55555555-5555-5555-5555-555555555555',
        '22222222-2222-2222-2222-222222222222',
        'FRONTLINE_STAFF', 'HIGH_RISK_FOLLOW_UP',
        date_trunc('day', NOW()) - INTERVAL '1 day' + INTERVAL '11 hours',
        30, 1, 'COMPLETED',
        'Walkthrough: already reviewed. Must not appear in pending list.',
        '55555555-5555-5555-5555-555555555555', NOW() - INTERVAL '20 hours',
        NULL, NULL, NULL,
        NOW() - INTERVAL '4 days', NOW() - INTERVAL '20 hours'
    ),
    (
        'd0909090-d090-d090-d090-d09090909090',
        'aaaabbbb-cccc-dddd-eeee-ffff00000002',
        '33333333-3333-3333-3333-333333333333',
        '22222222-2222-2222-2222-222222222222',
        'FRONTLINE_STAFF', 'HIGH_RISK_FOLLOW_UP',
        date_trunc('day', NOW()) + INTERVAL '4 days' + INTERVAL '8 hours',
        30, 3, 'CANCELLED',
        'Patient requested a later slot.',
        NULL, NULL,
        '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '2 hours',
        'Rescheduled at patient request',
        NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 hours'
    ),
    (
        'e0909090-e090-e090-e090-e09090909090',
        'aaaabbbb-cccc-dddd-eeee-ffff00000002',
        '33333333-3333-3333-3333-333333333333',
        '22222222-2222-2222-2222-222222222222',
        'FRONTLINE_STAFF', 'HIGH_RISK_FOLLOW_UP',
        date_trunc('day', NOW()) + INTERVAL '5 days' + INTERVAL '14 hours',
        30, 1, 'SCHEDULED',
        'Replacement slot after cancellation. Still pending review.',
        NULL, NULL, NULL, NULL, NULL,
        NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'
    )
ON CONFLICT DO NOTHING;

INSERT INTO notifications (
    id, recipient_id, appointment_id, notification_type, title, message,
    is_read, read_at, related_data, created_at
)
VALUES
    (
        'dd000003-0000-0000-0000-000000000001',
        '33333333-3333-3333-3333-333333333333',
        'a0909090-a090-a090-a090-a09090909090',
        'APPOINTMENT_SCHEDULED',
        'GDM follow-up scheduled',
        'Ishara Madushani (900000003V) needs glucose labs on Differential.',
        FALSE, NULL,
        '{"patient":"Ishara Madushani","nic":"900000003V"}'::jsonb,
        NOW() - INTERVAL '5 hours'
    ),
    (
        'dd000004-0000-0000-0000-000000000001',
        '55555555-5555-5555-5555-555555555555',
        'b0909090-b090-b090-b090-b09090909090',
        'APPOINTMENT_COMPLETED',
        'Preterm review completed',
        'Kavindi Jayawardena appointment was marked completed.',
        TRUE, NOW() - INTERVAL '19 hours',
        '{"patient":"Kavindi Jayawardena"}'::jsonb,
        NOW() - INTERVAL '20 hours'
    ),
    (
        'dd000006-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222',
        'd0909090-d090-d090-d090-d09090909090',
        'APPOINTMENT_CANCELLED',
        'Menaka Bandara slot cancelled',
        'Cancelled at patient request. Replacement booked.',
        FALSE, NULL,
        '{"patient":"Menaka Bandara","nic":"900000006V"}'::jsonb,
        NOW() - INTERVAL '2 hours'
    )
ON CONFLICT DO NOTHING;

INSERT INTO prescriptions (
    id, patient_id, specialist_id, stage2_diagnostic_id,
    medication_name, dosage, frequency, route, instructions,
    start_date, end_date, is_active, created_at
)
VALUES
    (
        'ee000003-0000-0000-0000-000000000001',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '90000000-0000-0000-0000-000000000104',
        NULL, 'Metformin', '500mg', 'Twice daily', 'Oral',
        'Start after meals. Review with OGTT results.',
        CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
        TRUE, NOW() - INTERVAL '4 hours'
    ),
    (
        'ee000004-0000-0000-0000-000000000001',
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        '55555555-5555-5555-5555-555555555555',
        '35353535-3535-3535-3535-353535353535',
        'Progesterone (micronized)', '200mg', 'Once daily at night', 'Vaginal',
        'Continue until 34 weeks unless instructed otherwise.',
        CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '56 days',
        TRUE, NOW() - INTERVAL '2 days'
    )
ON CONFLICT DO NOTHING;

DO $$
BEGIN
    ALTER TABLE stage1_screenings ENABLE TRIGGER trg_stage1_escalation;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

COMMIT;
