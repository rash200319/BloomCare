-- BloomCare full seed data (PostgreSQL)
-- Run with:
--   psql -d bloomcare_db -f backend/db/seeds.sql

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

COMMIT;
