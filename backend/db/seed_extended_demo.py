"""Extended demo seed data for visual UI/UX review.

Unlike seeds.sql (which hardcodes UUIDs that don't match a database
initialized via init_db.py/seed_demo.py), this script looks up existing
users/patients by natural key (email/national_id) and only ever creates new
rows layered on top of whatever demo data already exists. Safe to run
against the actual local database.

Adds, across every table a demo needs to look populated:
  - 3 new patients spanning risk levels (one severe high-risk flagship case,
    one moderate high-risk, one routine), plus fresh screening history for
    the 2 pre-existing demo patients.
  - Stage 1 screenings, Stage 2 diagnostics, longitudinal screening reports,
    and patient reports for the high-risk cases.
  - Prescriptions.
  - Staff-booked appointments, including some only a few hours out.
  - Notifications timed to land as unread "just now" -- appointment
    reminders and escalation alerts -- so the patient Reminders tab and
    staff notification bell have something fresh to show without waiting on
    real timers.

Run with:
    python backend/db/seed_extended_demo.py
"""
from __future__ import annotations

import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.core.security import get_password_hash
from backend.db.session import SessionLocal
from backend.models.appointment import Appointment
from backend.models.notification import Notification
from backend.models.patient import Patient
from backend.models.prescription import Prescription
from backend.models.longitudinal import ScreeningReport
from backend.models.screening import PatientReport, RiskTier, Stage1Screening, Stage2Diagnostic
from backend.models.user import User, UserRole
from backend.services.appointment_service import AppointmentService, SlotUnavailableError


def get_or_create_patient(db, *, national_id, full_name, age, contact_number,
                           emergency_contact, blood_group, assigned_worker_id) -> Patient:
    existing = db.query(Patient).filter(Patient.national_id == national_id).first()
    if existing:
        print(f"  patient already exists: {full_name} ({national_id})")
        return existing
    patient = Patient(
        id=str(uuid.uuid4()),
        national_id=national_id,
        full_name=full_name,
        age=age,
        contact_number=contact_number,
        emergency_contact=emergency_contact,
        blood_group=blood_group,
        hashed_password=get_password_hash("rash2003"),
        first_time_login=False,
        assigned_worker_id=assigned_worker_id,
    )
    db.add(patient)
    db.flush()
    print(f"  created patient: {full_name} ({national_id})")
    return patient


def add_screening(db, *, patient, worker_id, gestational_age_weeks, vitals,
                   classification: RiskTier, score, triggers, disease, collected_at):
    existing = (
        db.query(Stage1Screening)
        .filter(Stage1Screening.patient_id == patient.id, Stage1Screening.encounter_id.like("seed-ext-%"))
        .first()
    )
    if existing:
        print(f"  screening already seeded for: {patient.full_name}")
        existing_report = db.query(ScreeningReport).filter(ScreeningReport.patient_id == patient.id).first()
        return existing, existing_report

    screening = Stage1Screening(
        id=str(uuid.uuid4()),
        patient_id=patient.id,
        worker_id=worker_id,
        encounter_id=f"seed-ext-{uuid.uuid4().hex[:8]}",
        gestational_age_weeks=gestational_age_weeks,
        edge_risk_classification=classification,
        edge_risk_score=score,
        contributing_factors={"triggers": triggers, "observation": "Seeded for UI review"},
        stage2_priority={"recommended_primary_disease": disease,
                          "risk_flag": "High" if classification == RiskTier.escalate else "Low"},
        device_id="web-frontline-dashboard",
        collected_at=collected_at,
        synced_at=collected_at,
        **vitals,
    )
    db.add(screening)
    db.flush()

    report = ScreeningReport(
        id=str(uuid.uuid4()),
        patient_id=patient.id,
        general_risk_flag="High" if classification == RiskTier.escalate else "Low",
        probability_score=score,
        triggers=triggers,
        screened_at=collected_at,
        recorded_by=worker_id,
    )
    db.add(report)
    db.flush()
    return screening, report


