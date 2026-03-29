import argparse
import ast
import json
from pathlib import Path
from typing import Dict, Any, List, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import KNNImputer, SimpleImputer
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from imblearn.over_sampling import SMOTE
from sklearn.model_selection import GridSearchCV


# --- CONFIGURATION ---
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "Data"
MODEL_PATH = PROJECT_ROOT / "stage1_general_risk_screener.pkl"


# Clinical safety thresholds used for local trigger reporting.
CLINICAL_THRESHOLDS = {
    "systolic_bp": 140.0,
    "diastolic_bp": 90.0,
    "heart_rate": 100.0,
    "blood_sugar": 7.8,
}


def _to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if np.isnan(parsed):
        return None
    return parsed


def _first_numeric(payload: Dict[str, Any], keys: List[str]) -> Optional[float]:
    for key in keys:
        if key in payload:
            parsed = _to_float(payload.get(key))
            if parsed is not None:
                return parsed
    return None


def _build_clinical_triggers(patient_payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    triggers: List[Dict[str, Any]] = []

    systolic = _first_numeric(patient_payload, ["Systolic_BP", "systolic", "Systolic BP"])
    diastolic = _first_numeric(patient_payload, ["Diastolic", "diastolic", "Diastolic BP"])
    heart_rate = _first_numeric(
        patient_payload,
        ["Heart_Rate", "heart_rate", "Heart Rate", "heartRate", "HeartRate", "hr", "HR"],
    )
    blood_sugar = _first_numeric(patient_payload, ["BS", "bs", "Blood Sugar", "blood_sugar"])

    if (systolic is not None and systolic > CLINICAL_THRESHOLDS["systolic_bp"]) or (
        diastolic is not None and diastolic > CLINICAL_THRESHOLDS["diastolic_bp"]
    ):
        severity = 0.0
        if systolic is not None:
            severity = max(severity, systolic / CLINICAL_THRESHOLDS["systolic_bp"] - 1.0)
        if diastolic is not None:
            severity = max(severity, diastolic / CLINICAL_THRESHOLDS["diastolic_bp"] - 1.0)

        triggers.append(
            {
                "feature": "Blood Pressure",
                "value": {
                    "systolic": round(systolic, 2) if systolic is not None else None,
                    "diastolic": round(diastolic, 2) if diastolic is not None else None,
                },
                "clinical_reason": "Hypertensive reading detected",
                "threshold": "Systolic > 140 or Diastolic > 90",
                "severity_score": round(max(severity, 0.0), 4),
            }
        )

    if heart_rate is not None and heart_rate > CLINICAL_THRESHOLDS["heart_rate"]:
        triggers.append(
            {
                "feature": "Heart Rate",
                "value": round(heart_rate, 2),
                "clinical_reason": "Tachycardia detected",
                "threshold": "Heart Rate > 100 bpm",
                "severity_score": round(heart_rate / CLINICAL_THRESHOLDS["heart_rate"] - 1.0, 4),
            }
        )

    if blood_sugar is not None and blood_sugar > CLINICAL_THRESHOLDS["blood_sugar"]:
        triggers.append(
            {
                "feature": "Blood Sugar",
                "value": round(blood_sugar, 2),
                "clinical_reason": "Hyperglycemia detected",
                "threshold": "Blood Sugar > 7.8",
                "severity_score": round(blood_sugar / CLINICAL_THRESHOLDS["blood_sugar"] - 1.0, 4),
            }
        )

    # Show the most severe trigger first for triage readability.
    triggers.sort(key=lambda item: float(item.get("severity_score", 0.0)), reverse=True)
    return triggers


# --- DATA ENGINEERING HELPERS ---
def _to_binary(series: pd.Series) -> pd.Series:
    numeric_series = pd.to_numeric(series, errors="coerce")
    if numeric_series.notna().sum() > 0:
        return (numeric_series > 0).astype(float)

    normalized = series.astype(str).str.strip().str.lower()
    yes_values = {"1", "true", "yes", "high", "mid", "positive"}
    no_values = {"0", "false", "no", "low", "negative"}

    out = pd.Series(np.nan, index=series.index, dtype=float)
    out[normalized.isin(yes_values)] = 1.0
    out[normalized.isin(no_values)] = 0.0
    return out


def _load_and_prepare_updated() -> pd.DataFrame:
    df = pd.read_csv(DATA_DIR / "Dataset - Updated.csv")

    rename_map = {
        "Systolic BP": "Systolic_BP",
        "Body Temp": "Body_Temp",
        "Heart Rate": "Heart_Rate",
        "Previous Complications": "Previous_Complications",
        "Preexisting Diabetes": "Preexisting_Diabetes",
        "Gestational Diabetes": "Gestational_Diabetes",
        "Mental Health": "Mental_Health",
    }
    df = df.rename(columns=rename_map)

    df["stage1_target_gdm"] = _to_binary(df["Gestational_Diabetes"])

    risk_level = df.get("Risk Level", pd.Series(np.nan, index=df.index))
    risk_flag = risk_level.astype(str).str.strip().str.lower().eq("high").astype(float)
    systolic = pd.to_numeric(df.get("Systolic_BP"), errors="coerce")
    diastolic = pd.to_numeric(df.get("Diastolic"), errors="coerce")
    previous_complications = _to_binary(df.get("Previous_Complications", pd.Series(np.nan, index=df.index)))

    preeclampsia_proxy = (
        (systolic >= 140)
        | (diastolic >= 90)
        | (risk_flag == 1)
        | (previous_complications == 1)
    ).astype(float)

    df["stage1_target_preeclampsia"] = preeclampsia_proxy
    df["stage1_target_preterm"] = np.nan
    return df


def _load_and_prepare_msf() -> pd.DataFrame:
    msf_candidates = [
        DATA_DIR / "MSF_cleaned.csv",
        DATA_DIR / "MSF_Stage1_Cleaned.csv",
    ]

    msf_path = next((path for path in msf_candidates if path.exists()), None)
    if msf_path is None:
        raise FileNotFoundError("MSF cleaned file not found in Data folder.")

    df = pd.read_csv(msf_path)

    rename_map = {
        "Age_Of_Mother": "Age",
        "Height(cm)": "Height_cm",
        "Issues_Pregnancy.1": "Issues_Pregnancy_1",
    }
    df = df.rename(columns=rename_map)
    df = df.drop(columns=["Mother_UID"], errors="ignore")

    gdm_source = df.get("Issues_Pregnancy_1", df.get("Issues_Pregnancy"))
    df["stage1_target_gdm"] = _to_binary(gdm_source)
    df["stage1_target_preterm"] = _to_binary(df.get("PreTerm", pd.Series(np.nan, index=df.index)))
    df["stage1_target_preeclampsia"] = _to_binary(df.get("Issues_Pregnancy", pd.Series(np.nan, index=df.index)))
    return df


def build_master_dataset() -> pd.DataFrame:
    df_updated = _load_and_prepare_updated()
    df_msf = _load_and_prepare_msf()

    df_master = pd.concat([df_updated, df_msf], ignore_index=True, sort=False)

    # THE MASTER TRIAGE TARGET: If ANY disease is flagged, General Risk is 1
    conditions = (
        (df_master["stage1_target_preeclampsia"] == 1) |
        (df_master["stage1_target_gdm"] == 1) |
        (df_master["stage1_target_preterm"] == 1)
    )
    df_master["General_Risk_Flag"] = conditions.astype(int)

    # 3. DEFINE THE GOLDEN FEATURE SET
    golden_features = [
        "Age", "BMI", "Systolic_BP", "Diastolic", "Heart_Rate",
        "BS", "Body_Temp", "Hemoglobin", "PCOS", "Previous_Complications",
        "Preexisting_Diabetes", "Mental_Health", "Sleep_Pattern", "Exercise", "Education"
    ]

    if "Stress" in df_master.columns and "Mental_Health" in df_master.columns:
        df_master["Mental_Health"] = df_master["Mental_Health"].fillna(df_master["Stress"])
    if "depressed" in df_master.columns:
        df_master["Mental_Health"] = df_master["Mental_Health"].fillna(df_master["depressed"])

    columns_to_keep = golden_features + ["General_Risk_Flag"]
    df_master = df_master[[col for col in columns_to_keep if col in df_master.columns]]

    for column in df_master.columns:
        if column != "General_Risk_Flag":
            df_master[column] = pd.to_numeric(df_master[column], errors="coerce")

    return df_master


def _build_edge_pipeline() -> Pipeline:
    # Notice we removed hardcoded max_depth. GridSearch will find it.
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("rf_model", RandomForestClassifier(
            n_estimators=30,  # Kept at 30 so the JS file stays small!
            class_weight="balanced",
            random_state=42,
            n_jobs=-1
        ))
    ])

