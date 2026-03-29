from fastapi import APIRouter, Depends, status, Body
from typing import List, Any
import logging
from sqlalchemy.orm import Session
from datetime import datetime
from pathlib import Path
from functools import lru_cache
import importlib.util
import hashlib
import json
import uuid

from ...core.deps import get_db, get_optional_current_active_user
from ...schemas.screening import TriageInput, BatchedTriageSyncInput, TriageSyncResponse, RiskTier
from ...models.sync_log import SyncQueueLog
from ...models.screening import Stage1Screening
from ...models.user import User
from ...models.patient import Patient

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

@router.post("/sync", status_code=status.HTTP_201_CREATED)
def triage_sync(
    payload_batch: Any = Body(...),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_active_user),
) -> Any:
    responses = []
    is_single = False

    # Normalize single-item payloads or batched payloads
    try:
        if isinstance(payload_batch, dict) and "items" not in payload_batch:
            item = TriageInput.model_validate(payload_batch)
            items = [item]
            is_single = True
        else:
            batch = BatchedTriageSyncInput.model_validate(payload_batch)
            items = batch.items
    except Exception as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    for payload in items:
        payload_dict = payload.model_dump()
        payload_hash = compute_hash(payload_dict)
        
        # Conflict Resolution
        existing_log = db.query(SyncQueueLog).filter(SyncQueueLog.payload_hash == payload_hash).first()
        if existing_log and existing_log.sync_status == "SUCCESS":
            logger.info("Skipping duplicated payload based on hash.")
            # Return a lightweight response for duplicated payloads so callers always receive
            # a consistent response shape (helps tests and idempotent clients).
            responses.append({
                "patient_id": payload.patient_id,
                "encounter_id": payload.encounter_id,
                "server_risk_tier": payload.edge_risk_classification,
                "synced_at": (existing_log.received_at.isoformat() if existing_log.received_at else datetime.utcnow().isoformat()),
                "triage_flags": [],
                "recommended_action": "ESCALATE" if payload.edge_risk_classification == RiskTier.ESCALATE or payload.edge_risk_score >= 0.75 else "Routine",
                "escalation_required": payload.edge_risk_classification == RiskTier.ESCALATE or payload.edge_risk_score >= 0.75,
            })
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
        
        # Save to DB (worker_id optional when unauthenticated)
        screening_id = str(uuid.uuid4())
        # Resolve external patient identifier to internal patient UUID
        patient_obj = db.query(Patient).filter(Patient.national_id == payload.patient_id).first()
        if not patient_obj:
            patient_obj = Patient(national_id=payload.patient_id, full_name=payload.patient_id)
            db.add(patient_obj)
            db.commit()
            db.refresh(patient_obj)
        internal_patient_id = patient_obj.id
        db_screening = Stage1Screening(
            id=screening_id,
            patient_id=internal_patient_id,
            worker_id=(current_user.id if current_user else None),
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

    # If caller provided a single item, return single dict for test compatibility
    if is_single:
        return responses[0] if responses else {}
    return responses
