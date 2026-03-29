import json
from pathlib import Path

import joblib
import matplotlib.pyplot as plt
import pandas as pd
import shap
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import classification_report, precision_recall_curve, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "Data"


def _pick_threshold_for_recall(y_true: pd.Series, y_prob: pd.Series, target_recall: float = 0.85) -> float:
    precision, recall, thresholds = precision_recall_curve(y_true, y_prob)

    best_threshold = 0.30
    best_precision = -1.0

    for index, threshold in enumerate(thresholds):
        current_recall = recall[index]
        current_precision = precision[index]
        if current_recall >= target_recall and current_precision > best_precision:
            best_precision = current_precision
            best_threshold = float(threshold)

    return max(0.05, min(0.95, best_threshold))


def train_main_msf_preterm_model() -> dict:
    print("\n--- 🥇 MAIN PRETERM MODEL (MSF CLEANED - IMBALANCED REAL WORLD) ---")
    msf_path = DATA_DIR / "MSF_cleaned.csv"
    if not msf_path.exists():
        raise FileNotFoundError(f"Main dataset not found: {msf_path}")

    df = pd.read_csv(msf_path)
    df.columns = df.columns.str.strip()

    if "PreTerm" not in df.columns:
        raise ValueError("Column 'PreTerm' not found in MSF_cleaned.csv")

    feature_candidates = [
        "Age_Of_Mother", "BMI", "Hemoglobin", "PCOS", "Miscarrage History",
        "Stress_AM", "Stress_DP", "Family_Income", "Travel_Time_t", "Work_Hours_AM",
        "weight_before_preg", "wt_before_delivery", "Time_Taken_To_Concieve", "depressed_BP", "depressed_DP",
    ]
    feature_cols = [column for column in feature_candidates if column in df.columns]
    if not feature_cols:
        raise ValueError("No valid preterm features found in MSF_cleaned.csv")

    X_raw = df[feature_cols].apply(pd.to_numeric, errors="coerce")
    y = pd.to_numeric(df["PreTerm"], errors="coerce").fillna(0).astype(int)

    X_trainval, X_test, y_trainval, y_test = train_test_split(
        X_raw,
        y,
        test_size=0.2,
        stratify=y,
        random_state=42,
    )

    X_train, X_val, y_train, y_val = train_test_split(
        X_trainval,
        y_trainval,
        test_size=0.25,
        stratify=y_trainval,
        random_state=42,
    )

    imputer = SimpleImputer(strategy="median")
    X_train_imp = pd.DataFrame(imputer.fit_transform(X_train), columns=feature_cols)
    X_val_imp = pd.DataFrame(imputer.transform(X_val), columns=feature_cols)
    X_test_imp = pd.DataFrame(imputer.transform(X_test), columns=feature_cols)

    model = RandomForestClassifier(
        n_estimators=400,
        max_depth=10,
        class_weight="balanced_subsample",
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train_imp, y_train)

    y_val_prob = model.predict_proba(X_val_imp)[:, 1]
    threshold = _pick_threshold_for_recall(y_val, y_val_prob, target_recall=0.85)

    y_test_prob = model.predict_proba(X_test_imp)[:, 1]
    y_test_pred = (y_test_prob >= threshold).astype(int)
    test_recall = recall_score(y_test, y_test_pred)

    print(f"Rows: {len(df)} | Positive rate: {y.mean():.4f}")
    print(f"Recall-optimized threshold from validation: {threshold:.4f}")
    print(f"Main model ROC-AUC: {roc_auc_score(y_test, y_test_prob):.4f}")
    print(f"Main model Recall : {test_recall:.4f}")
    print(classification_report(y_test, y_test_pred, digits=4))

    artifact = {
        "model": model,
        "imputer": imputer,
        "feature_columns": feature_cols,
        "threshold": float(threshold),
        "source": "MSF_cleaned.csv",
    }

    artifact_path = PROJECT_ROOT / "stage2_preterm_main_msf.pkl"
    joblib.dump(artifact, artifact_path)
    print(f"✅ Saved main preterm artifact: {artifact_path}")

    return artifact


def train_support_preterm_model() -> dict:
    print("\n--- 🥈 SUPPORT MODEL (preterm.csv - BALANCED SIGNAL VALIDATION) ---")
    support_path = DATA_DIR / "preterm.csv"
    if not support_path.exists():
        raise FileNotFoundError(f"Support dataset not found: {support_path}")

    df = pd.read_csv(support_path)
    df.columns = df.columns.str.strip()

    if "Pre-term" not in df.columns:
        raise ValueError("Column 'Pre-term' not found in preterm.csv")

    X = df.drop(columns=["Pre-term"]).apply(pd.to_numeric, errors="coerce")
    y = pd.to_numeric(df["Pre-term"], errors="coerce").fillna(0).astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        stratify=y,
        random_state=42,
    )

    support_imputer = SimpleImputer(strategy="median")
    X_train_imp = pd.DataFrame(support_imputer.fit_transform(X_train), columns=X.columns)
    X_test_imp = pd.DataFrame(support_imputer.transform(X_test), columns=X.columns)

    support_model = RandomForestClassifier(
        n_estimators=150,
        max_depth=6,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    support_model.fit(X_train_imp, y_train)

    y_prob = support_model.predict_proba(X_test_imp)[:, 1]
    y_pred = (y_prob >= 0.5).astype(int)

    print(f"Support model ROC-AUC: {roc_auc_score(y_test, y_prob):.4f}")
    print(classification_report(y_test, y_pred, digits=4))

    print("📊 Generating SHAP explainability from support model...")
    explainer = shap.TreeExplainer(support_model)
    shap_values = explainer.shap_values(X_test_imp)

    plt.figure(figsize=(10, 6))
    if isinstance(shap_values, list):
        shap.summary_plot(shap_values[1], X_test_imp, show=False)
    else:
        shap.summary_plot(shap_values[:, :, 1], X_test_imp, show=False)
    plt.title("Support Model SHAP (Balanced Validation)", fontsize=14)
    plt.tight_layout()

    shap_path = PROJECT_ROOT / "stage2_preterm_support_shap.png"
    plt.savefig(shap_path, dpi=300, bbox_inches="tight")
    plt.close()
    print(f"✅ Saved support SHAP: {shap_path}")

    support_artifact = {
        "model": support_model,
        "imputer": support_imputer,
        "feature_columns": list(X.columns),
        "threshold": 0.5,
        "source": "preterm.csv",
    }

    support_artifact_path = PROJECT_ROOT / "stage2_preterm_support_ehg.pkl"
    joblib.dump(support_artifact, support_artifact_path)
    print(f"✅ Saved support preterm artifact: {support_artifact_path}")

    return support_artifact


def main() -> None:
    main_artifact = train_main_msf_preterm_model()
    support_artifact = train_support_preterm_model()

    summary = {
        "main_model": {
            "source": main_artifact["source"],
            "threshold": main_artifact["threshold"],
            "feature_count": len(main_artifact["feature_columns"]),
        },
        "support_model": {
            "source": support_artifact["source"],
            "threshold": support_artifact["threshold"],
            "feature_count": len(support_artifact["feature_columns"]),
        },
    }
    summary_path = PROJECT_ROOT / "stage2_preterm_training_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"\n✅ Saved training summary: {summary_path}")


if __name__ == "__main__":
    main()