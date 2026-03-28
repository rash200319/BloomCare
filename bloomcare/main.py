"""
BloomCare – FastAPI Application Entry Point
============================================
Enterprise-grade asynchronous API for the BloomCare Maternal Risk
Intelligence System.

Endpoints
─────────
POST /predict-risk          (v1 legacy – existing frontend)
    Backward-compatible Stage-1 risk prediction.

POST /api/v1/triage/sync
    Receive and persist Stage-1 edge risk classification + vitals synced
    from TFLite / PyTorch Mobile edge devices.

POST /api/v1/diagnose
    Accept Stage-2 biomarker payload → run full data engineering +
    Multi-Condition Phenotyping Engine → return diagnostic probabilities.

POST /api/v1/assistant/explain
    Accept ML output JSON → call OpenAI GenAI assistant → return
    structured multilingual (English / Sinhala / Tamil) explanations.

Supporting
──────────
GET  /                   Root health check
GET  /health             Simple health check (used by Docker / k8s probes)
GET  /api/v1/health      Detailed health check with model registry status
"""

from __future__ import annotations

import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .models import (
    AssistantRequest,
    AssistantResponse,
    DiagnoseInput,
    DiagnoseResponse,
    RiskTier,
    TriageInput,
    TriageSyncResponse,
)
from .ml_services import run_stage2_phenotyping_engine
from .llm_service import generate_mock_explanation, generate_multilingual_explanation

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("bloomcare.api")

# ─────────────────────────────────────────────────────────────────────────────
# Configuration (injected via environment variables)
# ─────────────────────────────────────────────────────────────────────────────

OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL:   str            = os.getenv("BLOOMCARE_OPENAI_MODEL", "gpt-4o")
USE_MOCK_LLM:   bool           = os.getenv("BLOOMCARE_MOCK_LLM", "true").lower() == "true"

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://bloomcare.health",        # production domain
    "https://staging.bloomcare.health",
]

# ─────────────────────────────────────────────────────────────────────────────
# Lifespan (startup / shutdown) – model registry warmup placeholder
# ─────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm up model registry and validate environment on startup."""
    logger.info("=" * 60)
    logger.info("BloomCare API starting up …")
    logger.info("OpenAI model  : %s", OPENAI_MODEL)
    logger.info("Mock LLM mode : %s", USE_MOCK_LLM)
    if not USE_MOCK_LLM and not OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set! LLM endpoint will fail in production mode.")
    logger.info("=" * 60)
    yield
    logger.info("BloomCare API shutting down.")


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI Application
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title          = "BloomCare – Maternal Risk Intelligence API",
    description    = (
        "An AI-powered, EHR-interoperable backend for early detection of "
        "Preeclampsia, Gestational Diabetes, and Preterm Birth. "
        "Designed for frontline maternal healthcare in Sri Lanka."
    ),
    version        = "2.0.0",
    contact        = {
        "name":  "BloomCare Engineering",
        "email": "engineering@bloomcare.health",
    },
    license_info   = {"name": "Proprietary – BloomCare Ltd."},
    docs_url       = "/docs",
    redoc_url      = "/redoc",
    openapi_tags   = [
        {"name": "Health",      "description": "Service health and metadata"},
        {"name": "Triage",      "description": "Stage-1 edge device sync endpoints"},
        {"name": "Diagnose",    "description": "Stage-2 biomarker inference endpoints"},
        {"name": "Assistant",   "description": "GenAI multilingual explanation endpoints"},
    ],
    lifespan       = lifespan,
)

# ─────────────────────────────────────────────────────────────────────────────
# Middleware
# ─────────────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ALLOWED_ORIGINS,
    allow_credentials = True,
    allow_methods     = ["GET", "POST", "OPTIONS"],
    allow_headers     = ["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
# Global Exception Handlers
# ─────────────────────────────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled exception on %s %s: %s", request.method, request.url, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error":   "internal_server_error",
            "message": "An unexpected error occurred. Please contact support.",
            "trace_id": str(uuid.uuid4()),
        },
    )


