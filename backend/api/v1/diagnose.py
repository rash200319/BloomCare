from fastapi import APIRouter, Depends, HTTPException, status
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
import logging
import uuid as uuid_lib

from core.deps import get_db, get_current_active_user
from schemas.screening import DiagnoseInput, DiagnoseResponse
from models.user import User
from models.screening import Stage2Diagnostic, Stage1Screening
# import the ML service properly (assuming we adapted ml_services)
from services.ml_services import run_selected_stage2_model

logger = logging.getLogger(__name__)

router = APIRouter()

# Model selection mapping
DISEASE_MODEL_MAP = {
    "preeclampsia": "stage2_diagnostic.pkl",
    "gdm": "stage2_gdm_diagnostic.pkl",
    "preterm": "stage2_preterm_main_msf.pkl",  # Default to main model
    "preterm_ehg": "stage2_preterm_support_ehg.pkl",  # Alternative EHG model
}

MODEL_DISEASE_MAP = {model_file: disease for disease, model_file in DISEASE_MODEL_MAP.items()}


def _derive_primary_from_stage1(stage1_screening: Optional[Stage1Screening]) -> str:
    if not stage1_screening or not stage1_screening.stage2_priority:
        return "preeclampsia"
    priority = stage1_screening.stage2_priority or {}
    primary = priority.get("recommended_primary_disease")
    if primary in DISEASE_MODEL_MAP:
        return primary
    scores = priority.get("scores") or {}
    if isinstance(scores, dict) and scores:
        ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
        if ranked and ranked[0][0] in DISEASE_MODEL_MAP:
            return ranked[0][0]
    return "preeclampsia"

@router.post("/", response_model=DiagnoseResponse)
def run_diagnose(
    payload: DiagnoseInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    # RBAC: Only Clinical Specialist or Admin can perform stage 2
    if current_user.role.value not in ["CLINICAL_SPECIALIST", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized to perform Stage-2 diagnosis")

    # Determine which model to use.
    # Priority order: payload explicit choice -> Stage 1 recommended disease -> default preeclampsia.
    primary_disease = payload.primary_disease_to_check or "preeclampsia"
    model_name = DISEASE_MODEL_MAP.get(primary_disease, "stage2_diagnostic.pkl")

    # Doctors can explicitly override the model file if needed.
    if payload.model_override:
        if payload.model_override not in MODEL_DISEASE_MAP:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "Invalid model_override. Allowed values: "
                    + ", ".join(sorted(MODEL_DISEASE_MAP.keys()))
                ),
            )
        model_name = payload.model_override
        primary_disease = MODEL_DISEASE_MAP[model_name]
    
    # Retrieve stage 1 screening if provided for context
    stage1_screening = None
    if payload.stage1_screening_id:
        stage1_screening = db.query(Stage1Screening).filter(
            Stage1Screening.id == payload.stage1_screening_id
        ).first()
        if not stage1_screening:
            logger.warning(f"Stage 1 screening {payload.stage1_screening_id} not found")
        elif payload.primary_disease_to_check is None and payload.model_override is None:
            primary_disease = _derive_primary_from_stage1(stage1_screening)
            model_name = DISEASE_MODEL_MAP.get(primary_disease, "stage2_diagnostic.pkl")

    stage1_context: Optional[Dict[str, Any]] = None
    if stage1_screening:
        stage1_context = {
            "age": stage1_screening.age,
            "systolic": stage1_screening.systolic,
            "diastolic": stage1_screening.diastolic,
            "bmi": stage1_screening.bmi,
            "hemoglobin": stage1_screening.hemoglobin,
            "pcos": stage1_screening.pcos,
            "previous_complications": stage1_screening.previous_complications,
            "preexisting_diabetes": stage1_screening.preexisting_diabetes,
            "mental_health": stage1_screening.mental_health,
            "sleep_pattern": stage1_screening.sleep_pattern,
        }

    try:
        ml_output = run_selected_stage2_model(
            payload=payload,
            disease=primary_disease,
            stage1_context=stage1_context,
        )
    except Exception as exc:
        logger.error(f"ML logic failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ML logic failed: {exc}",
        )

    # Convert complex lists to dicts for JSONB serialization
    condition_probs = [c.model_dump() for c in ml_output.condition_probabilities]
    cluster_prof = ml_output.cluster_profile.model_dump()

    # DB Persistence
    db_diag = Stage2Diagnostic(
        id=str(uuid_lib.uuid4()),
        patient_id=payload.patient_id,
        specialist_id=current_user.id,
        stage1_screening_id=payload.stage1_screening_id,
        gestational_age_weeks=payload.gestational_age_weeks,
        primary_disease_checked=primary_disease,
        model_used=model_name,
        sflt1_plgf_ratio=payload.sflt1_plgf_ratio,
        plgf_absolute=payload.plgf_absolute,
        papp_a=payload.papp_a,
        cervical_length_mm=payload.cervical_length_mm,
        metabolomics=payload.metabolomics.model_dump() if payload.metabolomics else None,
        doppler=payload.doppler.model_dump() if payload.doppler else None,
        disease_specific_inputs=payload.disease_specific_inputs,
        cluster_profile=cluster_prof,
        condition_probabilities=condition_probs,
        overall_severity_score=ml_output.overall_severity_score,
        dominant_condition=ml_output.dominant_condition.value
    )
    db.add(db_diag)
    db.commit()

    severity = ml_output.overall_severity_score
    urgent = severity >= 0.65
    referral = "Urgent referral to Maternal Fetal Medicine specialist." if urgent else "Monitor closely and follow-up as planned."
    
    return DiagnoseResponse(
        status="success",
        ml_output=ml_output,
        recommended_specialist_referral=referral,
        urgent=urgent,
    )