def train_stage1_master_triage() -> Dict[str, Any]:
    df_master = build_master_dataset()

    # --- CLINICAL FEATURE ENGINEERING (THE FREE BOOST) ---
    # We calculate MAP from the existing BP features
    if "Systolic_BP" in df_master.columns and "Diastolic" in df_master.columns:
        df_master["MAP"] = (df_master["Systolic_BP"] + 2 * df_master["Diastolic"]) / 3.0
        print("💉 Engineered clinical feature: Mean Arterial Pressure (MAP)")

    feature_cols = [col for col in df_master.columns if col != "General_Risk_Flag"]

    print("\n🧠 RUNNING PRE-PROCESS DATA FUSION (KNN IMPUTATION)...")
    knn = KNNImputer(n_neighbors=5, weights="distance")
    df_fused_features = pd.DataFrame(knn.fit_transform(df_master[feature_cols]), columns=feature_cols)

    df_fused_features["General_Risk_Flag"] = df_master["General_Risk_Flag"].values
    df_master_fused = df_fused_features

    print("\n🚀 OPTIMIZING AI VIA GRID SEARCH...")
    X = df_master_fused[feature_cols]
    y = df_master_fused["General_Risk_Flag"].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )

    # SMOTE balancing
    min_samples = y_train.value_counts().min()
    if min_samples > 1:
        k_neighbors = min(5, min_samples - 1)
        smote = SMOTE(random_state=42, k_neighbors=k_neighbors)
        X_train_resampled, y_train_resampled = smote.fit_resample(X_train, y_train)
    else:
        X_train_resampled, y_train_resampled = X_train, y_train

    # --- HYPERPARAMETER TUNING ---
    # This tests multiple configurations to find the absolute highest accuracy
    pipeline = _build_edge_pipeline()
    param_grid = {
        'rf_model__max_depth': [5, 7, 9], 
        'rf_model__min_samples_leaf': [1, 2, 4],
        'rf_model__criterion': ['gini', 'entropy']
    }

    grid_search = GridSearchCV(
        pipeline, param_grid, cv=3, scoring='roc_auc', n_jobs=-1
    )
    grid_search.fit(X_train_resampled, y_train_resampled)
    
    best_pipeline = grid_search.best_estimator_
    print(f"🏆 Best AI Configuration Found: {grid_search.best_params_}")

    # Evaluate the Optimized Model
    decision_threshold = 0.35 # Slightly bumped up to balance Accuracy/Recall
    
    y_prob = best_pipeline.predict_proba(X_test)[:, 1]
    y_pred = (y_prob >= decision_threshold).astype(int) 

    auc_score = roc_auc_score(y_test, y_prob)

    print(f"\n[GENERAL MATERNAL RISK - OPTIMIZED] Rows: {len(df_master_fused)} | ROC-AUC: {auc_score:.4f}")
    print(f"Optimized for Balanced Triage (Threshold = {decision_threshold}):")
    print(classification_report(y_test, y_pred, digits=4))

    artifact = {
        "models": {"general_risk": best_pipeline},
        "feature_columns": feature_cols,
        "target_columns": {"general_risk": "General_Risk_Flag"},
        "metrics": {"general_risk": float(auc_score)},
        "model_version": "stage1-master-triage-v2-optimized",
    }

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, MODEL_PATH)
    print(f"\nMaster Triage Model successfully saved to: {MODEL_PATH}")

    return artifact


