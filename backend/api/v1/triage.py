from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Any, Dict
import logging
from sqlalchemy.orm import Session
from datetime import datetime
from pathlib import Path
from functools import lru_cache
import importlib.util
import hashlib
import json
import uuid

from core.deps import get_db, get_current_active_user
from schemas.screening import TriageInput, BatchedTriageSyncInput, TriageSyncResponse, RiskTier
from models.sync_log import SyncQueueLog
from models.screening import Stage1Screening
from models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


@lru_cache(maxsize=1)
def _get_stage1_predictor():
    """Load Stage1 predictor from repository-level models/stage1.py once."""
    project_root = Path(__file__).resolve().parents[3]
    stage1_module_path = project_root / "models" / "stage1.py"

    spec = importlib.util.spec_from_file_location("bloomcare_stage1_model", stage1_module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load Stage1 module from {stage1_module_path}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    predictor = getattr(module, "predict_stage1_risk", None)
    if predictor is None:
        raise RuntimeError("predict_stage1_risk was not found in models/stage1.py")

    return predictor

def compute_hash(payload: dict) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


@router.post("/predict/stage1")
def predict_stage1(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Run Stage1 model inference and return the full model response, including triggers."""
    try:
        predictor = _get_stage1_predictor()
        return predictor(payload)
    except Exception as exc:
        logger.exception("Stage1 prediction failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


def _calculate_contributing_factors(payload: TriageInput) -> Dict[str, float]:
    """
    Calculate which factors contributed most to the high risk score.
    Returns normalized importance scores for each risk factor.
    """
    factors = {}
    
    # Systolic BP contribution
    if payload.blood_pressure.systolic >= 160:
        factors["severe_hypertension"] = 0.25
    elif payload.blood_pressure.systolic >= 140:
        factors["hypertension"] = 0.20
    
    # BMI contribution
    if payload.bmi:
        if payload.bmi >= 30:
            factors["obesity"] = 0.20
        elif payload.bmi >= 25:
            factors["overweight"] = 0.10
    
    # Age contribution (advanced maternal age)
    if payload.age and payload.age >= 35:
        factors["advanced_maternal_age"] = 0.15
    
    # Blood sugar contribution
    if payload.blood_sugar and payload.blood_sugar > 6.0:
        factors["elevated_blood_sugar"] = 0.15
    
    # Hemoglobin contribution
    if payload.hemoglobin:
        if payload.hemoglobin < 10.5:
            factors["anemia"] = 0.10
        elif payload.hemoglobin > 13:
            factors["high_hemoglobin"] = 0.08
    
    # Pre-existing conditions
    if payload.preexisting_diabetes:
        factors["preexisting_diabetes"] = 0.20
    
    if payload.pcos:
        factors["pcos"] = 0.12
    
    if payload.previous_complications:
        factors["previous_obstetric_complications"] = 0.18
    
    # Mental health
    if payload.mental_health and payload.mental_health > 5:
        factors["mental_health_concerns"] = 0.08
    
    # Normalize to sum to 1.0 if factors exist
    if factors:
        total = sum(factors.values())
        factors = {k: round(v / total, 3) for k, v in factors.items()}
    
    return factors


def _build_stage2_priority(payload: TriageInput, factors: Dict[str, float]) -> Dict[str, Any]:
    """Create disease-priority scores from Stage 1 findings for doctor-facing Stage 2 routing."""
    scores = {
        "preeclampsia": 0.0,
        "gdm": 0.0,
        "preterm": 0.0,
    }
    reasons: List[str] = []

    bp = payload.blood_pressure
    if bp.systolic >= 140 or bp.diastolic >= 90:
        scores["preeclampsia"] += 0.35
        reasons.append("Elevated blood pressure increases preeclampsia concern.")
    if bp.systolic >= 160 or bp.diastolic >= 110:
        scores["preeclampsia"] += 0.20
        reasons.append("Severe hypertension strongly raises preeclampsia risk.")

    if payload.blood_sugar is not None and payload.blood_sugar > 6.0:
        scores["gdm"] += 0.35
        reasons.append("Raised blood sugar suggests gestational diabetes risk.")
    if payload.preexisting_diabetes:
        scores["gdm"] += 0.25
        reasons.append("Preexisting diabetes increases gestational glycaemic risk.")
    if payload.bmi is not None and payload.bmi >= 30:
        scores["gdm"] += 0.15
        scores["preeclampsia"] += 0.10
        reasons.append("Obesity contributes to both GDM and hypertensive pregnancy risk.")

    if payload.previous_complications:
        scores["preterm"] += 0.25
        scores["preeclampsia"] += 0.10
        reasons.append("Previous complications increase preterm and hypertensive risk.")
    if payload.age >= 35:
        scores["preterm"] += 0.10
        scores["preeclampsia"] += 0.10
        reasons.append("Advanced maternal age raises obstetric risk.")
    if payload.hemoglobin is not None and payload.hemoglobin < 10.5:
        scores["preterm"] += 0.15
        reasons.append("Anemia can be associated with preterm delivery risk.")

    # Incorporate model contribution hints so doctor sees transparent rationale.
    if factors.get("hypertension") or factors.get("severe_hypertension"):
        scores["preeclampsia"] += 0.08
    if factors.get("elevated_blood_sugar"):
        scores["gdm"] += 0.08
    if factors.get("previous_obstetric_complications"):
        scores["preterm"] += 0.08

    # Clamp and rank.
    scores = {k: round(min(v, 1.0), 3) for k, v in scores.items()}
    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    recommended_primary = ranked[0][0]

    return {
        "recommended_primary_disease": recommended_primary,
        "scores": scores,
        "ranked_diseases": [name for name, _ in ranked],
        "reasons": reasons,
    }

@router.post("/sync", response_model=List[TriageSyncResponse], status_code=status.HTTP_201_CREATED)
def triage_sync(
    payload_batch: BatchedTriageSyncInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    responses = []
    
    for payload in payload_batch.items:
        payload_dict = payload.model_dump()
        payload_hash = compute_hash(payload_dict)
        
        # Conflict Resolution
        existing_log = db.query(SyncQueueLog).filter(SyncQueueLog.payload_hash == payload_hash).first()
        if existing_log and existing_log.sync_status == "SUCCESS":
            logger.info("Skipping duplicated payload based on hash.")
            continue
            
        # Parse Dates
        try:
            coll_at = datetime.fromisoformat(payload.collected_at) if payload.collected_at else datetime.utcnow()
        except Exception:
            coll_at = datetime.utcnow()

        # Flags and Logic
        flags = []
        bp = payload.blood_pressure
        if bp.systolic >= 160 or bp.diastolic >= 110:
            flags.append("SEVERE_HYPERTENSION")
        elif bp.systolic >= 140 or bp.diastolic >= 90:
            flags.append("HYPERTENSION")

        if payload.bmi and payload.bmi >= 30:
            flags.append("OBESITY")

        escalation_required = (
            payload.edge_risk_classification == RiskTier.ESCALATE
            or payload.edge_risk_score >= 0.75
            or any("SEVERE" in flag for flag in flags)
        )
        
        # Calculate contributing factors based on vitals
        # This shows which factors led to high risk
        contributing_factors = _calculate_contributing_factors(payload)
        stage2_priority = _build_stage2_priority(payload, contributing_factors)
        
        # Save to DB
        screening_id = str(uuid.uuid4())
        db_screening = Stage1Screening(
            id=screening_id,
            patient_id=payload.patient_id,
            worker_id=current_user.id,
            encounter_id=payload.encounter_id,
            gestational_age_weeks=payload.gestational_age_weeks,
            age=payload.age,
            systolic=payload.blood_pressure.systolic,
            diastolic=payload.blood_pressure.diastolic,
            bmi=payload.bmi,
            heart_rate=payload.heart_rate,
            temperature=payload.temperature,
            Blood_sugar=payload.blood_sugar,
            hemoglobin=payload.hemoglobin,
            pcos=payload.pcos,
            previous_complications=payload.previous_complications,
            preexisting_diabetes=payload.preexisting_diabetes,
            mental_health=payload.mental_health,
            sleep_pattern=payload.sleep_pattern,
            exercise=payload.exercise,
            education=payload.education,
            edge_risk_classification=payload.edge_risk_classification,
            edge_risk_score=payload.edge_risk_score,
            contributing_factors=contributing_factors,
            stage2_priority=stage2_priority,
            device_id=payload.device_id,
            collected_at=coll_at
        )
        db.add(db_screening)
        
        # Logging sync
        db_log = SyncQueueLog(
            device_id=payload.device_id,
            payload_hash=payload_hash,
            sync_status="SUCCESS"
        )
        db.add(db_log)
        db.commit()

        responses.append({
            "patient_id": payload.patient_id,
            "encounter_id": payload.encounter_id,
            "server_risk_tier": payload.edge_risk_classification,
            "synced_at": datetime.utcnow().isoformat(),
            "triage_flags": flags,
            "recommended_action": "ESCALATE" if escalation_required else "Routine",
            "escalation_required": escalation_required,
            "stage2_priority": stage2_priority if escalation_required else None,
        })
        
    return responses
