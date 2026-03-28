from fastapi import APIRouter, Depends, status
from typing import List, Any
import logging
from sqlalchemy.orm import Session
from datetime import datetime
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

def compute_hash(payload: dict) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()

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
            edge_risk_classification=payload.edge_risk_classification,
            edge_risk_score=payload.edge_risk_score,
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
            "escalation_required": escalation_required
        })
        
    return responses