def predict_stage1_risk(patient_payload: Dict[str, Any], model_path: Path = MODEL_PATH) -> Dict[str, Any]:
    artifact = joblib.load(model_path)
    model = artifact["models"]["general_risk"]
    feature_columns = artifact["feature_columns"]

    payload_df = pd.DataFrame([
        {feature: patient_payload.get(feature, np.nan) for feature in feature_columns}
    ])
    payload_df = payload_df.apply(pd.to_numeric, errors="coerce")

    probability = float(model.predict_proba(payload_df)[0][1])
    threshold = 0.35
    triggers = _build_clinical_triggers(patient_payload)
    is_clinically_high = len(triggers) > 0
    final_risk = "High" if (probability >= threshold or is_clinically_high) else "Low"

    local_feature_importance = [
        {
            "feature": trigger["feature"],
            "severity_score": trigger["severity_score"],
            "clinical_reason": trigger["clinical_reason"],
        }
        for trigger in triggers
    ]

    return {
        "general_risk": {
            "probability": round(probability, 4),
            "risk": final_risk,
            "threshold": threshold,
            "is_clinically_high": is_clinically_high,
            "triggers": triggers,
            "local_feature_importance": local_feature_importance,
        }
    }


def _run_predict_from_json(json_payload: str) -> None:
    try:
        payload = json.loads(json_payload)
    except json.JSONDecodeError:
        payload = ast.literal_eval(json_payload)

    output = predict_stage1_risk(payload)
    print(json.dumps(output, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="Stage-01 Master Triage Screener")
    parser.add_argument("--train", action="store_true", help="Train Stage-01 model and save artifact")
    parser.add_argument(
        "--predict-json",
        type=str,
        default=None,
        help="Predict from JSON payload string",
    )

    args = parser.parse_args()

    if args.predict_json:
        _run_predict_from_json(args.predict_json)
        return

    # Default behavior: run training so plain `python stage1.py` gives visible output.
    train_stage1_master_triage()


if __name__ == "__main__":
    main()