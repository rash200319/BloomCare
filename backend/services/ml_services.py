from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import pandas as pd
from sklearn.base import BaseEstimator

from schemas.screening import (
    ClusterProfile,
    ConditionProbability,
    ConditionType,
    DiagnoseInput,
    DiagnoseMLOutput,
)


PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = PROJECT_ROOT / "models"

MODEL_FILE_BY_DISEASE: Dict[str, str] = {
    "preeclampsia": "stage2_diagnostic.pkl",
    "gdm": "stage2_gdm_diagnostic.pkl",
    "preterm": "stage2_preterm_main_msf.pkl",
    "preterm_ehg": "stage2_preterm_support_ehg.pkl",
}


def _safe_float(value: Optional[Any], default: float = 0.0) -> float:
    try:
        if value is None:
            return float(default)
        return float(value)
    except Exception:
        return float(default)


def _map_payload_to_feature_dict(
    payload: DiagnoseInput,
    disease: str,
    stage1_context: Optional[Dict[str, Any]],
) -> Dict[str, float]:
    m = payload.metabolomics
    d = payload.doppler

    s1 = stage1_context or {}

    # Common values we can reuse across disease-specific models
    age = _safe_float(s1.get("age"))
    bmi = _safe_float(s1.get("bmi"))
    systolic = _safe_float(s1.get("systolic"))
    diastolic = _safe_float(s1.get("diastolic"))
    hemoglobin = _safe_float(s1.get("hemoglobin"))
    pcos = 1.0 if s1.get("pcos") else 0.0
    prev_comp = 1.0 if s1.get("previous_complications") else 0.0
    preexisting_dm = 1.0 if s1.get("preexisting_diabetes") else 0.0
    stress = _safe_float(s1.get("mental_health"))
    sleep = _safe_float(s1.get("sleep_pattern"))

    if disease == "gdm":
        return {
            "Age": age,
            "No of Pregnancy": _safe_float((payload.disease_specific_inputs or {}).get("no_of_pregnancy"), 1.0),
            "BMI": bmi,
            "HDL": _safe_float(m.hdl_cholesterol if m else None),
            "Sys BP": systolic,
            "Dia BP": diastolic,
            "OGTT": _safe_float((payload.disease_specific_inputs or {}).get("ogtt"), _safe_float(m.glucose_fasting if m else None)),
            "Hemoglobin": hemoglobin,
            "HbA1c": _safe_float(m.hba1c if m else None),
        }

    if disease in {"preterm", "preterm_ehg"}:
        return {
            "Age_Of_Mother": age,
            "BMI": bmi,
            "Hemoglobin": hemoglobin,
            "PCOS": pcos,
            "Miscarrage History": prev_comp,
            "Stress_AM": stress,
            "Stress_DP": stress,
            "Family_Income": _safe_float((payload.disease_specific_inputs or {}).get("family_income"), 0.0),
            "Travel_Time_t": _safe_float((payload.disease_specific_inputs or {}).get("travel_time"), 0.0),
            "Work_Hours_AM": _safe_float((payload.disease_specific_inputs or {}).get("work_hours"), 0.0),
            "weight_before_preg": _safe_float((payload.disease_specific_inputs or {}).get("weight_before_preg"), bmi),
            "wt_before_delivery": _safe_float((payload.disease_specific_inputs or {}).get("weight_before_delivery"), bmi),
            "Time_Taken_To_Concieve": _safe_float((payload.disease_specific_inputs or {}).get("time_to_conceive"), 0.0),
            "depressed_BP": systolic,
            "depressed_DP": diastolic,
        }

    # preeclampsia default mapping
    return {
        "age": age,
        "gest_age": _safe_float(payload.gestational_age_weeks),
        "height": _safe_float((payload.disease_specific_inputs or {}).get("height"), 0.0),
        "weight": _safe_float((payload.disease_specific_inputs or {}).get("weight"), 0.0),
        "bmi": bmi,
        "sysbp": systolic,
        "diabp": diastolic,
        "hb": hemoglobin,
        "pcv": _safe_float((payload.disease_specific_inputs or {}).get("pcv"), 0.0),
        "tsh": _safe_float((payload.disease_specific_inputs or {}).get("tsh"), 0.0),
        "platelet": _safe_float((payload.disease_specific_inputs or {}).get("platelet"), 0.0),
        "creatinine": _safe_float(m.creatinine if m else None),
        "plgfsflt": _safe_float(payload.sflt1_plgf_ratio),
        "seng": _safe_float((payload.disease_specific_inputs or {}).get("seng"), 0.0),
        "cysc": _safe_float((payload.disease_specific_inputs or {}).get("cysc"), 0.0),
        "pp_13": _safe_float(payload.papp_a),
        "glycerides": _safe_float(m.triglycerides if m else None),
        "htn": 1.0 if systolic >= 140 or diastolic >= 90 else 0.0,
        "diabetes": preexisting_dm,
        "fam_htn": _safe_float((payload.disease_specific_inputs or {}).get("fam_htn"), 0.0),
        "sp_art": _safe_float((payload.disease_specific_inputs or {}).get("sp_art"), 0.0),
        "occupation": _safe_float((payload.disease_specific_inputs or {}).get("occupation"), 0.0),
        "diet": _safe_float((payload.disease_specific_inputs or {}).get("diet"), 0.0),
        "activity": _safe_float((payload.disease_specific_inputs or {}).get("activity"), 0.0),
        "sleep": sleep,
    }


