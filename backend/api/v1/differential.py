from typing import Any
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sklearn import __version__ as sklearn_version

from core.deps import get_current_active_user, get_db
from models.patient import Patient as DBPatient
from models.screening import Stage1Screening, Stage2Diagnostic
from models.user import User
from schemas.differential import DifferentialEvaluationRequest, DifferentialEvaluationResponse
from services.differential_service import evaluate_differential


router = APIRouter()


@router.post("/evaluate-differential", response_model=DifferentialEvaluationResponse)
def evaluate_differential_endpoint(
    payload: DifferentialEvaluationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    if current_user.role.value not in ["CLINICAL_SPECIALIST", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized to run differential diagnosis")

    try:
        result, primary_risk, explainability_model, explainability = evaluate_differential(payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Differential evaluation failed: {exc}",
        ) from exc

    patient = db.query(DBPatient).filter(DBPatient.id == payload.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    stage1_screening = None
    if payload.stage1_screening_id:
        stage1_screening = db.query(Stage1Screening).filter(Stage1Screening.id == payload.stage1_screening_id).first()

    if payload.gestational_age_weeks is not None:
        gestational_age_weeks = payload.gestational_age_weeks
    elif stage1_screening is not None and stage1_screening.gestational_age_weeks is not None:
        gestational_age_weeks = int(stage1_screening.gestational_age_weeks)
    else:
        gestational_age_weeks = 20

    overall_severity = max(
        float(result["preeclampsia"]["probability"]),
        float(result["gdm"]["probability"]),
        float(result["preterm_birth"]["probability"]),
    )

    stage2_diagnostic_id: str | None = None
    try:
        stage2_record = Stage2Diagnostic(
            patient_id=payload.patient_id,
            specialist_id=str(current_user.id),
            stage1_screening_id=payload.stage1_screening_id,
            gestational_age_weeks=gestational_age_weeks,
            primary_disease_checked=primary_risk,
            model_used=f"Differential PE/GDM/PTB | sklearn={sklearn_version}",
            sflt1_plgf_ratio=Decimal(str(payload.sflt1_plgf_ratio)),
            cervical_length_mm=Decimal(str(payload.cervical_length_mm)),
            metabolomics={
                "serum_creatinine": payload.serum_creatinine,
                "hba1c": payload.hba1c,
                "ogtt_1hr": payload.ogtt_1hr,
                "ogtt_2hr": payload.ogtt_2hr,
                "blood_sugar": payload.blood_sugar,
            },
            doppler={
                "mean_pulse_pressure": payload.mean_pulse_pressure,
                "heart_rate": payload.heart_rate,
            },
            disease_specific_inputs={
                "platelet_count": payload.platelet_count,
                "pregnancies_count": payload.pregnancies_count,
                "ffn_result": payload.ffn_result,
                "bmi": payload.bmi,
                "temperature": payload.temperature,
                "systolic_bp": payload.systolic_bp,
                "diastolic_bp": payload.diastolic_bp,
            },
            condition_probabilities={
                "preeclampsia": result["preeclampsia"],
                "gdm": result["gdm"],
                "preterm_birth": result["preterm_birth"],
                "primary_risk": primary_risk,
            },
            explainability_data={
                "model": explainability_model,
                "features": explainability,
            },
            input_snapshot=payload.model_dump(),
            overall_severity_score=Decimal(str(round(overall_severity, 3))),
            dominant_condition=primary_risk,
        )
        db.add(stage2_record)
        db.commit()
        db.refresh(stage2_record)
        stage2_diagnostic_id = str(stage2_record.id)
    except Exception:
        db.rollback()

    return DifferentialEvaluationResponse(
        stage2_diagnostic_id=stage2_diagnostic_id,
        preeclampsia=result["preeclampsia"],
        gdm=result["gdm"],
        preterm_birth=result["preterm_birth"],
        primary_risk=primary_risk,
        explainability_model=explainability_model,
        explainability=explainability,
    )


@router.get("/patients/{patient_id}/risk-journey")
def patient_risk_journey(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    if current_user.role.value not in ["CLINICAL_SPECIALIST", "ADMIN", "FRONTLINE_STAFF"]:
        raise HTTPException(status_code=403, detail="Not authorized to view patient risk journey")

    patient = db.query(DBPatient).filter(DBPatient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    diagnostics = (
        db.query(Stage2Diagnostic)
        .filter(Stage2Diagnostic.patient_id == patient_id)
        .order_by(Stage2Diagnostic.evaluated_at.asc())
        .all()
    )

    items = []
    for row in diagnostics:
        cp = row.condition_probabilities or {}
        items.append(
            {
                "stage2_diagnostic_id": row.id,
                "evaluated_at": row.evaluated_at.isoformat() if row.evaluated_at else None,
                "primary_disease_checked": row.primary_disease_checked,
                "model_used": row.model_used,
                "overall_severity_score": float(row.overall_severity_score) if row.overall_severity_score is not None else None,
                "dominant_condition": row.dominant_condition,
                "specialist_id": row.specialist_id,
                "stage1_screening_id": row.stage1_screening_id,
                "condition_probabilities": cp,
                "explainability_data": row.explainability_data or {},
                "input_snapshot": row.input_snapshot or {},
            }
        )

    return {
        "patient_id": patient.id,
        "patient_name": patient.full_name,
        "journey": items,
    }
