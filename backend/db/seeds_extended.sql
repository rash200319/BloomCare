-- BloomCare extended seed data (PostgreSQL)
-- This script is additive and kept separate from backend/db/seeds.sql
-- Run with:
--   psql -d bloomcare_db -f backend/db/seeds_extended.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
SET search_path TO "BloomCare", public;

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

COMMIT;