def _prepare_input_frame(feature_map: Dict[str, float], feature_order: List[str]) -> pd.DataFrame:
    row = {feature: _safe_float(feature_map.get(feature), 0.0) for feature in feature_order}
    return pd.DataFrame([row], columns=feature_order)


def _load_model_artifact(disease: str) -> Tuple[Any, Path]:
    model_file = MODEL_FILE_BY_DISEASE.get(disease, MODEL_FILE_BY_DISEASE["preeclampsia"])
    model_path = MODELS_DIR / model_file
    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found: {model_path}")
    artifact = joblib.load(model_path)
    return artifact, model_path


def run_selected_stage2_model(
    payload: DiagnoseInput,
    disease: str,
    stage1_context: Optional[Dict[str, Any]] = None,
) -> DiagnoseMLOutput:
    artifact, model_path = _load_model_artifact(disease)

    model: BaseEstimator
    imputer = None
    threshold = 0.5

    if isinstance(artifact, dict):
        model = artifact.get("model")
        imputer = artifact.get("imputer")
        feature_cols = artifact.get("feature_columns") or []
        threshold = float(artifact.get("threshold", 0.5))
    else:
        model = artifact
        feature_cols = list(getattr(model, "feature_names_in_", []))

    if model is None:
        raise ValueError(f"Invalid model artifact in {model_path.name}")
    if not feature_cols:
        raise ValueError(f"Could not determine feature columns for {model_path.name}")

    mapped = _map_payload_to_feature_dict(payload, disease, stage1_context)
    X = _prepare_input_frame(mapped, feature_cols)

    if imputer is not None:
        X_imp = pd.DataFrame(imputer.transform(X), columns=feature_cols)
    else:
        X_imp = X.fillna(0.0)

    prob = float(model.predict_proba(X_imp)[0][1])
    risk_category = (
        "critical" if prob >= 0.65 else
        "high" if prob >= 0.35 else
        "moderate" if prob >= 0.15 else
        "low"
    )

    if disease == "gdm":
        selected_condition = ConditionType.GDM
    elif disease in {"preterm", "preterm_ehg"}:
        selected_condition = ConditionType.PRETERM_BIRTH
    else:
        selected_condition = ConditionType.PREECLAMPSIA_EARLY_ONSET

    selected_cp = ConditionProbability(
        condition=selected_condition,
        probability=round(prob, 4),
        confidence_lower=round(max(0.0, prob - 0.1), 4),
        confidence_upper=round(min(1.0, prob + 0.1), 4),
        risk_category=risk_category,
        contributing_features={},
    )

    # Include low-probability placeholders for other conditions so existing clients still work.
    placeholders = {
        ConditionType.PREECLAMPSIA_EARLY_ONSET: 0.05,
        ConditionType.GDM: 0.05,
        ConditionType.PRETERM_BIRTH: 0.05,
    }
    placeholders[selected_condition] = prob

    condition_probabilities: List[ConditionProbability] = [
        ConditionProbability(
            condition=cond,
            probability=round(float(score), 4),
            confidence_lower=round(max(0.0, float(score) - 0.1), 4),
            confidence_upper=round(min(1.0, float(score) + 0.1), 4),
            risk_category=(
                "critical" if score >= 0.65 else
                "high" if score >= 0.35 else
                "moderate" if score >= 0.15 else
                "low"
            ),
            contributing_features={},
        )
        for cond, score in placeholders.items()
    ]

    return DiagnoseMLOutput(
        patient_id=payload.patient_id,
        encounter_id=payload.encounter_id,
        processed_at=datetime.now(timezone.utc).isoformat(),
        cluster_profile=ClusterProfile(
            cluster_id=0,
            cluster_label=f"{disease}-focused-evaluation",
            cluster_confidence=1.0,
            dominant_features=[f for f in feature_cols[:5]],
        ),
        condition_probabilities=condition_probabilities,
        overall_severity_score=round(prob, 4),
        dominant_condition=selected_condition,
        imputed_features=[],
        data_quality_score=1.0,
    )
