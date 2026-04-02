"""
Stage 2 Specialist Diagnostics Workflow
GET: Fetch pending evaluations for a specialist
POST: Submit diagnostic evaluation results
"""

from typing import Any, List
from decimal import Decimal
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_
from sqlalchemy.orm import Session

from core.deps import get_current_active_user, get_db
from models.patient import Patient as DBPatient
from models.screening import Stage1Screening, Stage2Diagnostic, Stage2Recommendation
from models.user import User
from schemas.differential import DifferentialEvaluationRequest, DifferentialEvaluationResponse
from services.differential_service import evaluate_differential

router = APIRouter()


# ============================================================================
# SCHEMAS (In-line for convenience)
# ============================================================================


class PendingEvaluationItem:
    """Represents a patient awaiting specialist evaluation"""
    def __init__(self, 
                 patient_id: str,
                 patient_name: str,
                 age: int,
                 blood_group: str,
                 stage1_screening_id: str,
                 stage1_risk_score: float,
                 stage1_classification: str,
                 stage1_risk_factors: list,
                 recommendation_id: str,
                 disease_to_check: str,
                 clinical_notes: str,
                 created_at: datetime):
        self.patient_id = patient_id
        self.patient_name = patient_name
        self.age = age
        self.blood_group = blood_group
        self.stage1_screening_id = stage1_screening_id
        self.stage1_risk_score = stage1_risk_score
        self.stage1_classification = stage1_classification
        self.stage1_risk_factors = stage1_risk_factors
        self.recommendation_id = recommendation_id
        self.disease_to_check = disease_to_check
        self.clinical_notes = clinical_notes
        self.created_at = created_at

    def to_dict(self) -> dict:
        return {
            "patient_id": self.patient_id,
            "patient_name": self.patient_name,
            "age": self.age,
            "blood_group": self.blood_group,
            "stage1_screening_id": self.stage1_screening_id,
            "stage1_risk_score": float(self.stage1_risk_score),
            "stage1_classification": self.stage1_classification,
            "stage1_risk_factors": self.stage1_risk_factors,
            "recommendation_id": self.recommendation_id,
            "disease_to_check": self.disease_to_check,
            "clinical_notes": self.clinical_notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ============================================================================
# ENDPOINTS
# ============================================================================


@router.get("/specialist/pending-evaluations")
def get_pending_evaluations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, Any]:
    """
    📋 Fetch pending evaluations for the current specialist
    
    Returns:
        List of patients awaiting specialist evaluation with Stage 1 context
        
    Joins:
        stage2_recommendations + patients + stage1_screenings
        
    Authorization: CLINICAL_SPECIALIST, ADMIN only
    """
    if current_user.role.value not in ["CLINICAL_SPECIALIST", "ADMIN"]:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to view pending evaluations"
        )

    try:
        # Query pending recommendations that haven't been evaluated yet
        pending = db.query(
            Stage2Recommendation,
            DBPatient,
            Stage1Screening
        ).join(
            DBPatient, Stage2Recommendation.patient_id == DBPatient.id
        ).join(
            Stage1Screening, Stage2Recommendation.stage1_screening_id == Stage1Screening.id
        ).filter(
            # Recommendations that aren't expired and don't have stage2 diagnostics yet
            and_(
                Stage2Recommendation.expires_at.is_(None) | (Stage2Recommendation.expires_at > datetime.utcnow()),
                ~db.query(Stage2Diagnostic).filter(
                    Stage2Diagnostic.stage1_screening_id == Stage1Screening.id
                ).exists()
            )
        ).order_by(
            Stage2Recommendation.created_at.desc()
        ).all()

        evaluations = []
        for rec, patient, stage1 in pending:
            # Extract risk factors from contributing_factors JSON
            risk_factors = []
            if stage1.contributing_factors:
                for key, value in stage1.contributing_factors.items():
                    if key != "triggers":
                        risk_factors.append({
                            "factor": key,
                            "importance": float(value) if isinstance(value, (int, float)) else 0.0
                        })

            item = PendingEvaluationItem(
                patient_id=str(patient.id),
                patient_name=patient.full_name,
                age=patient.age or 0,
                blood_group=patient.blood_group or "Unknown",
                stage1_screening_id=str(stage1.id),
                stage1_risk_score=float(stage1.edge_risk_score) if stage1.edge_risk_score else 0.0,
                stage1_classification=stage1.edge_risk_classification.value if stage1.edge_risk_classification else "unknown",
                stage1_risk_factors=risk_factors,
                recommendation_id=str(rec.id),
                disease_to_check=rec.primary_disease_to_check,
                clinical_notes=rec.clinical_notes or "",
                created_at=rec.created_at
            )
            evaluations.append(item.to_dict())

        return {
            "count": len(evaluations),
            "pending_evaluations": evaluations,
            "message": f"Found {len(evaluations)} pending evaluations"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching pending evaluations: {str(e)}"
        )


