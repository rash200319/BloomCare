from datetime import datetime
from typing import Any
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session

from core.deps import get_current_active_user, get_db
from models.longitudinal import ScreeningReport
from models.patient import Patient as DBPatient
from models.screening import PatientReport, Stage1Screening, RiskTier
from models.user import User
from schemas.longitudinal import (
    PatientHistoryResponse,
    ScreeningHistoryItem,
    ScreeningSubmissionRequest,
    SubmitScreeningResponse,
    TrendSummary,
)

router = APIRouter()


def _role_name(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def _safe_uuid_or_none(value: Any) -> str | None:
    try:
        return str(uuid.UUID(str(value)))
    except Exception:
        return None


def _to_bool(value: Any) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    try:
        return bool(int(value))
    except Exception:
        return None


@router.post("/submit-screening", response_model=SubmitScreeningResponse)
def submit_screening(
    payload: ScreeningSubmissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    current_user_id = _safe_uuid_or_none(getattr(current_user, "id", None))

    try:
        query_filters = []
        if payload.patient_unique_id:
            query_filters.append(DBPatient.national_id == payload.patient_unique_id)
        if payload.phone:
            query_filters.append(DBPatient.contact_number == payload.phone)

        patient = db.query(DBPatient).filter(or_(*query_filters)).first() if query_filters else None
        created_patient = False

        if patient is None:
            patient = DBPatient(
                id=str(uuid.uuid4()),
                national_id=payload.patient_unique_id,
                full_name=payload.name,
                age=payload.age,
                contact_number=payload.contact,
                assigned_worker_id=current_user_id,
            )
            db.add(patient)
            db.flush()
            created_patient = True
        else:
            patient.full_name = payload.name
            patient.age = payload.age
            if payload.contact:
                patient.contact_number = payload.contact
            if payload.patient_unique_id and not patient.national_id:
                patient.national_id = payload.patient_unique_id
            if not patient.assigned_worker_id and current_user_id:
                patient.assigned_worker_id = current_user_id

        now_ts = payload.screened_at or datetime.utcnow()
        risk_tier = RiskTier.routine_care if payload.general_risk_flag == "Low" else RiskTier.escalate

        stage1_screening = Stage1Screening(
            id=str(uuid.uuid4()),
            patient_id=patient.id,
            worker_id=current_user_id,
            encounter_id=f"web-{uuid.uuid4().hex[:12]}",
            gestational_age_weeks=payload.gestational_age_weeks,
            age=payload.age,
            systolic=payload.systolic,
            diastolic=payload.diastolic,
            bmi=payload.bmi,
            heart_rate=payload.heart_rate,
            temperature=payload.temperature,
            Blood_sugar=payload.blood_sugar,
            hemoglobin=payload.hemoglobin,
            pcos=_to_bool(payload.pcos),
            previous_complications=_to_bool(payload.previous_complications),
            preexisting_diabetes=_to_bool(payload.preexisting_diabetes),
            mental_health=payload.mental_health,
            sleep_pattern=payload.sleep_pattern,
            exercise=payload.exercise,
            education=payload.education,
            edge_risk_classification=risk_tier,
            edge_risk_score=payload.probability_score,
            contributing_factors={
                "triggers": payload.triggers,
                "bp_status": payload.bp_status,
                "observation": payload.observation,
                "map": payload.map,
            },
            stage2_priority={
                "recommended_primary_disease": "preeclampsia" if payload.general_risk_flag == "High" else "routine_follow_up",
                "risk_flag": payload.general_risk_flag,
            },
            device_id="web-frontline-dashboard",
            collected_at=now_ts,
        )
        db.add(stage1_screening)
        db.flush()

        patient_report = PatientReport(
            id=str(uuid.uuid4()),
            patient_id=patient.id,
            stage1_screening_id=stage1_screening.id,
            stage2_diagnostic_id=None,
            report_type="stage1",
            report_title=f"Stage 1 Screening Report - {now_ts.date().isoformat()}",
            content_type="json",
            report_content={
                "patient": {
                    "id": str(patient.id),
                    "name": patient.full_name,
                    "national_id": patient.national_id,
                    "contact": patient.contact_number,
                    "age": patient.age,
                },
                "stage1_screening": {
                    "id": str(stage1_screening.id),
                    "encounter_id": stage1_screening.encounter_id,
                    "gestational_age_weeks": stage1_screening.gestational_age_weeks,
                    "vitals": {
                        "systolic": payload.systolic,
                        "diastolic": payload.diastolic,
                        "bmi": payload.bmi,
                        "heart_rate": payload.heart_rate,
                        "blood_sugar": payload.blood_sugar,
                        "temperature": payload.temperature,
                        "hemoglobin": payload.hemoglobin,
                        "pcos": payload.pcos,
                        "previous_complications": payload.previous_complications,
                        "preexisting_diabetes": payload.preexisting_diabetes,
                        "mental_health": payload.mental_health,
                        "sleep_pattern": payload.sleep_pattern,
                        "exercise": payload.exercise,
                        "education": payload.education,
                        "map": payload.map,
                    },
                },
                "risk": {
                    "general_risk_flag": payload.general_risk_flag,
                    "probability_score": payload.probability_score,
                    "triggers": payload.triggers,
                    "bp_status": payload.bp_status,
                    "observation": payload.observation,
                },
                "screened_at": now_ts.isoformat(),
            },
            generated_by=current_user_id,
        )
        db.add(patient_report)

        report = ScreeningReport(
            id=str(uuid.uuid4()),
            patient_id=patient.id,
            general_risk_flag=payload.general_risk_flag,
            probability_score=payload.probability_score,
            triggers=payload.triggers,
            screened_at=now_ts,
            recorded_by=current_user_id,
        )
        db.add(report)
        db.commit()
        db.refresh(report)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to persist stage 1 screening data: {exc}") from exc

    return SubmitScreeningResponse(
        patient_id=str(patient.id),
        stage1_screening_id=str(stage1_screening.id),
        patient_report_id=str(patient_report.id),
        report_id=str(report.id),
        created_patient=created_patient,
        general_risk_flag=report.general_risk_flag,
        probability_score=float(report.probability_score),
        screened_at=report.screened_at,
    )


@router.get("/patient-history/{patient_id}", response_model=PatientHistoryResponse)
def patient_history(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    patient = db.query(DBPatient).filter(DBPatient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    role = _role_name(current_user)
    if role not in ["ADMIN", "CLINICAL_SPECIALIST"]:
        if str(getattr(patient, "assigned_worker_id", "")) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Not authorized to view this patient history")

    reports = (
        db.query(ScreeningReport)
        .filter(cast(ScreeningReport.patient_id, String) == str(patient_id))
        .order_by(ScreeningReport.screened_at.asc())
        .all()
    )

    report_items = [
        ScreeningHistoryItem(
            report_id=report.id,
            screened_at=report.screened_at,
            general_risk_flag=report.general_risk_flag,
            probability_score=float(report.probability_score),
            triggers=report.triggers or [],
        )
        for report in reports
    ]

    total = len(report_items)
    high = sum(1 for item in report_items if item.general_risk_flag == "High")
    avg_probability = (sum(item.probability_score for item in report_items) / total) if total > 0 else 0.0
    latest = report_items[-1].general_risk_flag if total > 0 else None

    return PatientHistoryResponse(
        patient_id=str(patient.id),
        patient_name=patient.full_name,
        age=patient.age,
        contact=patient.contact_number,
        summary=TrendSummary(
            total_reports=total,
            high_risk_reports=high,
            high_risk_ratio=round(high / total, 3) if total > 0 else 0.0,
            average_probability=round(avg_probability, 4),
            latest_risk_flag=latest,
        ),
        reports=report_items,
    )
