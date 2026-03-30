from fastapi import APIRouter, Depends, Query, status
from typing import List, Any
import logging
from sqlalchemy.orm import Session
from datetime import datetime
import hashlib
import json
import uuid

from core.deps import get_db, get_current_active_user
from schemas.screening import BatchedTriageSyncInput, TriageSyncResponse, RiskTier
from models.sync_log import SyncQueueLog
from models.screening import PatientReport, Stage1Screening
from models.patient import Patient as DBPatient
from models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


def _role_name(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)

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

        escalation_required = payload.edge_risk_classification == RiskTier.ESCALATE
        
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
            contributing_factors=None,
            stage2_priority=None,
            device_id=payload.device_id,
            collected_at=coll_at
        )
        db.add(db_screening)

        report_title = f"Stage 1 Screening Report - {coll_at.date().isoformat()}"
        db_report = PatientReport(
            id=str(uuid.uuid4()),
            patient_id=payload.patient_id,
            stage1_screening_id=screening_id,
            stage2_diagnostic_id=None,
            report_type="stage1",
            report_title=report_title,
            content_type="json",
            report_content={
                "screening_id": screening_id,
                "encounter_id": payload.encounter_id,
                "collected_at": coll_at.isoformat(),
                "edge_risk_classification": payload.edge_risk_classification.value,
                "edge_risk_score": payload.edge_risk_score,
                "vitals": {
                    "systolic": payload.blood_pressure.systolic,
                    "diastolic": payload.blood_pressure.diastolic,
                    "heart_rate": payload.heart_rate,
                    "temperature": payload.temperature,
                    "blood_sugar": payload.blood_sugar,
                    "hemoglobin": payload.hemoglobin,
                },
                "risk_source": "stage1_offline_ai.js",
            },
            generated_by=current_user.id,
        )
        db.add(db_report)
        
        # Logging sync
        db_log = SyncQueueLog(
            device_id=payload.device_id,
            payload_hash=payload_hash,
            sync_status="SUCCESS"
        )
        db.add(db_log)
        db.commit()

        responses.append({
            "screening_id": screening_id,
            "patient_id": payload.patient_id,
            "encounter_id": payload.encounter_id,
            "server_risk_tier": payload.edge_risk_classification,
            "synced_at": datetime.utcnow().isoformat(),
            "triage_flags": [],
            "recommended_action": "ESCALATE" if escalation_required else "Routine",
            "escalation_required": escalation_required,
            "stage2_priority": None,
        })
        
    return responses


@router.get("/history")
def stage1_history(
    patient_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Return Stage 1 screening history with patient context for web dashboard views."""
    rows = (
        db.query(Stage1Screening, DBPatient)
        .outerjoin(DBPatient, Stage1Screening.patient_id == DBPatient.id)
    )

    role = _role_name(current_user)
    if role in ["ADMIN", "CLINICAL_SPECIALIST"]:
        if patient_id:
            rows = rows.filter(Stage1Screening.patient_id == patient_id)
    elif role == "FRONTLINE_STAFF":
        rows = rows.filter(Stage1Screening.worker_id == current_user.id)
        if patient_id:
            rows = rows.filter(Stage1Screening.patient_id == patient_id)
    else:
        rows = rows.filter(Stage1Screening.patient_id == current_user.id)

    entries = (
        rows.order_by(Stage1Screening.collected_at.desc(), Stage1Screening.synced_at.desc())
        .limit(limit)
        .all()
    )

    response_rows = []
    for screening, patient in entries:
        risk_raw = screening.edge_risk_classification
        risk_value = risk_raw.value if hasattr(risk_raw, "value") else (str(risk_raw) if risk_raw is not None else None)

        response_rows.append(
            {
                "screening_id": screening.id,
                "patient_id": screening.patient_id,
                "patient_name": patient.full_name if patient else None,
                "collected_at": screening.collected_at.isoformat() if screening.collected_at else None,
                "systolic": screening.systolic,
                "diastolic": screening.diastolic,
                "heart_rate": screening.heart_rate,
                "temperature": float(screening.temperature) if screening.temperature is not None else None,
                "blood_sugar": float(screening.Blood_sugar) if screening.Blood_sugar is not None else None,
                "edge_risk_score": float(screening.edge_risk_score) if screening.edge_risk_score is not None else 0.0,
                "edge_risk_classification": risk_value,
                "risk_label": (
                    "high"
                    if risk_value == RiskTier.ESCALATE.value
                    else (
                        "high"
                        if (float(screening.edge_risk_score) if screening.edge_risk_score is not None else 0.0) >= 0.75
                        else "moderate"
                        if (float(screening.edge_risk_score) if screening.edge_risk_score is not None else 0.0) >= 0.4
                        else "low"
                    )
                ),
            }
        )

    return response_rows