@router.post("/specialist/evaluate")
def submit_diagnostic_evaluation(
    payload: DifferentialEvaluationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DifferentialEvaluationResponse:
    """
    🔬 Submit Stage 2 diagnostic evaluation results
    
    Process:
        1. Run AI model on inputs (PE, GDM, PTB probabilities)
        2. Save stage2_diagnostic record with SHAP explainability
        3. Return diagnostic_id for frontend to fetch charts
        
    Authorization: CLINICAL_SPECIALIST, ADMIN only
    """
    if current_user.role.value not in ["CLINICAL_SPECIALIST", "ADMIN"]:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to submit evaluations"
        )

    try:
        # Run differential diagnosis model
        result, primary_risk, explainability_model, explainability = evaluate_differential(payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Differential evaluation failed: {str(exc)}",
        )

    # Verify patient exists
    patient = db.query(DBPatient).filter(DBPatient.id == payload.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Get stage 1 screening if provided
    stage1_screening = None
    if payload.stage1_screening_id:
        stage1_screening = db.query(Stage1Screening).filter(
            Stage1Screening.id == payload.stage1_screening_id
        ).first()

    # Determine gestational age
    if payload.gestational_age_weeks is not None:
        gestational_age_weeks = payload.gestational_age_weeks
    elif stage1_screening and stage1_screening.gestational_age_weeks:
        gestational_age_weeks = int(stage1_screening.gestational_age_weeks)
    else:
        gestational_age_weeks = 20

    # Calculate overall severity
    overall_severity = max(
        float(result["preeclampsia"]["probability"]),
        float(result["gdm"]["probability"]),
        float(result["preterm_birth"]["probability"]),
    )

    # Save Stage 2 Diagnostic Record
    stage2_diagnostic_id: str | None = None
    try:
        from sklearn import __version__ as sklearn_version
        
        stage2_record = Stage2Diagnostic(
            patient_id=payload.patient_id,
            specialist_id=str(current_user.id),
            stage1_screening_id=payload.stage1_screening_id,
            gestational_age_weeks=gestational_age_weeks,
            primary_disease_checked=primary_risk,
            model_used=f"Differential PE/GDM/PTB | sklearn={sklearn_version}",
            sflt1_plgf_ratio=Decimal(str(payload.sflt1_plgf_ratio)) if payload.sflt1_plgf_ratio else None,
            cervical_length_mm=Decimal(str(payload.cervical_length_mm)) if payload.cervical_length_mm else None,
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
            evaluated_at=datetime.utcnow(),
        )
        db.add(stage2_record)
        db.commit()
        db.refresh(stage2_record)
        stage2_diagnostic_id = str(stage2_record.id)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save diagnostic record: {str(e)}"
        )

    return DifferentialEvaluationResponse(
        stage2_diagnostic_id=stage2_diagnostic_id,
        preeclampsia=result["preeclampsia"],
        gdm=result["gdm"],
        preterm_birth=result["preterm_birth"],
        primary_risk=primary_risk,
        explainability_model=explainability_model,
        explainability=explainability,
    )


@router.get("/specialist/evaluation/{diagnostic_id}")
def get_evaluation_details(
    diagnostic_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, Any]:
    """
    📊 Fetch complete diagnostic evaluation with SHAP explainability charts
    
    Returns:
        Complete stage2_diagnostic record with:
        - Patient info
        - Input snapshot
        - AI probabilities & severity score
        - SHAP explainability features
        
    Authorization: CLINICAL_SPECIALIST, ADMIN, FRONTLINE_STAFF (view only)
    """
    if current_user.role.value not in ["CLINICAL_SPECIALIST", "ADMIN", "FRONTLINE_STAFF"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    diagnostic = db.query(Stage2Diagnostic).filter(
        Stage2Diagnostic.id == diagnostic_id
    ).first()

    if not diagnostic:
        raise HTTPException(status_code=404, detail="Diagnostic record not found")

    patient = db.query(DBPatient).filter(DBPatient.id == diagnostic.patient_id).first()

    return {
        "diagnostic_id": str(diagnostic.id),
        "patient_id": str(diagnostic.patient_id),
        "patient_name": patient.full_name if patient else "Unknown",
        "specialist_id": str(diagnostic.specialist_id) if diagnostic.specialist_id else None,
        "stage1_screening_id": str(diagnostic.stage1_screening_id) if diagnostic.stage1_screening_id else None,
        "gestational_age_weeks": diagnostic.gestational_age_weeks,
        "primary_disease_checked": diagnostic.primary_disease_checked,
        "model_used": diagnostic.model_used,
        "biomarkers": {
            "sflt1_plgf_ratio": float(diagnostic.sflt1_plgf_ratio) if diagnostic.sflt1_plgf_ratio else None,
            "cervical_length_mm": float(diagnostic.cervical_length_mm) if diagnostic.cervical_length_mm else None,
        },
        "metabolomics": diagnostic.metabolomics or {},
        "doppler": diagnostic.doppler or {},
        "disease_specific_inputs": diagnostic.disease_specific_inputs or {},
        "condition_probabilities": diagnostic.condition_probabilities or {},
        "explainability_data": diagnostic.explainability_data or {},
        "input_snapshot": diagnostic.input_snapshot or {},
        "overall_severity_score": float(diagnostic.overall_severity_score) if diagnostic.overall_severity_score else None,
        "dominant_condition": diagnostic.dominant_condition,
        "evaluated_at": diagnostic.evaluated_at.isoformat() if diagnostic.evaluated_at else None,
    }
