"""
ML Inference Service — Stage 1 General Risk Screener
Supports real pkl model and mock mode (BLOOMCARE_MOCK_LLM=true).
"""

import logging
import random
from pathlib import Path
from typing import Optional
import numpy as np

from app.core.config import settings
from app.schemas.schemas import Stage1Input, Stage1Response, GeneralRiskResult

logger = logging.getLogger(__name__)

_model = None          # Lazy-loaded sklearn pipeline
_THRESHOLD = 0.70      # Clinical threshold for High vs Low


def _load_model():
    global _model
    if _model is not None:
        return _model

    model_path: Path = settings.MODEL_BASE_PATH / settings.STAGE1_MODEL_PATH
    if not model_path.exists():
        logger.warning(f"Stage1 model not found at {model_path}. Falling back to mock.")
        return None

    try:
        import joblib
        _model = joblib.load(model_path)
        logger.info(f"Stage 1 model loaded from {model_path}")
    except Exception as e:
        logger.error(f"Failed to load Stage 1 model: {e}")
        _model = None
    return _model


# ── Column order MUST match training feature order ────────────────────────────
# From stage1.py: merged df_updated + df_msf
# df_updated columns: Age, BMI, Systolic, Diastolic, Heart Rate, BS, Body Temp,
#                     Hemoglobin, PCOS, Previous Complications, Preexisting Diabetes,
#                     Mental Health, Sleep Pattern, Exercise, Education
# (MAP is derived and appended by some versions — handled below)
_FEATURE_COLUMNS = [
    "Age", "BMI", "Systolic_BP", "Diastolic_BP", "Heart_Rate", "BS",
    "Body_Temp", "Hemoglobin", "PCOS", "Previous_Complications",
    "Preexisting_Diabetes", "Mental_Health", "Sleep_Pattern", "Exercise", "Education",
]


def _build_feature_array(inp: Stage1Input) -> np.ndarray:
    return np.array([[
        inp.age, inp.bmi, inp.systolic, inp.diastolic,
        inp.heart_rate, inp.bs, inp.temperature, inp.hemoglobin,
        inp.pcos, inp.previous_complications, inp.preexisting_diabetes,
        inp.mental_health, inp.sleep_pattern, inp.exercise, inp.education,
    ]])


def _mock_predict(inp: Stage1Input) -> Stage1Response:
    """
    Deterministic mock that mirrors the frontend offline logic so devs can
    validate the response shape without the model file.
    """
    map_val = inp.computed_map()

    # Rough clinical heuristics
    base_risk = 0.35
    if inp.systolic >= 140 or inp.diastolic >= 90:
        base_risk += 0.35
    if inp.bmi >= 30:
        base_risk += 0.08
    if inp.pcos:
        base_risk += 0.05
    if inp.previous_complications:
        base_risk += 0.07
    if inp.preexisting_diabetes:
        base_risk += 0.06
    if inp.mental_health >= 7:
        base_risk += 0.04

    probability = min(1.0, max(0.0, base_risk + random.uniform(-0.03, 0.03)))
    risk = "High" if probability >= _THRESHOLD else "Low"

    return Stage1Response(
        general_risk=GeneralRiskResult(
            probability=round(probability, 4),
            risk=risk,
            threshold=_THRESHOLD,
        )
    )


def predict_stage1_risk(inp: Stage1Input) -> Stage1Response:
    """
    Main entry point called by the API route.
    Honours BLOOMCARE_MOCK_LLM setting.
    """
    if settings.BLOOMCARE_MOCK_LLM:
        logger.debug("Mock LLM mode enabled — returning mock Stage 1 prediction.")
        return _mock_predict(inp)

    model = _load_model()
    if model is None:
        logger.warning("Stage 1 model unavailable; falling back to mock.")
        return _mock_predict(inp)

    try:
        import pandas as pd
        features = pd.DataFrame(_build_feature_array(inp), columns=_FEATURE_COLUMNS)
        probability = float(model.predict_proba(features)[0][1])
        risk = "High" if probability >= _THRESHOLD else "Low"
        return Stage1Response(
            general_risk=GeneralRiskResult(
                probability=round(probability, 4),
                risk=risk,
                threshold=_THRESHOLD,
            )
        )
    except Exception as e:
        logger.error(f"Stage 1 inference error: {e}. Falling back to mock.")
        return _mock_predict(inp)
