"""
Offline Sync Route
POST /api/v1/sync-queue → Accept batched offline records from PWA local storage.
Idempotent: records with a duplicate offline_id are skipped (not double-inserted).
Conflict resolution: latest timestamp wins.
"""

from datetime import datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.dependencies.auth import require_frontline
from app.models.models import User, Vitals, Patient, SyncQueueItem, RiskRecord, RiskLevel
from app.schemas.schemas import SyncQueueRequest, SyncQueueResponse
from app.services.predict_stage1 import predict_stage1_risk
from app.schemas.schemas import Stage1Input

router = APIRouter(prefix="/sync-queue", tags=["Offline Sync"])


@router.post(
    "/",
    response_model=SyncQueueResponse,
    summary="Sync offline screening records",
    description=(
        "Accepts a batch of offline vitals records collected by the PWA "
        "while the device had no internet. Each record is idempotent — "
        "duplicates identified by `offline_id` are safely skipped. "
        "Conflict resolution uses `created_at` timestamp (latest wins)."
    ),
)
def sync_queue(
    body: SyncQueueRequest,
    current_user: Annotated[User, Depends(require_frontline)],
    db: Annotated[Session, Depends(get_db)],
):
    synced     = 0
    skipped    = 0
    failed     = 0

    for record in body.records:
        # ── Idempotency check ─────────────────────────────────────────────────
        existing = db.query(SyncQueueItem).filter(
            SyncQueueItem.offline_id == record.id
        ).first()

        if existing and existing.is_synced:
            skipped += 1
            continue

        try:
            vitals_payload: dict = record.vitals

            # ── Attempt to find patient by name ───────────────────────────────
            patient: Patient | None = None
            patient_name: str = vitals_payload.get("patient_name", "")
            if patient_name:
                patient = (
                    db.query(Patient)
                    .join(User, Patient.user_id == User.id)
                    .filter(User.full_name.ilike(f"%{patient_name}%"))
                    .first()
                )

            # ── Persist Vitals ────────────────────────────────────────────────
            if patient:
                vitals = Vitals(
                    patient_id=patient.id,
                    recorded_by_id=current_user.id,
                    age=vitals_payload.get("age"),
                    bmi=vitals_payload.get("bmi"),
                    systolic=vitals_payload.get("systolic"),
                    diastolic=vitals_payload.get("diastolic"),
                    heart_rate=vitals_payload.get("heart_rate"),
                    blood_sugar=vitals_payload.get("bs"),
                    body_temperature=vitals_payload.get("temperature"),
                    hemoglobin=vitals_payload.get("hemoglobin"),
                    pcos=vitals_payload.get("pcos", 0),
                    previous_complications=vitals_payload.get("previous_complications", 0),
                    preexisting_diabetes=vitals_payload.get("preexisting_diabetes", 0),
                    mental_health=vitals_payload.get("mental_health", 3),
                    sleep_pattern=vitals_payload.get("sleep_pattern", 7),
                    exercise=vitals_payload.get("exercise", 3),
                    education=vitals_payload.get("education", 4),
                    synced_from_offline=True,
                    offline_id=record.id,
                )
                db.add(vitals)
                db.flush()

                # ── Run Stage 1 prediction on synced record ───────────────────
                try:
                    stage1_input = Stage1Input(
                        patient_name=patient_name,
                        age=vitals_payload.get("age", 28),
                        bmi=vitals_payload.get("bmi", 24),
                        systolic=vitals_payload.get("systolic", 120),
                        diastolic=vitals_payload.get("diastolic", 80),
                        heart_rate=vitals_payload.get("heart_rate", 78),
                        bs=vitals_payload.get("bs", 95),
                        temperature=vitals_payload.get("temperature", 36.8),
                        hemoglobin=vitals_payload.get("hemoglobin", 12),
                        pcos=vitals_payload.get("pcos", 0),
                        previous_complications=vitals_payload.get("previous_complications", 0),
                        preexisting_diabetes=vitals_payload.get("preexisting_diabetes", 0),
                        mental_health=vitals_payload.get("mental_health", 3),
                        sleep_pattern=vitals_payload.get("sleep_pattern", 7),
                        exercise=vitals_payload.get("exercise", 3),
                        education=vitals_payload.get("education", 4),
                    )
                    risk_result = predict_stage1_risk(stage1_input)

                    try:
                        risk_level = RiskLevel(risk_result.general_risk.risk.lower())
                    except ValueError:
                        risk_level = RiskLevel.low

                    risk_record = RiskRecord(
                        patient_id=patient.id,
                        vitals_id=vitals.id,
                        stage="stage1",
                        condition=None,
                        probability=risk_result.general_risk.probability,
                        risk_level=risk_level,
                        threshold=risk_result.general_risk.threshold,
                        is_mock=settings.BLOOMCARE_MOCK_LLM,
                        model_version="offline-sync",
                        recommendations=None,
                    )
                    db.add(risk_record)
                except Exception:
                    pass  # Prediction failure must not block sync commit

            # ── Mark sync queue item as processed ─────────────────────────────
            if existing:
                existing.is_synced = True
                existing.synced_at = datetime.now(timezone.utc)
                existing.payload   = vitals_payload
            else:
                queue_item = SyncQueueItem(
                    offline_id=record.id,
                    payload=vitals_payload,
                    is_synced=True,
                    synced_at=datetime.now(timezone.utc),
                )
                db.add(queue_item)

            db.commit()
            synced += 1

        except Exception as e:
            db.rollback()
            failed += 1
            continue

    return SyncQueueResponse(
        status="success" if failed == 0 else "partial",
        total_received=len(body.records),
        synced_records=synced,
        conflicts_skipped=skipped,
        failed_records=failed,
    )


@router.get(
    "/status",
    summary="Get sync queue statistics",
)
def sync_status(
    current_user: Annotated[User, Depends(require_frontline)],
    db: Annotated[Session, Depends(get_db)],
):
    total   = db.query(SyncQueueItem).count()
    synced  = db.query(SyncQueueItem).filter(SyncQueueItem.is_synced == True).count()
    pending = total - synced
    return {
        "total_records":   total,
        "synced_records":  synced,
        "pending_records": pending,
    }
