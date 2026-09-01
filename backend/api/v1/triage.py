from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Any
import logging
from sqlalchemy import String, cast
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import hashlib
import json
import uuid

from backend.core.deps import get_db, get_current_active_user, can_access_patient, ensure_patient_access
from backend.schemas.screening import BatchedTriageSyncInput, TriageSyncResponse, RiskTier
from backend.models.sync_log import SyncQueueLog
from backend.models.screening import PatientReport, Stage1Screening
from backend.models.patient import Patient as DBPatient
from backend.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


def _role_name(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def compute_hash(payload: dict) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def _is_valid_uuid(value: str) -> bool:
    try:
        uuid.UUID(str(value))
        return True
    except (TypeError, ValueError):
        return False


def _upsert_sync_log(
    db: Session,
    *,
    existing_log: SyncQueueLog | None,
    device_id: str | None,
    payload_hash: str,
    sync_status: str,
    error_message: str | None = None,
) -> None:
    if existing_log:
        existing_log.device_id = device_id
        existing_log.sync_status = sync_status
        existing_log.error_message = error_message
        db.commit()
        return

    db_log = SyncQueueLog(
        device_id=device_id,
        payload_hash=payload_hash,
        sync_status=sync_status,
        error_message=error_message,
    )
    db.add(db_log)
    db.commit()


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
        existing_log = db.query(SyncQueueLog).filter(
            SyncQueueLog.payload_hash == payload_hash).first()
        if existing_log and existing_log.sync_status == "SUCCESS":
            logger.info("Skipping duplicated payload based on hash.")
            continue

        patient_id = str(payload.patient_id).strip()
        if not _is_valid_uuid(patient_id):
            error_message = f"Invalid patient_id for sync: {payload.patient_id}"
            logger.warning(error_message)
            _upsert_sync_log(
                db,
                existing_log=existing_log,
                device_id=payload.device_id,
                payload_hash=payload_hash,
                sync_status="FAILED",
                error_message=error_message,
            )
            continue

        patient = db.query(DBPatient).filter(cast(DBPatient.id, String) == patient_id).first()
        if not patient:
            error_message = f"Patient not found for sync patient_id: {patient_id}"
            logger.warning(error_message)
            _upsert_sync_log(
                db,
                existing_log=existing_log,
                device_id=payload.device_id,
                payload_hash=payload_hash,
                sync_status="FAILED",
                error_message=error_message,
            )
            continue

        if not can_access_patient(db, current_user, patient_id):
            error_message = f"Not authorized to sync triage for patient_id: {patient_id}"
            logger.warning(error_message)
            _upsert_sync_log(
                db,
                existing_log=existing_log,
                device_id=payload.device_id,
                payload_hash=payload_hash,
                sync_status="FAILED",
                error_message=error_message,
            )
            continue

        # Parse Dates
        try:
            coll_at = datetime.fromisoformat(
                payload.collected_at) if payload.collected_at else datetime.utcnow()
        except Exception:
            coll_at = datetime.utcnow()

        escalation_required = payload.edge_risk_classification == RiskTier.ESCALATE

        # Save to DB
        screening_id = str(uuid.uuid4())
        db_screening = Stage1Screening(
            id=screening_id,
            patient_id=patient_id,
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
            patient_id=patient_id,
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

        try:
            db.commit()
            _upsert_sync_log(
                db,
                existing_log=existing_log,
                device_id=payload.device_id,
                payload_hash=payload_hash,
                sync_status="SUCCESS",
                error_message=None,
            )
        except IntegrityError as exc:
            db.rollback()
            error_message = f"Failed to persist triage sync payload: {exc.orig}"
            logger.error(error_message)
            _upsert_sync_log(
                db,
                existing_log=existing_log,
                device_id=payload.device_id,
                payload_hash=payload_hash,
                sync_status="FAILED",
                error_message=error_message,
            )
            continue

        responses.append({
            "screening_id": screening_id,
            "patient_id": patient_id,
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
    if patient_id:
        ensure_patient_access(
            db, current_user, str(patient_id), action="triage.history"
        )

    if role in ["ADMIN", "CLINICAL_SPECIALIST"]:
        if patient_id:
            rows = rows.filter(
                cast(Stage1Screening.patient_id, String) == str(patient_id))
    elif role == "FRONTLINE_STAFF":
        rows = rows.filter(cast(Stage1Screening.worker_id,
                           String) == str(current_user.id))
        if patient_id:
            rows = rows.filter(
                cast(Stage1Screening.patient_id, String) == str(patient_id))
    else:
        rows = rows.filter(cast(Stage1Screening.patient_id,
                           String) == str(current_user.id))

    entries = (
        rows.order_by(Stage1Screening.collected_at.desc(),
                      Stage1Screening.synced_at.desc())
        .limit(limit)
        .all()
    )

    response_rows = []
    for screening, patient in entries:
        risk_raw = screening.edge_risk_classification
        risk_value = risk_raw.value if hasattr(risk_raw, "value") else (
            str(risk_raw) if risk_raw is not None else None)

        response_rows.append(
            {
                "screening_id": screening.id,
                "patient_id": screening.patient_id,
                "patient_name": patient.full_name if patient else None,
                "collected_at": screening.collected_at.isoformat() if screening.collected_at else None,
                "gestational_age_weeks": screening.gestational_age_weeks,
                "systolic": screening.systolic,
                "diastolic": screening.diastolic,
                "heart_rate": screening.heart_rate,
                "temperature": float(screening.temperature) if screening.temperature is not None else None,
                "blood_sugar": float(screening.Blood_sugar) if screening.Blood_sugar is not None else None,
                "edge_risk_score": float(screening.edge_risk_score) if screening.edge_risk_score is not None else 0.0,
                "edge_risk_classification": risk_value,
                "reviewed_at": screening.reviewed_at.isoformat() if getattr(screening, "reviewed_at", None) else None,
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


def _mark_screening_reviewed(
    db: Session,
    screening: Stage1Screening,
) -> str:
    now = datetime.now(timezone.utc)
    screening_id = str(screening.id)
    try:
        updated = (
            db.query(Stage1Screening)
            .filter(cast(Stage1Screening.id, String) == screening_id)
            .update({"reviewed_at": now}, synchronize_session="fetch")
        )
        if updated != 1:
            raise HTTPException(status_code=404, detail="Screening not found")
        db.commit()
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Unable to save review status: {exc}",
        ) from exc
    return now.isoformat()


@router.post("/patients/{patient_id}/review")
def mark_patient_screening_reviewed(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Mark the latest Stage 1 screening for a patient as reviewed."""
    role = _role_name(current_user)
    if role not in ["ADMIN", "CLINICAL_SPECIALIST", "DOCTOR"]:
        raise HTTPException(status_code=403, detail="Not authorized to mark screenings reviewed")

    ensure_patient_access(db, current_user, str(patient_id), action="triage.review")

    screening = (
        db.query(Stage1Screening)
        .filter(cast(Stage1Screening.patient_id, String) == str(patient_id))
        .order_by(Stage1Screening.collected_at.desc(), Stage1Screening.synced_at.desc())
        .first()
    )
    if not screening:
        raise HTTPException(status_code=404, detail="No screening found for this patient")

    reviewed_at = _mark_screening_reviewed(db, screening)
    return {
        "screening_id": str(screening.id),
        "patient_id": str(patient_id),
        "reviewed_at": reviewed_at,
        "status": "completed",
    }


@router.post("/{screening_id}/review")
def mark_screening_reviewed(
    screening_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Persist specialist review so Completed survives refresh."""
    role = _role_name(current_user)
    if role not in ["ADMIN", "CLINICAL_SPECIALIST", "DOCTOR"]:
        raise HTTPException(status_code=403, detail="Not authorized to mark screenings reviewed")

    screening = db.query(Stage1Screening).filter(
        cast(Stage1Screening.id, String) == str(screening_id)
    ).first()
    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")

    if screening.patient_id:
        ensure_patient_access(
            db, current_user, str(screening.patient_id), action="triage.review"
        )

    reviewed_at = _mark_screening_reviewed(db, screening)
    return {
        "screening_id": screening_id,
        "reviewed_at": reviewed_at,
        "status": "completed",
    }