# ─────────────────────────────────────────────────────────────────────────────
# Health Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"], summary="Root health check")
async def root() -> dict:
    return {
        "service":   "BloomCare Maternal Risk Intelligence API",
        "version":   "2.0.0",
        "status":    "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/health", tags=["Health"], summary="Simple health probe (Docker / k8s)")
async def simple_health() -> dict:
    """Used by container orchestration liveness and readiness probes."""
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/api/v1/health", tags=["Health"], summary="Detailed service health")
async def health_check() -> dict:
    return {
        "status": "healthy",
        "components": {
            "stage1_screener":  "edge-device (TFLite / PyTorch Mobile)",
            "stage2_engine":    "online — sklearn RF + KMeans",
            "llm_service":      "mock" if USE_MOCK_LLM else "openai:" + OPENAI_MODEL,
        },
        "environment": {
            "openai_key_set": bool(OPENAI_API_KEY),
            "mock_llm_mode":  USE_MOCK_LLM,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint 0 — POST /predict-risk  (Legacy – existing Next.js frontend)
# ─────────────────────────────────────────────────────────────────────────────

class _LegacyVitalsInput(BaseModel):
    """
    Extended vitals schema matching the updated frontline-triage-dashboard.tsx.
    Includes new fields: bs (blood sugar), hemoglobin, pcos,
    previous_complications, preexisting_diabetes, mental_health,
    sleep_pattern, exercise, education, map.
    """
    patient_name:          str
    age:                   float
    systolic:              float
    diastolic:             float
    bmi:                   Optional[float] = None
    heart_rate:            float
    bs:                    Optional[float] = None   # blood sugar (mg/dL)
    temperature:           float
    hemoglobin:            Optional[float] = None
    pcos:                  int   = 0
    previous_complications:int   = 0
    preexisting_diabetes:  int   = 0
    mental_health:         int   = 3
    sleep_pattern:         float = 7.0
    exercise:              float = 3.0
    education:             int   = 4
    map:                   Optional[float] = None   # mean arterial pressure


class _LegacyRiskResponse(BaseModel):
    risk_level:      str
    risk_score:      float
    recommendations: List[str]
    bp_status:       str
    observation:     str


@app.post(
    "/predict-risk",
    response_model = _LegacyRiskResponse,
    status_code    = status.HTTP_200_OK,
    tags           = ["Triage"],
    summary        = "Stage-1 risk prediction (legacy endpoint for existing frontend)",
    description    = (
        "Backward-compatible endpoint accepting the extended vitals payload "
        "sent by the frontline-triage-dashboard. Returns a binary risk assessment "
        "with recommendations. Fields not supplied by the old frontend are "
        "optional and default to population medians."
    ),
)
async def predict_risk_legacy(payload: _LegacyVitalsInput) -> _LegacyRiskResponse:
    """
    Rule-based Stage-1 risk estimation for the existing Next.js frontend.

    This keeps the /predict-risk contract alive so the frontend works without
    modification while the richer /api/v1/* endpoints are adopted incrementally.
    """
    import joblib
    from pathlib import Path

    # ── Try loading the pickled Stage-1 screener ─────────────────────────────
    model_path = Path(__file__).parent.parent / "stage1_general_risk_screener.pkl"
    ml_prob: Optional[float] = None

    if model_path.exists():
        try:
            import pandas as pd
            model = joblib.load(model_path)
            features = pd.DataFrame([{
                "Age":        payload.age,
                "Systolic":   payload.systolic,
                "Diastolic":  payload.diastolic,
                "BMI":        payload.bmi or 24.0,
                "HeartRate":  payload.heart_rate,
                "Temperature":payload.temperature,
            }])
            ml_prob = float(model.predict_proba(features)[0][1])
        except Exception as exc:
            logger.warning("Stage-1 model load/predict failed: %s — using rule engine", exc)

    # ── Rule-based risk scoring (always computed as fallback / blending) ──────
    map_val   = payload.map or (payload.systolic + 2 * payload.diastolic) / 3
    bp_score  = 0.0

    if payload.systolic >= 160 or payload.diastolic >= 110:
        bp_score = 0.90
    elif payload.systolic >= 140 or payload.diastolic >= 90:
        bp_score = 0.70
    elif payload.systolic >= 130 or payload.diastolic >= 85:
        bp_score = 0.45
    else:
        bp_score = 0.10

    rule_score = bp_score
    if payload.bmi and payload.bmi >= 30:
        rule_score = min(1.0, rule_score + 0.08)
    if payload.bs and payload.bs >= 140:
        rule_score = min(1.0, rule_score + 0.10)
    if payload.hemoglobin and payload.hemoglobin < 9.0:
        rule_score = min(1.0, rule_score + 0.07)
    if payload.pcos:
        rule_score = min(1.0, rule_score + 0.04)
    if payload.previous_complications:
        rule_score = min(1.0, rule_score + 0.06)
    if payload.preexisting_diabetes:
        rule_score = min(1.0, rule_score + 0.06)
    if payload.sleep_pattern < 5:
        rule_score = min(1.0, rule_score + 0.03)
    if payload.mental_health >= 7:
        rule_score = min(1.0, rule_score + 0.04)

    # Blend ML prob (60%) with rule score (40%) if model is available
    final_score = (
        round(0.6 * ml_prob + 0.4 * rule_score, 4)
        if ml_prob is not None
        else round(rule_score, 4)
    )

    # ── Risk tier ─────────────────────────────────────────────────────────────
    if final_score >= 0.70 or payload.systolic >= 140 or payload.diastolic >= 90:
        risk_level = "high"
    elif final_score >= 0.40 or payload.systolic >= 130 or payload.diastolic >= 85:
        risk_level = "moderate"
    else:
        risk_level = "low"

    # ── BP status ─────────────────────────────────────────────────────────────
    if payload.systolic >= 160 or payload.diastolic >= 110:
        bp_status = "Severe"
    elif payload.systolic >= 140 or payload.diastolic >= 90:
        bp_status = "High"
    elif payload.systolic >= 130 or payload.diastolic >= 85:
        bp_status = "Elevated"
    else:
        bp_status = "Normal"

    # ── Recommendations ───────────────────────────────────────────────────────
    recs: List[str] = []
    if risk_level == "high":
        recs += [
            "Urgent: Repeat BP within 15 minutes",
            "Immediate escalation for Stage-2 specialist review",
            "Capture advanced biomarkers for differential diagnosis",
        ]
        observation = "Requires Immediate Attention"
    elif risk_level == "moderate":
        recs += [
            "Monitor BP every 4 hours",
            "Prepare for Stage-2 diagnostic entry",
            "Schedule specialist consult within 48 hours",
        ]
        observation = "Enhanced Monitoring Required"
    else:
        recs += [
            "Continue routine maternal monitoring",
            "Schedule next screening in 1–2 weeks",
            "Maintain healthy lifestyle as per guideline",
        ]
        observation = "Stable"

    if payload.bmi and payload.bmi >= 30:
        recs.append("BMI ≥ 30 — discuss gestational weight management.")
    if payload.bs and payload.bs >= 140:
        recs.append("Elevated blood sugar — consider OGTT screening for GDM.")
    if payload.hemoglobin and payload.hemoglobin < 10.0:
        recs.append("Haemoglobin low — assess for iron-deficiency anaemia.")

    logger.info(
        "Legacy predict-risk | patient=%s risk=%s score=%.3f",
        payload.patient_name, risk_level, final_score,
    )

    return _LegacyRiskResponse(
        risk_level      = risk_level,
        risk_score      = final_score,
        recommendations = recs,
        bp_status       = bp_status,
        observation     = observation,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint 1 — POST /api/v1/triage/sync
# ─────────────────────────────────────────────────────────────────────────────

@app.post(
    "/api/v1/triage/sync",
    response_model = TriageSyncResponse,
    status_code    = status.HTTP_201_CREATED,
    tags           = ["Triage"],
    summary        = "Sync Stage-1 edge device vitals and risk classification",
    description    = (
        "Called by the BloomCare mobile application (TFLite / PyTorch Mobile) "
        "to sync the on-device MLP risk classification result, raw vitals, and "
        "encounter metadata to the central server. "
        "**Does NOT re-run inference server-side** — it trusts and persists the "
        "edge device's binary classification (Routine Care vs. Escalate)."
    ),
)
async def triage_sync(payload: TriageInput) -> TriageSyncResponse:
    """
    Receive and persist edge-device triage results.

    The lightweight Stage-1 MLP runs entirely on the mobile device (offline-capable).
    This endpoint syncs the result to the central platform for:
      • Audit trail and EHR write-back
      • Escalation routing
      • Cohort analytics
    """
    logger.info(
        "Triage sync | patient=%s encounter=%s classification=%s score=%.3f device=%s",
        payload.patient_id,
        payload.encounter_id,
        payload.edge_risk_classification,
        payload.edge_risk_score,
        payload.device_id,
    )

    # ── Triage flags ──────────────────────────────────────────────────────────
    flags = []
    bp = payload.blood_pressure

    if bp.systolic >= 160 or bp.diastolic >= 110:
        flags.append("SEVERE_HYPERTENSION — BP ≥ 160/110. Immediate clinical review.")
    elif bp.systolic >= 140 or bp.diastolic >= 90:
        flags.append("HYPERTENSION — BP ≥ 140/90. Elevated preeclampsia risk.")

    if payload.bmi and payload.bmi >= 30:
        flags.append("OBESITY — BMI ≥ 30. Increased GDM and PE risk.")

    if payload.heart_rate >= 110:
        flags.append("TACHYCARDIA — HR ≥ 110 bpm. Investigate aetiology.")

    if payload.temperature >= 38.0:
        flags.append("PYREXIA — Temp ≥ 38°C. Screen for infection / sepsis.")

    if payload.gestational_age_weeks < 20 and payload.edge_risk_score >= 0.7:
        flags.append("EARLY HIGH-RISK — Risk score ≥ 0.70 at < 20 weeks gestation.")

    # ── Recommended action ────────────────────────────────────────────────────
    escalation_required = (
        payload.edge_risk_classification == RiskTier.ESCALATE
        or payload.edge_risk_score >= 0.75
        or any("SEVERE" in flag for flag in flags)
    )

    if escalation_required:
        recommended_action = (
            "ESCALATE to hospital-level care immediately. "
            "Proceed to Stage-2 biomarker panel (sFlt-1/PlGF, PAPP-A, Metabolomics, Doppler)."
        )
    else:
        recommended_action = (
            "Continue routine antenatal care. "
            "Repeat triage at next scheduled visit or if symptoms worsen."
        )

    # [In production: persist to PostgreSQL / FHIR R4 server here]
    logger.info(
        "Triage sync complete | patient=%s escalate=%s flags=%d",
        payload.patient_id, escalation_required, len(flags),
    )

    return TriageSyncResponse(
        patient_id            = payload.patient_id,
        encounter_id          = payload.encounter_id,
        server_risk_tier      = payload.edge_risk_classification,
        synced_at             = datetime.now(timezone.utc).isoformat(),
        triage_flags          = flags,
        recommended_action    = recommended_action,
        escalation_required   = escalation_required,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint 2 — POST /api/v1/diagnose
# ─────────────────────────────────────────────────────────────────────────────

@app.post(
    "/api/v1/diagnose",
    response_model = DiagnoseResponse,
    status_code    = status.HTTP_200_OK,
    tags           = ["Diagnose"],
    summary        = "Stage-2 multi-condition phenotyping and biomarker analysis",
    description    = (
        "Accepts a Stage-2 high-risk biomarker panel "
        "(sFlt-1/PlGF ratio, PAPP-A, Metabolomics, Doppler), runs the complete "
        "data engineering pipeline (Winsorization → Cross-Dataset Synthetic Imputation), "
        "executes the Multi-Condition Phenotyping Engine (Weighted K-Means + "
        "class-weighted Random Forest), and returns structured diagnostic probabilities "
        "for Preeclampsia subtypes, GDM, and Preterm Birth."
    ),
)
async def diagnose(payload: DiagnoseInput) -> DiagnoseResponse:
    """
    Execute the Stage-2 multi-condition phenotyping pipeline.

    Processing steps:
        1. Winsorization – clip biomarkers to physiologically valid ranges
        2. Cross-Dataset Synthetic Imputation – RF-based missing value fill
        3. Weighted K-Means clustering – latent patient phenotype assignment
        4. Class-weighted RF classifiers – per-condition probability estimates
        5. Package and return DiagnoseResponse
    """
    logger.info(
        "Diagnosis request | patient=%s encounter=%s GA=%d wks",
        payload.patient_id,
        payload.encounter_id,
        payload.gestational_age_weeks,
    )

    try:
        ml_output = run_stage2_phenotyping_engine(payload)
    except Exception as exc:
        logger.error("Stage-2 engine failure | patient=%s error=%s", payload.patient_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ML inference pipeline failed: {exc}",
        ) from exc

    # ── Specialist referral routing ───────────────────────────────────────────
    severity = ml_output.overall_severity_score
    dominant = ml_output.dominant_condition.value

    if severity >= 0.65:
        referral = "Urgent referral to Maternal-Fetal Medicine (MFM) specialist."
        urgent   = True
    elif severity >= 0.35:
        referral = "Scheduled referral to obstetrician within 48 hours."
        urgent   = False
    else:
        referral = "Continue enhanced antenatal monitoring. Reassess in 1–2 weeks."
        urgent   = False

    logger.info(
        "Diagnosis complete | patient=%s dominant=%s severity=%.3f urgent=%s",
        payload.patient_id, dominant, severity, urgent,
    )

    return DiagnoseResponse(
        status                        = "success",
        ml_output                     = ml_output,
        recommended_specialist_referral = referral,
        urgent                        = urgent,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint 3 — POST /api/v1/assistant/explain
# ─────────────────────────────────────────────────────────────────────────────

@app.post(
    "/api/v1/assistant/explain",
    response_model = AssistantResponse,
    status_code    = status.HTTP_200_OK,
    tags           = ["Assistant"],
    summary        = "GenAI multilingual clinical explanation",
    description    = (
        "Accepts the structured ML output JSON from POST /api/v1/diagnose "
        "and calls the OpenAI GPT-4o API to translate complex risk scores and "
        "cluster profiles into actionable plain-language guidance in "
        "English, Sinhala (සිංහල), and Tamil (தமிழ்). "
        "Set env var `BLOOMCARE_MOCK_LLM=false` and provide `OPENAI_API_KEY` "
        "to use the live OpenAI API."
    ),
)
async def assistant_explain(request: AssistantRequest) -> AssistantResponse:
    """
    Generate multilingual clinical explanations via the GenAI assistant.

    The system prompt enforces:
      • WHO / NICE / RCOG / Sri Lanka MOH guideline alignment
      • Strict separation of risk detection vs. clinical diagnosis
      • Severity-appropriate urgency language
      • Role-appropriate communication (frontline worker / physician / patient)
    """
    logger.info(
        "Assistant explain | patient=%s role=%s mock=%s",
        request.ml_output.patient_id,
        request.requester_role,
        USE_MOCK_LLM,
    )

    try:
        if USE_MOCK_LLM or not OPENAI_API_KEY:
            if not USE_MOCK_LLM:
                logger.warning(
                    "OPENAI_API_KEY not set — falling back to mock explanation."
                )
            result = await generate_mock_explanation(
                ml_output      = request.ml_output,
                requester_role = request.requester_role,
            )
        else:
            result = await generate_multilingual_explanation(
                ml_output      = request.ml_output,
                openai_api_key = OPENAI_API_KEY,
                requester_role = request.requester_role,
                model          = OPENAI_MODEL,
            )
    except RuntimeError as exc:
        logger.error("LLM explanation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return result


# ─────────────────────────────────────────────────────────────────────────────
# Dev Server Entry Point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(
        "bloomcare.main:app",
        host     = "0.0.0.0",
        port     = 8001,
        reload   = True,
        log_level= "info",
    )
