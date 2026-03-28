from fastapi import APIRouter, Depends, HTTPException, status
from typing import Any
from sqlalchemy.orm import Session
import logging

from core.deps import get_db, get_current_active_user
from schemas.screening import DiagnoseInput, DiagnoseResponse
from models.user import User
from models.screening import Stage2Diagnostic
# import the ML service properly (assuming we adapted ml_services)
from services.ml_services import run_stage2_phenotyping_engine

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/", response_model=DiagnoseResponse)
def run_diagnose(
    payload: DiagnoseInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    # RBAC: Only Clinical Specialist or Admin can perform stage 2
    if current_user.role.value not in ["CLINICAL_SPECIALIST", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized to perform Stage-2 diagnosis")

    try:
        # We process via existed ML service
        ml_output = run_stage2_phenotyping_engine(payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ML logic failed: {exc}",
        )

    # Convert complex lists to dicts for JSONB serialization
    condition_probs = [c.model_dump() for c in ml_output.condition_probabilities]
    cluster_prof = ml_output.cluster_profile.model_dump()

    # DB Persistence
    import uuid
    db_diag = Stage2Diagnostic(
        id=str(uuid.uuid4()),
        patient_id=payload.patient_id,
        specialist_id=current_user.id,
        gestational_age_weeks=payload.gestational_age_weeks,
        sflt1_plgf_ratio=payload.sflt1_plgf_ratio,
        plgf_absolute=payload.plgf_absolute,
        papp_a=payload.papp_a,
        cervical_length_mm=payload.cervical_length_mm,
        metabolomics=payload.metabolomics.model_dump() if payload.metabolomics else None,
        doppler=payload.doppler.model_dump() if payload.doppler else None,
        cluster_profile=cluster_prof,
        condition_probabilities=condition_probs,
        overall_severity_score=ml_output.overall_severity_score,
        dominant_condition=ml_output.dominant_condition.value
    )
    db.add(db_diag)
    db.commit()

    severity = ml_output.overall_severity_score
    urgent = severity >= 0.65
    referral = "Urgent referral to MFM." if urgent else "Monitor closely."
    
    return DiagnoseResponse(
        status="success",
        ml_output=ml_output,
        recommended_specialist_referral=referral,
        urgent=urgent,
    )
