from __future__ import annotations

import warnings
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.exceptions import InconsistentVersionWarning

from backend.schemas.differential import DifferentialEvaluationRequest

try:
    import shap  # type: ignore
except Exception:  # pragma: no cover - optional dependency fallback
    shap = None


PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = PROJECT_ROOT / "models"

# Keep sklearn model-version mismatch warnings visible, but only once per process.
warnings.simplefilter("once", InconsistentVersionWarning)


def _clamp_probability(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _risk_level(probability: float) -> str:
    if probability >= 0.75:
        return "High"
    if probability >= 0.4:
        return "Moderate"
    return "Low"


def _normalize(name: str) -> str:
    return name.strip().lower().replace("-", "").replace("_", "").replace(" ", "")


def _build_feature_candidates(payload: DifferentialEvaluationRequest) -> Dict[str, float]:
    ogtt_combo = (float(payload.ogtt_1hr) + float(payload.ogtt_2hr)) / 2.0

    return {
        "age": float(payload.age),
        "ageofmother": float(payload.age),
        "bmi": float(payload.bmi),
        "sysbp": float(payload.systolic_bp),
        "systolicbp": float(payload.systolic_bp),
        "systolic": float(payload.systolic_bp),
        "diabp": float(payload.diastolic_bp),
        "diastolicbp": float(payload.diastolic_bp),
        "diastolic": float(payload.diastolic_bp),
        "heartrate": float(payload.heart_rate),
        "heart_rate": float(payload.heart_rate),
        "bloodsugar": float(payload.blood_sugar),
        "temperature": float(payload.temperature),
        "plgfsflt": float(payload.sflt1_plgf_ratio),
        "sflt1plgfratio": float(payload.sflt1_plgf_ratio),
        "creatinine": float(payload.serum_creatinine),
        "serumcreatinine": float(payload.serum_creatinine),
        "platelet": float(payload.platelet_count),
        "plateletcount": float(payload.platelet_count),
        "hba1c": float(payload.hba1c),
        "ogtt": ogtt_combo,
        "ogtt1hr": float(payload.ogtt_1hr),
        "ogtt2hr": float(payload.ogtt_2hr),
        "noofpregnancy": float(payload.pregnancies_count),
        "pregnanciescount": float(payload.pregnancies_count),
        "cervicallengthmm": float(payload.cervical_length_mm),
        "cervicallength": float(payload.cervical_length_mm),
        "ffnresult": 1.0 if payload.ffn_result else 0.0,
        "meanpulsepressure": float(payload.mean_pulse_pressure),
        "pulsepressure": float(payload.mean_pulse_pressure),
        "depressedbp": float(payload.mean_pulse_pressure),
        "depresseddp": float(payload.diastolic_bp),
    }


def _resolve_feature_row(feature_order: Iterable[str], payload: DifferentialEvaluationRequest) -> pd.DataFrame:
    candidates = _build_feature_candidates(payload)
    row: Dict[str, float] = {}
    for feature in feature_order:
        normalized = _normalize(str(feature))
        row[str(feature)] = float(candidates.get(normalized, 0.0))
    return pd.DataFrame([row], columns=list(feature_order))


def _normalize_weights(raw_values: np.ndarray) -> np.ndarray:
    if raw_values.size == 0:
        return raw_values
    clipped = np.clip(raw_values.astype(float), a_min=0.0, a_max=None)
    total = float(clipped.sum())
    if total <= 0:
        return np.ones_like(clipped) / float(len(clipped))
    return clipped / total


def _normalize_signed_contributions(raw_values: np.ndarray) -> np.ndarray:
    if raw_values.size == 0:
        return raw_values
    denominator = float(np.abs(raw_values).sum())
    if denominator <= 0:
        return np.zeros_like(raw_values)
    return raw_values / denominator


def _extract_shap_row(shap_values: Any, feature_count: int) -> np.ndarray:
    values = np.asarray(getattr(shap_values, "values", shap_values), dtype=float)
    if values.ndim == 1:
        return values[:feature_count]
    if values.ndim == 2:
        return values[0, :feature_count]
    if values.ndim == 3:
        class_index = 1 if values.shape[2] > 1 else 0
        return values[0, :feature_count, class_index]
    return np.zeros(feature_count, dtype=float)


def _model_importance_vector(model: Any, feature_count: int) -> np.ndarray:
    if hasattr(model, "feature_importances_"):
        return np.abs(np.asarray(model.feature_importances_, dtype=float)[:feature_count])
    if hasattr(model, "coef_"):
        coefs = np.asarray(model.coef_, dtype=float)
        if coefs.ndim == 2:
            return np.abs(coefs[0, :feature_count])
        return np.abs(coefs[:feature_count])
    return np.zeros(feature_count, dtype=float)


def _predict_score(model: Any, frame: pd.DataFrame) -> float:
    if hasattr(model, "predict_proba"):
        return float(model.predict_proba(frame)[0][1])
    return float(model.predict(frame)[0])


def _local_sensitivity_signed(model: Any, frame: pd.DataFrame, feature_cols: list[str]) -> np.ndarray:
    baseline = _predict_score(model, frame)
    signed = np.zeros(len(feature_cols), dtype=float)
    for idx, col in enumerate(feature_cols):
        probe = frame.copy()
        current = float(probe.iloc[0][col])
        delta = max(abs(current) * 0.05, 0.5)
        probe.iloc[0, idx] = current + delta
        shifted = _predict_score(model, probe)
        signed[idx] = shifted - baseline
    return signed


def _blend_explainability(
    explainability_by_condition: dict[str, tuple[float, list[Dict[str, Any]]]],
) -> list[Dict[str, Any]]:
    if not explainability_by_condition:
        return []

    probability_sum = sum(max(probability, 0.0) for probability, _ in explainability_by_condition.values())
    if probability_sum <= 0:
        probability_sum = float(len(explainability_by_condition))

    weights = {
        key: (max(value[0], 0.0) / probability_sum)
        for key, value in explainability_by_condition.items()
    }

    merged: dict[str, Dict[str, Any]] = {}
    for key, (_, features) in explainability_by_condition.items():
        weight = weights[key]
        for feature in features:
            feature_name = str(feature.get("feature", "Unknown"))
            slot = merged.setdefault(
                feature_name,
                {
                    "feature": feature_name,
                    "importance": 0.0,
                    "contribution": 0.0,
                    "direction": "neutral",
                    "value": feature.get("value", "--"),
                    "status": feature.get("status", "risk-factor"),
                    "clinical_hint": feature.get("clinical_hint", ""),
                },
            )

            weighted_importance = float(feature.get("importance", 0.0)) * weight
            weighted_contribution = float(feature.get("contribution", 0.0)) * weight
            slot["importance"] += weighted_importance
            slot["contribution"] += weighted_contribution

            if weighted_importance >= float(slot.get("_source_weight", -1.0)):
                slot["_source_weight"] = weighted_importance
                slot["value"] = feature.get("value", slot["value"])
                slot["status"] = feature.get("status", slot["status"])
                slot["clinical_hint"] = feature.get("clinical_hint", slot["clinical_hint"])

    rows = list(merged.values())
    rows.sort(key=lambda item: float(item.get("importance", 0.0)), reverse=True)
    for row in rows:
        contribution = float(row.get("contribution", 0.0))
        row["direction"] = "increase" if contribution > 0 else "decrease" if contribution < 0 else "neutral"
        row.pop("_source_weight", None)
        row["importance"] = round(float(row["importance"]), 6)
        row["contribution"] = round(contribution, 6)
    return rows


def _feature_display_name(feature: str) -> str:
    normalized = _normalize(feature)
    mapping = {
        "age": "Age",
        "ageofmother": "Age",
        "bmi": "BMI",
        "sysbp": "Systolic BP",
        "systolic": "Systolic BP",
        "systolicbp": "Systolic BP",
        "diabp": "Diastolic BP",
        "diastolic": "Diastolic BP",
        "diastolicbp": "Diastolic BP",
        "heartrate": "Heart Rate",
        "heart_rate": "Heart Rate",
        "bloodsugar": "Blood Sugar",
        "hba1c": "HbA1c",
        "ogtt": "OGTT",
        "ogtt1hr": "OGTT 1hr",
        "ogtt2hr": "OGTT 2hr",
        "plgfsflt": "sFlt-1/PlGF Ratio",
        "sflt1plgfratio": "sFlt-1/PlGF Ratio",
        "creatinine": "Serum Creatinine",
        "serumcreatinine": "Serum Creatinine",
        "platelet": "Platelet Count",
        "plateletcount": "Platelet Count",
        "cervicallength": "Cervical Length",
        "cervicallengthmm": "Cervical Length",
        "ffnresult": "fFN Result",
        "meanpulsepressure": "Mean Pulse Pressure",
        "temperature": "Temperature",
    }
    if normalized in mapping:
        return mapping[normalized]
    return feature.replace("_", " ").strip().title()


def _feature_status(feature: str, value: float) -> str:
    normalized = _normalize(feature)
    if normalized in {"sysbp", "systolic", "systolicbp"}:
        return "abnormal" if value >= 140 else "normal"
    if normalized in {"diabp", "diastolic", "diastolicbp"}:
        return "elevated" if value >= 90 else "normal"
    if normalized in {"heartrate", "heart_rate"}:
        return "elevated" if value > 100 else "normal"
    if normalized == "bloodsugar":
        return "abnormal" if value >= 140 else "normal"
    if normalized == "hba1c":
        return "abnormal" if value >= 6.5 else ("elevated" if value >= 5.7 else "normal")
    if normalized == "temperature":
        return "abnormal" if value >= 38.0 else "normal"
    return "risk-factor"


def _feature_value_with_unit(feature: str, value: float) -> str:
    normalized = _normalize(feature)
    if normalized in {"sysbp", "systolic", "systolicbp", "diabp", "diastolic", "diastolicbp", "meanpulsepressure"}:
        return f"{value:.0f} mmHg"
    if normalized in {"heartrate", "heart_rate"}:
        return f"{value:.0f} bpm"
    if normalized in {"bloodsugar", "ogtt", "ogtt1hr", "ogtt2hr"}:
        return f"{value:.0f} mg/dL"
    if normalized == "temperature":
        return f"{value:.1f} C"
    if normalized == "hba1c":
        return f"{value:.1f}%"
    if normalized in {"creatinine", "serumcreatinine"}:
        return f"{value:.2f} mg/dL"
    if normalized in {"platelet", "plateletcount"}:
        return f"{value:.0f} x10^9/L"
    if normalized in {"cervicallength", "cervicallengthmm"}:
        return f"{value:.1f} mm"
    if normalized == "ffnresult":
        return "Positive" if value >= 0.5 else "Negative"
    return f"{value:.2f}"


def _direction_from_status(status: str) -> str:
    if status in {"abnormal", "elevated", "risk-factor"}:
        return "increase"
    if status == "normal":
        return "decrease"
    return "neutral"


def _clinical_hint(feature_label: str, status: str, value_text: str) -> str:
    if feature_label == "Systolic BP" and status in {"abnormal", "elevated"}:
        return "Elevated systolic BP detected. Recommended: Manual re-check in 15 minutes and assess symptoms."
    if feature_label == "Diastolic BP" and status in {"abnormal", "elevated"}:
        return "Diastolic pressure is elevated. Recommended: Repeat BP with correct cuff and evaluate for PE warning signs."
    if feature_label == "Blood Sugar" and status in {"abnormal", "elevated"}:
        return "Glucose trend is above target. Recommended: Verify with repeat capillary/venous test and review meal timing."
    if feature_label == "Heart Rate" and status in {"abnormal", "elevated"}:
        return "Heart rate is elevated. Recommended: Reassess after rest and screen for pain, fever, dehydration, or anxiety."
    if feature_label == "Temperature" and status == "abnormal":
        return "Fever pattern detected. Recommended: Confirm temperature and evaluate for infection source urgently."
    if feature_label == "fFN Result" and value_text == "Positive":
        return "fFN is positive. Recommended: Follow preterm prevention pathway and specialist review."
    if status == "normal":
        return "Value is within expected clinical range and may be protective in the current model context."
    return "High-impact predictor identified. Correlate with bedside findings and repeat abnormal values before intervention."


@lru_cache(maxsize=8)
def _load_artifact(model_name: str) -> Any:
    model_path = MODELS_DIR / model_name
    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found: {model_path}")
    return joblib.load(model_path)


def _predict_probability(model_name: str, payload: DifferentialEvaluationRequest) -> float:
    artifact = _load_artifact(model_name)

    model = artifact.get("model") if isinstance(artifact, dict) else artifact
    imputer = artifact.get("imputer") if isinstance(artifact, dict) else None
    feature_cols = (
        artifact.get("feature_columns") if isinstance(artifact, dict) else list(getattr(model, "feature_names_in_", []))
    )

    if model is None:
        raise ValueError(f"Invalid model artifact in {model_name}")
    if not feature_cols:
        raise ValueError(f"Missing feature list in {model_name}")

    frame = _resolve_feature_row(feature_cols, payload)
    if imputer is not None:
        frame = pd.DataFrame(imputer.transform(frame), columns=feature_cols)

    probability = _predict_score(model, frame)

    return _clamp_probability(probability)


def _has_informative_payload_signal(model_name: str, payload: DifferentialEvaluationRequest) -> bool:
    artifact = _load_artifact(model_name)
    model = artifact.get("model") if isinstance(artifact, dict) else artifact
    feature_cols = (
        artifact.get("feature_columns") if isinstance(artifact, dict) else list(getattr(model, "feature_names_in_", []))
    )

    if not feature_cols:
        return False

    frame = _resolve_feature_row(feature_cols, payload)
    values = frame.to_numpy(dtype=float)
    return bool(np.any(np.abs(values) > 1e-9))


def _predict_with_explainability(
    model_name: str,
    payload: DifferentialEvaluationRequest,
) -> Tuple[float, list[Dict[str, Any]]]:
    artifact = _load_artifact(model_name)
    model = artifact.get("model") if isinstance(artifact, dict) else artifact
    imputer = artifact.get("imputer") if isinstance(artifact, dict) else None
    feature_cols = (
        artifact.get("feature_columns") if isinstance(artifact, dict) else list(getattr(model, "feature_names_in_", []))
    )

    if model is None:
        raise ValueError(f"Invalid model artifact in {model_name}")
    if not feature_cols:
        raise ValueError(f"Missing feature list in {model_name}")

    frame = _resolve_feature_row(feature_cols, payload)
    if imputer is not None:
        frame = pd.DataFrame(imputer.transform(frame), columns=feature_cols)

    probability = _predict_score(model, frame)

    feature_count = len(feature_cols)
    signed_vector: np.ndarray | None = None
    if shap is not None:
        try:
            explainer = shap.Explainer(model, frame)
            shap_values = explainer(frame)
            signed_vector = _extract_shap_row(shap_values, feature_count)
        except Exception:
            signed_vector = None

    if signed_vector is None:
        fallback_importance = _model_importance_vector(model, feature_count)
        if np.any(fallback_importance > 0):
            signed_vector = np.zeros(feature_count, dtype=float)
            for idx, feature in enumerate(feature_cols):
                feature_name = str(feature)
                feature_value = float(frame.iloc[0][feature_name])
                status = _feature_status(feature_name, feature_value)
                direction = _direction_from_status(status)
                signed_vector[idx] = float(fallback_importance[idx]) * (1.0 if direction == "increase" else -1.0 if direction == "decrease" else 0.0)
        else:
            signed_vector = _local_sensitivity_signed(model, frame, list(feature_cols))

    importance_vector = np.abs(signed_vector)

    normalized_importance = _normalize_weights(importance_vector)
    normalized_signed = _normalize_signed_contributions(signed_vector)
    row = frame.iloc[0]

    if np.all(np.abs(normalized_signed) < 1e-9):
        for index, feature in enumerate(feature_cols):
            feature_name = str(feature)
            feature_value = float(row[feature_name])
            status = _feature_status(feature_name, feature_value)
            direction = _direction_from_status(status)
            if direction == "increase":
                normalized_signed[index] = normalized_importance[index]
            elif direction == "decrease":
                normalized_signed[index] = -normalized_importance[index]

    explainability = []
    for index, feature in enumerate(feature_cols):
        feature_name = str(feature)
        feature_value = float(row[feature_name])
        status = _feature_status(feature_name, feature_value)
        direction = "increase" if normalized_signed[index] > 0 else "decrease" if normalized_signed[index] < 0 else "neutral"
        display_name = _feature_display_name(feature_name)
        display_value = _feature_value_with_unit(feature_name, feature_value)
        explainability.append(
            {
                "feature": display_name,
                "importance": round(float(normalized_importance[index]), 6),
                "contribution": round(float(normalized_signed[index]), 6),
                "direction": direction,
                "value": display_value,
                "status": status,
                "clinical_hint": _clinical_hint(display_name, status, display_value),
            }
        )

    explainability.sort(key=lambda item: item["importance"], reverse=True)
    return _clamp_probability(probability), explainability


def evaluate_differential(
    payload: DifferentialEvaluationRequest,
) -> Tuple[Dict[str, Dict[str, float | str]], str, str, list[Dict[str, Any]]]:
    pe_probability, pe_explainability = _predict_with_explainability("stage2_diagnostic.pkl", payload)
    gdm_probability, gdm_explainability = _predict_with_explainability("stage2_gdm_diagnostic.pkl", payload)

    preterm_main, preterm_explainability = _predict_with_explainability("stage2_preterm_main_msf.pkl", payload)
    support_name = "stage2_preterm_support_msf.pkl"
    support_probability: float | None = None
    try:
        if _has_informative_payload_signal(support_name, payload):
            support_probability = _predict_probability(support_name, payload)
    except FileNotFoundError:
        # Backward compatibility for existing workspace model naming.
        fallback_support_name = "stage2_preterm_support_ehg.pkl"
        if _has_informative_payload_signal(fallback_support_name, payload):
            support_probability = _predict_probability(fallback_support_name, payload)

    if support_probability is None:
        preterm_probability = _clamp_probability(preterm_main)
    else:
        preterm_probability = _clamp_probability((preterm_main + support_probability) / 2.0)

    result: Dict[str, Dict[str, float | str]] = {
        "preeclampsia": {
            "probability": round(pe_probability, 4),
            "risk_level": _risk_level(pe_probability),
        },
        "gdm": {
            "probability": round(gdm_probability, 4),
            "risk_level": _risk_level(gdm_probability),
        },
        "preterm_birth": {
            "probability": round(preterm_probability, 4),
            "risk_level": _risk_level(preterm_probability),
        },
    }

    primary_risk = max(result.items(), key=lambda item: float(item[1]["probability"]))[0]
    explainability_model_map = {
        "preeclampsia": ("stage2_diagnostic.pkl", "Preeclampsia Model"),
        "gdm": ("stage2_gdm_diagnostic.pkl", "GDM Model"),
        "preterm_birth": ("stage2_preterm_main_msf.pkl", "Preterm Birth Model"),
    }
    _, explainability_model_label = explainability_model_map.get(
        primary_risk,
        ("stage2_diagnostic.pkl", "Preeclampsia Model"),
    )
    explainability = _blend_explainability(
        {
            "preeclampsia": (pe_probability, pe_explainability),
            "gdm": (gdm_probability, gdm_explainability),
            "preterm_birth": (preterm_main, preterm_explainability),
        }
    )

    return result, primary_risk, explainability_model_label, explainability