def main() -> None:
    db = SessionLocal()
    now = datetime.now(timezone.utc)
    try:
        print("Looking up existing staff/specialist accounts...")
        frontline = db.query(User).filter(User.role == UserRole.FRONTLINE_STAFF).first()
        admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
        specialists = db.query(User).filter(User.role == UserRole.CLINICAL_SPECIALIST).order_by(User.email).all()
        if not frontline or not specialists:
            print("Missing baseline demo staff/specialist accounts -- run backend/db/init_db.py first.")
            return
        specialist_a = specialists[0]
        specialist_b = specialists[1] if len(specialists) > 1 else specialists[0]
        print(f"  frontline staff: {frontline.full_name}")
        print(f"  specialists: {', '.join(s.full_name + ' (' + s.email + ')' for s in specialists)}")

        existing_nimalka = db.query(Patient).filter(Patient.national_id == "NIC-900000001V").first()
        existing_demo = db.query(Patient).filter(Patient.national_id == "199912345678").first()

        print("\nCreating new patients (skipped if they already exist)...")
        kavindi = get_or_create_patient(
            db, national_id="NIC-900000003V", full_name="Kavindi Silva", age=34,
            contact_number="0771234701", emergency_contact="0771234702",
            blood_group="B+", assigned_worker_id=frontline.id,
        )
        sanduni = get_or_create_patient(
            db, national_id="NIC-900000002V", full_name="Sanduni Perera", age=31,
            contact_number="0771234601", emergency_contact="0771234602",
            blood_group="A+", assigned_worker_id=frontline.id,
        )
        ishara = get_or_create_patient(
            db, national_id="NIC-900000004V", full_name="Ishara Jayasuriya", age=25,
            contact_number="0771234801", emergency_contact="0771234802",
            blood_group="O-", assigned_worker_id=frontline.id,
        )
        db.commit()

        print("\nAdding Stage 1 screenings + longitudinal reports...")
        kavindi_screening, _ = add_screening(
            db, patient=kavindi, worker_id=frontline.id, gestational_age_weeks=34,
            vitals=dict(age=34, systolic=168, diastolic=110, bmi=31.2, heart_rate=98,
                        temperature=37.1, Blood_sugar=118.0, hemoglobin=10.1,
                        pcos=False, previous_complications=True, preexisting_diabetes=False,
                        mental_health=6, sleep_pattern=3, exercise=2, education=3),
            classification=RiskTier.escalate, score=0.910,
            triggers=["Severe hypertension", "Prior complication history", "Urgent Stage 2 referral"],
            disease="preeclampsia", collected_at=now - timedelta(hours=3),
        )
        sanduni_screening, _ = add_screening(
            db, patient=sanduni, worker_id=frontline.id, gestational_age_weeks=32,
            vitals=dict(age=31, systolic=145, diastolic=94, bmi=29.4, heart_rate=101,
                        temperature=37.3, Blood_sugar=131.0, hemoglobin=10.8,
                        pcos=True, previous_complications=True, preexisting_diabetes=False,
                        mental_health=6, sleep_pattern=4, exercise=2, education=4),
            classification=RiskTier.escalate, score=0.740,
            triggers=["Elevated BP", "Elevated glucose", "Stage 2 follow-up"],
            disease="gdm", collected_at=now - timedelta(hours=20),
        )
        add_screening(
            db, patient=ishara, worker_id=frontline.id, gestational_age_weeks=14,
            vitals=dict(age=25, systolic=112, diastolic=74, bmi=22.0, heart_rate=76,
                        temperature=36.7, Blood_sugar=88.0, hemoglobin=12.6,
                        pcos=False, previous_complications=False, preexisting_diabetes=False,
                        mental_health=2, sleep_pattern=8, exercise=5, education=6),
            classification=RiskTier.routine_care, score=0.180,
            triggers=["Routine first-trimester check"], disease="routine_follow_up",
            collected_at=now - timedelta(hours=6),
        )
        if existing_nimalka:
            add_screening(
                db, patient=existing_nimalka, worker_id=frontline.id, gestational_age_weeks=22,
                vitals=dict(age=28, systolic=118, diastolic=76, bmi=23.8, heart_rate=74,
                            temperature=36.6, Blood_sugar=91.0, hemoglobin=12.4,
                            pcos=False, previous_complications=False, preexisting_diabetes=False,
                            mental_health=2, sleep_pattern=7, exercise=4, education=5),
                classification=RiskTier.routine_care, score=0.210,
                triggers=["Routine follow-up", "Improved from baseline"], disease="routine_follow_up",
                collected_at=now - timedelta(hours=8),
            )
        if existing_demo:
            add_screening(
                db, patient=existing_demo, worker_id=frontline.id, gestational_age_weeks=18,
                vitals=dict(age=27, systolic=116, diastolic=75, bmi=24.1, heart_rate=79,
                            temperature=36.8, Blood_sugar=89.0, hemoglobin=12.1,
                            pcos=False, previous_complications=False, preexisting_diabetes=False,
                            mental_health=3, sleep_pattern=6, exercise=3, education=5),
                classification=RiskTier.routine_care, score=0.240,
                triggers=["Routine second-trimester check"], disease="routine_follow_up",
                collected_at=now - timedelta(hours=10),
            )
        db.commit()

        def get_or_create_diagnostic(*, patient, specialist, screening, **kwargs):
            existing = db.query(Stage2Diagnostic).filter(Stage2Diagnostic.patient_id == patient.id).first()
            if existing:
                print(f"  diagnostic already seeded for: {patient.full_name}")
                return existing
            diag = Stage2Diagnostic(
                id=str(uuid.uuid4()), patient_id=patient.id, specialist_id=specialist.id,
                stage1_screening_id=screening.id, **kwargs,
            )
            db.add(diag)
            db.flush()
            print(f"  created diagnostic for: {patient.full_name}")
            return diag

        print("\nAdding Stage 2 diagnostics for the high-risk cases...")
        kavindi_diag = get_or_create_diagnostic(
            patient=kavindi, specialist=specialist_a, screening=kavindi_screening,
            gestational_age_weeks=34, primary_disease_checked="preeclampsia",
            model_used="stage2_preeclampsia_model_v1",
            sflt1_plgf_ratio=98.60, plgf_absolute=61.30, papp_a=1.20, cervical_length_mm=24.0,
            metabolomics={"panel": "extended", "status": "completed"},
            doppler={"umbilical_artery_pi": 1.6, "uterine_notching": True},
            disease_specific_inputs={"symptoms": ["headache", "visual disturbance", "edema"]},
            cluster_profile={"cluster": "A1"},
            condition_probabilities={"preeclampsia": 0.91, "gdm": 0.22},
            explainability_data={"feature_importance": {"systolic": 0.38, "sflt1_plgf_ratio": 0.31, "previous_complications": 0.16},
                                  "notes": "Seeded explainability snapshot"},
            input_snapshot={"gestational_age_weeks": 34, "primary_disease_checked": "preeclampsia", "input_quality": "complete"},
            overall_severity_score=0.910, dominant_condition="preeclampsia",
            evaluated_at=now - timedelta(hours=2),
        )
        sanduni_diag = get_or_create_diagnostic(
            patient=sanduni, specialist=specialist_b, screening=sanduni_screening,
            gestational_age_weeks=32, primary_disease_checked="gdm", model_used="stage2_gdm_model_v1",
            sflt1_plgf_ratio=54.10, plgf_absolute=88.40, papp_a=1.60, cervical_length_mm=31.0,
            metabolomics={"panel": "basic", "status": "completed"},
            doppler={"umbilical_artery_pi": 1.1, "uterine_notching": False},
            disease_specific_inputs={"symptoms": ["excess thirst", "fatigue"]},
            cluster_profile={"cluster": "B1"},
            condition_probabilities={"gdm": 0.74, "preeclampsia": 0.28},
            explainability_data={"feature_importance": {"blood_sugar": 0.35, "bmi": 0.24, "pcos": 0.19},
                                  "notes": "Seeded explainability snapshot"},
            input_snapshot={"gestational_age_weeks": 32, "primary_disease_checked": "gdm", "input_quality": "complete"},
            overall_severity_score=0.740, dominant_condition="gdm",
            evaluated_at=now - timedelta(hours=14),
        )
        db.commit()

        def get_or_create_report(*, patient, **kwargs):
            existing = db.query(PatientReport).filter(PatientReport.patient_id == patient.id).first()
            if existing:
                print(f"  report already seeded for: {patient.full_name}")
                return existing
            report = PatientReport(id=str(uuid.uuid4()), patient_id=patient.id, **kwargs)
            db.add(report)
            db.flush()
            print(f"  created report for: {patient.full_name}")
            return report

        print("Adding patient reports...")
        get_or_create_report(
            patient=kavindi, stage1_screening_id=kavindi_screening.id,
            stage2_diagnostic_id=kavindi_diag.id, report_type="combined",
            report_title="Combined Stage 1 + Stage 2 Report", content_type="json",
            report_content={"risk": "High", "dominant_condition": "preeclampsia", "source": "seed"},
            generated_by=specialist_a.id, generated_at=now - timedelta(hours=2),
        )
        get_or_create_report(
            patient=sanduni, stage1_screening_id=sanduni_screening.id,
            stage2_diagnostic_id=sanduni_diag.id, report_type="combined",
            report_title="Combined Stage 1 + Stage 2 Report", content_type="json",
            report_content={"risk": "High", "dominant_condition": "gdm", "source": "seed"},
            generated_by=specialist_b.id, generated_at=now - timedelta(hours=14),
        )
        db.commit()

        def get_or_create_prescription(*, patient, **kwargs):
            existing = (
                db.query(Prescription)
                .filter(Prescription.patient_id == patient.id, Prescription.medication_name == kwargs["medication_name"])
                .first()
            )
            if existing:
                print(f"  prescription already seeded for: {patient.full_name}")
                return existing
            rx = Prescription(id=str(uuid.uuid4()), patient_id=patient.id, **kwargs)
            db.add(rx)
            db.flush()
            print(f"  created prescription for: {patient.full_name}")
            return rx

        print("\nAdding prescriptions...")
        get_or_create_prescription(
            patient=kavindi, specialist_id=specialist_a.id, stage2_diagnostic_id=kavindi_diag.id,
            medication_name="Methyldopa", dosage="250mg", frequency="Three times daily",
            route="Oral", instructions="Monitor blood pressure daily",
        )
        get_or_create_prescription(
            patient=sanduni, specialist_id=specialist_b.id, stage2_diagnostic_id=sanduni_diag.id,
            medication_name="Metformin", dosage="500mg", frequency="Twice daily",
            route="Oral", instructions="Take with meals",
        )
        get_or_create_prescription(
            patient=ishara, specialist_id=specialist_a.id,
            medication_name="Folic Acid", dosage="5mg", frequency="Once daily",
            route="Oral", instructions="Continue throughout pregnancy",
        )
        db.commit()

        print("\nCreating appointments (near-term ones will get reminder notifications)...")
        appt_plan = [
            (kavindi, specialist_a.full_name, "HIGH_RISK_FOLLOW_UP", now + timedelta(hours=2),
             "Urgent review for severe hypertension", frontline, 30),
            (sanduni, specialist_b.full_name, "HIGH_RISK_FOLLOW_UP", now + timedelta(hours=26),
             "GDM follow-up", admin or frontline, 30),
            (ishara, specialist_a.full_name, "PRENATAL_CHECKUP", now + timedelta(days=3, hours=1),
             "First prenatal visit", frontline, 20),
        ]
        if existing_nimalka:
            appt_plan.append(
                (existing_nimalka, specialist_b.full_name, "GLUCOSE_SCREENING", now + timedelta(hours=5),
                 "Same-day glucose tolerance check", frontline, 20)
            )

        created_appointments: dict[str, tuple] = {}
        for patient, specialist_name, apt_type, when, notes, actor, duration in appt_plan:
            try:
                result = AppointmentService.create_appointment_by_nic(
                    db, patient.national_id, patient.full_name, specialist_name,
                    when, apt_type, notes, duration, actor,
                )
                created_appointments[patient.national_id] = (result.appointment.id, when, specialist_name)
                print(f"  created appointment: {patient.full_name} / {apt_type} @ {when.isoformat()}")
            except (SlotUnavailableError, Exception) as exc:
                print(f"  skipped appointment for {patient.full_name} ({apt_type}): {exc}")
        db.commit()

        print("\nCreating notifications timed to appear fresh right now...")

        def add_notification(*, recipient_id, recipient_type, notification_type, title, message,
                              appointment_id=None, seconds_ago, dedup_suffix):
            key = f"seed-ext-{dedup_suffix}"
            if db.query(Notification).filter(Notification.deduplication_key == key).first():
                print(f"  notification already seeded: {title}")
                return
            db.add(Notification(
                id=str(uuid.uuid4()), recipient_id=recipient_id, recipient_type=recipient_type,
                appointment_id=appointment_id, notification_type=notification_type,
                title=title, message=message, is_read=False,
                related_data={"source": "seed_extended_demo"},
                deduplication_key=key,
                created_at=now - timedelta(seconds=seconds_ago),
            ))
            print(f"  notification: {title} ({seconds_ago}s ago)")

        if kavindi.national_id in created_appointments:
            appt_id, when, spec_name = created_appointments[kavindi.national_id]
            add_notification(
                recipient_id=kavindi.id, recipient_type="PATIENT",
                notification_type="APPOINTMENT_REMINDER", title="Appointment Reminder",
                message=f"Reminder: your appointment with {spec_name} is scheduled for {when.strftime('%B %d, %Y at %I:%M %p')}.",
                appointment_id=appt_id, seconds_ago=20, dedup_suffix="kavindi-reminder-2h",
            )
        if sanduni.national_id in created_appointments:
            appt_id, when, spec_name = created_appointments[sanduni.national_id]
            add_notification(
                recipient_id=sanduni.id, recipient_type="PATIENT",
                notification_type="APPOINTMENT_REMINDER", title="Appointment Reminder",
                message=f"Reminder: your appointment with {spec_name} is scheduled for {when.strftime('%B %d, %Y at %I:%M %p')}.",
                appointment_id=appt_id, seconds_ago=150, dedup_suffix="sanduni-reminder-24h",
            )
        if existing_nimalka and existing_nimalka.national_id in created_appointments:
            appt_id, when, spec_name = created_appointments[existing_nimalka.national_id]
            add_notification(
                recipient_id=existing_nimalka.id, recipient_type="PATIENT",
                notification_type="APPOINTMENT_REMINDER", title="Appointment Reminder",
                message=f"Reminder: your appointment with {spec_name} is scheduled for {when.strftime('%B %d, %Y at %I:%M %p')}.",
                appointment_id=appt_id, seconds_ago=45, dedup_suffix="nimalka-reminder-5h",
            )

        add_notification(
            recipient_id=specialist_a.id, recipient_type="STAFF",
            notification_type="ESCALATION_ALERT", title="High-Risk Patient Escalated",
            message=f"{kavindi.full_name} was classified as high-risk (severe hypertension) and requires urgent review.",
            seconds_ago=60, dedup_suffix="kavindi-escalation",
        )
        add_notification(
            recipient_id=specialist_b.id, recipient_type="STAFF",
            notification_type="ESCALATION_ALERT", title="High-Risk Patient Escalated",
            message=f"{sanduni.full_name} was classified as high-risk (GDM indicators) and requires follow-up.",
            seconds_ago=300, dedup_suffix="sanduni-escalation",
        )
        if ishara.national_id in created_appointments:
            appt_id, when, spec_name = created_appointments[ishara.national_id]
            add_notification(
                recipient_id=frontline.id, recipient_type="STAFF",
                notification_type="APPOINTMENT_SCHEDULED", title="Appointment Scheduled",
                message=f"Prenatal checkup scheduled for {ishara.full_name} with {spec_name}.",
                appointment_id=appt_id, seconds_ago=600, dedup_suffix="ishara-scheduled",
            )
        db.commit()

        print("\nDone.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
