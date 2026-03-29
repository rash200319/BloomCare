"""
ML Inference Service — Stage 2 Diagnostic Models
Preeclampsia | GDM | Preterm Birth
"""

import logging
import random
from pathlib import Path
from typing import Literal

from app.core.config import settings
from app.schemas.schemas import (
    Stage2PreeclampsiaInput, Stage2GDMInput,
    Stage2PretermInput, Stage2Response
)

logger = logging.getLogger(__name__)

_THRESHOLD_PREECLAMPSIA = 0.55
_THRESHOLD_GDM          = 0.55
_THRESHOLD_PRETERM       = 0.55

# ── Lazy model cache ──────────────────────────────────────────────────────────
_models: dict = {}


def _load(key: str, path_str: str):
    if key in _models:
        return _models[key]
    path = settings.MODEL_BASE_PATH / path_str
    if not path.exists():
        logger.warning(f"{key} model not found at {path}.")
        _models[key] = None
        return None
    try:
        import joblib
        _models[key] = joblib.load(path)
        logger.info(f"{key} model loaded from {path}")
    except Exception as e:
        logger.error(f"Failed to load {key}: {e}")
        _models[key] = None
    return _models[key]


# ── Mock helpers ──────────────────────────────────────────────────────────────
def _mock(condition: str, threshold: float) -> Stage2Response:
    prob = round(random.uniform(0.4, 0.9), 4)
    return Stage2Response(
        condition=condition,
        probability=prob,
        risk="High" if prob >= threshold else "Low",
        threshold=threshold,
        is_mock=True,
    )


# ── Preeclampsia ──────────────────────────────────────────────────────────────
def predict_preeclampsia(inp: Stage2PreeclampsiaInput) -> Stage2Response:
    if settings.BLOOMCARE_MOCK_LLM:
        return _mock("preeclampsia", _THRESHOLD_PREECLAMPSIA)

    model = _load("preeclampsia", settings.STAGE2_PREECLAMPSIA_MODEL_PATH)
    if model is None:
        return _mock("preeclampsia", _THRESHOLD_PREECLAMPSIA)

    try:
        import numpy as np
        # Feature order from preeclam.py: numeric_cols + binary_cols
        features = np.array([[
            inp.age, inp.gest_age, inp.height, inp.weight, inp.bmi,
            inp.sysbp, inp.diabp, inp.hb, inp.pcv, inp.tsh,
            inp.platelet, inp.creatinine, inp.plgfsflt, inp.seng,
            inp.cysc, inp.pp_13, inp.glycerides,
            inp.htn, inp.diabetes, inp.fam_htn, inp.sp_art,
        ]])
        prob = float(model.predict_proba(features)[0][1])
        return Stage2Response(
            condition="preeclampsia",
            probability=round(prob, 4),
            risk="High" if prob >= _THRESHOLD_PREECLAMPSIA else "Low",
            threshold=_THRESHOLD_PREECLAMPSIA,
        )
    except Exception as e:
        logger.error(f"Preeclampsia inference error: {e}. Using mock.")
        return _mock("preeclampsia", _THRESHOLD_PREECLAMPSIA)


# ── GDM ───────────────────────────────────────────────────────────────────────
def predict_gdm(inp: Stage2GDMInput) -> Stage2Response:
    if settings.BLOOMCARE_MOCK_LLM:
        return _mock("gdm", _THRESHOLD_GDM)

    imputer = _load("gdm_imputer", settings.GDM_IMPUTER_PATH)
    model   = _load("gdm", settings.STAGE2_GDM_MODEL_PATH)
    if model is None or imputer is None:
        return _mock("gdm", _THRESHOLD_GDM)

    try:
        import numpy as np
        # Feature order from gdm.py: gdm_numeric_cols
        features = np.array([[
            inp.age, inp.no_of_pregnancy, inp.bmi,
            inp.hdl, inp.sys_bp, inp.dia_bp,
            inp.ogtt, inp.hemoglobin,
        ]])
        features_imp = imputer.transform(features)
        prob = float(model.predict_proba(features_imp)[0][1])
        return Stage2Response(
            condition="gdm",
            probability=round(prob, 4),
            risk="High" if prob >= _THRESHOLD_GDM else "Low",
            threshold=_THRESHOLD_GDM,
        )
    except Exception as e:
        logger.error(f"GDM inference error: {e}. Using mock.")
        return _mock("gdm", _THRESHOLD_GDM)


# ── Preterm Birth ─────────────────────────────────────────────────────────────
def predict_preterm(inp: Stage2PretermInput) -> Stage2Response:
    if settings.BLOOMCARE_MOCK_LLM:
        return _mock("preterm", _THRESHOLD_PRETERM)

    imputer = _load("preterm_imputer", settings.PRETERM_IMPUTER_PATH)
    model   = _load("preterm", settings.STAGE2_PRETERM_MODEL_PATH)
    if model is None or imputer is None:
        return _mock("preterm", _THRESHOLD_PRETERM)

    try:
        import numpy as np
        # Feature order from prematureb.py: preterm_rich_cols
        features = np.array([[
            inp.age_of_mother, inp.bmi, inp.hemoglobin,
            inp.pcos, inp.miscarriage_history, inp.exercise,
            inp.outside_food, inp.pollution, inp.sleep_pattern,
            inp.stress, inp.family_support, inp.work_hours,
        ]])
        features_imp = imputer.transform(features)
        prob = float(model.predict_proba(features_imp)[0][1])
        return Stage2Response(
            condition="preterm",
            probability=round(prob, 4),
            risk="High" if prob >= _THRESHOLD_PRETERM else "Low",
            threshold=_THRESHOLD_PRETERM,
        )
    except Exception as e:
        logger.error(f"Preterm inference error: {e}. Using mock.")
        return _mock("preterm", _THRESHOLD_PRETERM)
