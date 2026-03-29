"""
Prediction Routes
POST /api/v1/stage1/predict           → Stage 1 general risk screening
POST /api/v1/stage2/preeclampsia      → Stage 2 preeclampsia (requires Stage 1 High)
POST /api/v1/stage2/gdm               → Stage 2 GDM
POST /api/v1/stage2/preterm           → Stage 2 preterm birth
"""

from datetime import datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.dependencies.auth import get_current_user, require_frontline, require_doctor
from app.models.models import User, RiskRecord, RiskLevel, Patient
from app.schemas.schemas import (
    Stage1Input, Stage1Response,
    Stage2PreeclampsiaInput, Stage2GDMInput, Stage2PretermInput,
    Stage2Response
)
from app.services.predict_stage1 import predict_stage1_risk
from app.services.predict_stage2 import predict_preeclampsia, predict_gdm, predict_preterm

router = APIRouter(tags=["Predictions"])


# ── Helper: persist risk record ───────────────────────────────────────────────
def _save_risk_record(
    db: Session,
    patient_id: int,
    stage: str,
    condition: str | None,
    probability: float,
    risk_level_str: str,
    is_mock: bool,
):
    try:
        risk_level = RiskLevel(risk_level_str.lower())
    except ValueError:
        risk_level = RiskLevel.low

    record = RiskRecord(
        patient_id=patient_id,
        stage=stage,
        condition=condition,
        probability=probability,
        risk_level=risk_level,
        threshold=settings.BLOOMCARE_MOCK_LLM and 0.70 or 0.70,
        is_mock=is_mock,
        model_version="mock-1.0" if is_mock else "rf-2.1",
    )
    db.add(record)
    db.commit()


# ── Stage 1 ───────────────────────────────────────────────────────────────────
@router.post(
    "/stage1/predict",
    response_model=Stage1Response,
    summary="Stage 1 General Risk Screening",
    description=(
        "Runs the primary maternal risk screener on vital sign inputs. "
        "Supports offline-sync header `X-Offline-Sync: true`. "
        "Authenticated frontline staff or doctors only."
    ),
)
def stage1_predict(
    body: Stage1Input,
    current_user: Annotated[User, Depends(require_frontline)],
    db: Annotated[Session, Depends(get_db)],
    x_offline_sync: Annotated[str | None, Header()] = None,
):
    result = predict_stage1_risk(body)

    # Attempt to persist — find patient by name (best-effort, non-blocking)
    try:
        patient = (
            db.query(Patient)
            .join(User, Patient.user_id == User.id)
            .filter(User.full_name.ilike(f"%{body.patient_name}%"))
            .first()
        )
        if patient:
            _save_risk_record(
                db,
                patient_id=patient.id,
                stage="stage1",
                condition=None,
                probability=result.general_risk.probability,
                risk_level_str=result.general_risk.risk,
                is_mock=settings.BLOOMCARE_MOCK_LLM,
            )
    except Exception:
        pass  # Non-blocking – prediction must still return

    return result


# ── Stage 2: Preeclampsia ──────────────────────────────────────────────────────
@router.post(
    "/stage2/preeclampsia",
    response_model=Stage2Response,
    summary="Stage 2 Preeclampsia Diagnostic",
    description="Deep preeclampsia risk analysis. Should only be triggered for Stage 1 High-Risk patients.",
)
def stage2_preeclampsia(
    body: Stage2PreeclampsiaInput,
    current_user: Annotated[User, Depends(require_doctor)],
    db: Annotated[Session, Depends(get_db)],
):
    return predict_preeclampsia(body)


# ── Stage 2: GDM ──────────────────────────────────────────────────────────────
@router.post(
    "/stage2/gdm",
    response_model=Stage2Response,
    summary="Stage 2 Gestational Diabetes (GDM) Diagnostic",
)
def stage2_gdm(
    body: Stage2GDMInput,
    current_user: Annotated[User, Depends(require_doctor)],
    db: Annotated[Session, Depends(get_db)],
):
    return predict_gdm(body)


# ── Stage 2: Preterm ──────────────────────────────────────────────────────────
@router.post(
    "/stage2/preterm",
    response_model=Stage2Response,
    summary="Stage 2 Preterm Birth Diagnostic",
)
def stage2_preterm(
    body: Stage2PretermInput,
    current_user: Annotated[User, Depends(require_doctor)],
    db: Annotated[Session, Depends(get_db)],
):
    return predict_preterm(body)
