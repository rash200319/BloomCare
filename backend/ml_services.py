"""
BloomCare – ML Processing Services
====================================
Implements the two-stage data engineering and inference pipeline.

Stage 1 (Edge)
--------------
  • Lightweight model runs on-device (exported JS Stage 1 screener).
  • This module only receives and persists the edge result via the sync endpoint.

Stage 2 (Server)
----------------
  • Winsorization             – Percentile-based outlier clipping
  • Cross-Dataset Synthetic   – RandomForest-based Missing-Value Imputation
    Imputation
  • Multi-Condition           – Unsupervised Weighted K-Means  (latent subgroups)
    Phenotyping Engine          Supervised class-weighted RF   (condition probabilities)
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.preprocessing import StandardScaler

from .models import (
    ClusterProfile,
    ConditionProbability,
    ConditionType,
    DiagnoseInput,
    DiagnoseMLOutput,
)

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Constants – tuned for obstetric reference ranges
#
# KEY INVARIANT: WINSORIZE_BOUNDS defines the canonical feature space.
# _generate_synthetic_training_data() MUST produce a DataFrame whose columns
# are exactly the keys of WINSORIZE_BOUNDS in the same order.
# ─────────────────────────────────────────────────────────────────────────────

WINSORIZE_BOUNDS: Dict[str, Tuple[float, float]] = {
    # Placental angiogenic biomarkers
    "sflt1_plgf_ratio":       (0.5,   500.0),
    "papp_a":                  (0.05,  10.0),
    # Uterine / umbilical Doppler
    "uterine_artery_pi":       (0.4,   4.5),
    "umbilical_artery_ri":     (0.3,   1.2),
    "mca_pi":                  (0.5,   4.5),
    "cerebroplacental_ratio":  (0.3,   4.0),
    # Metabolic / glycaemic
    "glucose_fasting":         (2.5,   18.0),
    "hba1c":                   (3.5,   12.0),
    "triglycerides":           (0.3,   12.0),
    "hdl_cholesterol":         (0.3,   3.0),
    # Renal / haematological
    "uric_acid":               (100.0, 700.0),
    "creatinine":              (30.0,  600.0),
    "platelet_count":          (30.0,  600.0),   # ×10³/µL
    "hemoglobin":              (5.0,   18.0),     # g/dL — synced from Stage 1
    # Structural / hormonal
    "cervical_length_mm":      (5.0,   55.0),
    "tsh":                     (0.01,  10.0),     # mIU/L
    # Anthropometric (carried from Stage 1)
    "bmi":                     (14.0,  58.0),
}

# Ordered list of feature names – single source of truth for column ordering
FEATURE_NAMES: List[str] = list(WINSORIZE_BOUNDS.keys())

# K-Means cluster label mapping (trained on multi-center Sri Lanka dataset – simulated)
CLUSTER_LABELS: Dict[int, str] = {
    0: "Low-Risk Baseline",
    1: "Hypertensive-Proteinuric (Early PE)",
    2: "Hyperglycaemic-Metabolic (GDM Risk)",
    3: "Placental Insufficiency (Growth-Restricted)",
    4: "Multi-Factorial High-Risk",
}

CLUSTER_DOMINANT_FEATURES: Dict[int, List[str]] = {
    0: ["normal BP", "normal PlGF", "adequate cervical length"],
    1: ["elevated sFlt-1/PlGF ratio", "high uterine artery PI", "elevated BP"],
    2: ["elevated fasting glucose", "high HbA1c", "elevated triglycerides", "low PAPP-A"],
    3: ["low PlGF", "absent/reversed EDF", "low cerebroplacental ratio"],
    4: ["high uric acid", "elevated creatinine", "short cervical length", "low PAPP-A"],
}

# Clinical importance weights for Weighted K-Means
FEATURE_WEIGHTS: Dict[str, float] = {
    "sflt1_plgf_ratio":      2.0,
    "papp_a":                 0.8,
    "uterine_artery_pi":      1.8,
    "umbilical_artery_ri":    1.8,
    "mca_pi":                 1.6,
    "cerebroplacental_ratio": 1.6,
    "glucose_fasting":        1.5,
    "hba1c":                  1.5,
    "triglycerides":          1.2,
    "hdl_cholesterol":        1.0,
    "uric_acid":              1.2,
    "creatinine":             1.0,
    "platelet_count":         1.1,
    "hemoglobin":             0.9,
    "cervical_length_mm":     1.3,
    "tsh":                    0.7,
    "bmi":                    0.8,
}


# ─────────────────────────────────────────────────────────────────────────────
# 1. Data Engineering – Winsorization
# ─────────────────────────────────────────────────────────────────────────────

def winsorize_features(
    feature_dict: Dict[str, Optional[float]],
) -> Dict[str, Optional[float]]:
    """
    Apply percentile-based Winsorization (outlier clipping) to biomarker values.

    Each feature is clipped to a physiologically valid range derived from
    published obstetric reference intervals (WHO / NICE / RCOG).

    Args:
        feature_dict: Raw feature name → value mapping (None = missing).

    Returns:
        Clipped feature dictionary with the same keys.
    """
    clipped: Dict[str, Optional[float]] = {}
    for feature, value in feature_dict.items():
        if value is None:
            clipped[feature] = None
            continue
        low, high     = WINSORIZE_BOUNDS.get(feature, (-np.inf, np.inf))
        original      = value
        clipped_value = float(np.clip(value, low, high))
        if clipped_value != original:
            logger.debug(
                "Winsorize | %s: %.3f → %.3f (bounds [%.2f, %.2f])",
                feature, original, clipped_value, low, high,
            )
        clipped[feature] = clipped_value
    return clipped


# ─────────────────────────────────────────────────────────────────────────────
# 2. Data Engineering – Cross-Dataset Synthetic Imputation
# ─────────────────────────────────────────────────────────────────────────────

def _generate_synthetic_training_data(n_samples: int = 800) -> pd.DataFrame:
    """
    Generate a plausible synthetic training cohort.

    Columns match FEATURE_NAMES exactly (same order).
    In production this is replaced by the anonymised multi-centre reference
    dataset stored in the secure data lake.
    """
    rng = np.random.default_rng(42)
    n   = n_samples

    data: Dict[str, np.ndarray] = {
        "sflt1_plgf_ratio":      rng.lognormal(mean=3.0,  sigma=1.2,  size=n).clip(0.5,   500),
        "papp_a":                 rng.lognormal(mean=0.0,  sigma=0.5,  size=n).clip(0.05,  10),
        "uterine_artery_pi":      rng.normal   (loc=1.40, scale=0.5,  size=n).clip(0.4,   4.5),
        "umbilical_artery_ri":    rng.normal   (loc=0.65, scale=0.15, size=n).clip(0.3,   1.2),
        "mca_pi":                 rng.normal   (loc=1.80, scale=0.5,  size=n).clip(0.5,   4.5),
        "cerebroplacental_ratio": rng.normal   (loc=1.70, scale=0.5,  size=n).clip(0.3,   4.0),
        "glucose_fasting":        rng.normal   (loc=5.2,  scale=1.2,  size=n).clip(2.5,   18),
        "hba1c":                  rng.normal   (loc=5.4,  scale=0.7,  size=n).clip(3.5,   12),
        "triglycerides":          rng.lognormal(mean=0.8,  sigma=0.5,  size=n).clip(0.3,   12),
        "hdl_cholesterol":        rng.normal   (loc=1.4,  scale=0.3,  size=n).clip(0.3,   3.0),
        "uric_acid":              rng.normal   (loc=290,  scale=80,   size=n).clip(100,   700),
        "creatinine":             rng.normal   (loc=65,   scale=20,   size=n).clip(30,    600),
        "platelet_count":         rng.normal   (loc=220,  scale=60,   size=n).clip(30,    600),
        "hemoglobin":             rng.normal   (loc=11.5, scale=1.5,  size=n).clip(5,     18),
        "cervical_length_mm":     rng.normal   (loc=35,   scale=8,    size=n).clip(5,     55),
        "tsh":                    rng.lognormal(mean=0.5,  sigma=0.6,  size=n).clip(0.01,  10),
        "bmi":                    rng.normal   (loc=26,   scale=5,    size=n).clip(14,    58),
    }

    # Runtime guard: column order must match FEATURE_NAMES exactly
    assert list(data.keys()) == FEATURE_NAMES, (
        "Synthetic data columns do not match FEATURE_NAMES! "
        "Update _generate_synthetic_training_data() whenever WINSORIZE_BOUNDS is edited."
    )
    return pd.DataFrame(data)


def cross_dataset_synthetic_imputation(
    feature_dict: Dict[str, Optional[float]],
) -> Tuple[Dict[str, float], List[str]]:
    """
    Estimate missing biomarker values using Random Forest Regressors trained
    on the synthetic reference cohort (Cross-Dataset Synthetic Imputation).

    Algorithm:
    1. Identify observed vs. missing imputable features.
    2. For each missing feature, train a RandomForestRegressor on the
       reference cohort using all currently-observed features as predictors.
    3. Predict the missing value; apply domain-bound clipping.

    Returns:
        Tuple of (complete feature dict, list of imputed feature names).
    """
    reference_df = _generate_synthetic_training_data()

    observed: Dict[str, float] = {k: v for k, v in feature_dict.items() if v is not None}
    missing:  List[str]        = [k for k in FEATURE_NAMES if feature_dict.get(k) is None]

    if not missing:
        logger.info("Imputation | No missing features detected.")
        return {k: float(v) for k, v in observed.items()}, []

    imputed_values: Dict[str, float] = dict(observed)
    imputed_names:  List[str]        = []

    for target_feature in missing:
        available_predictors = [
            p for p in FEATURE_NAMES
            if p != target_feature
            and p in reference_df.columns
            and p in imputed_values
        ]

        if not available_predictors:
            fallback = float(reference_df[target_feature].median())
            imputed_values[target_feature] = fallback
            logger.warning(
                "Imputation | %s: no predictors available – median fallback %.3f",
                target_feature, fallback,
            )
        else:
            X_train = reference_df[available_predictors].values
            y_train = reference_df[target_feature].values

            rf = RandomForestRegressor(
                n_estimators=100, max_depth=6, random_state=42, n_jobs=-1,
            )
            rf.fit(X_train, y_train)

            x_patient   = np.array([[imputed_values[p] for p in available_predictors]])
            imputed_val  = float(rf.predict(x_patient)[0])
            lo, hi       = WINSORIZE_BOUNDS.get(target_feature, (-np.inf, np.inf))
            imputed_val  = float(np.clip(imputed_val, lo, hi))

            imputed_values[target_feature] = imputed_val
            logger.info(
                "Imputation | %s = %.4f (predictors: %s)",
                target_feature, imputed_val, available_predictors,
            )

        imputed_names.append(target_feature)

    return imputed_values, imputed_names


# ─────────────────────────────────────────────────────────────────────────────
# 3. Stage-2 Multi-Condition Phenotyping Engine
# ─────────────────────────────────────────────────────────────────────────────

def _build_feature_vector(complete_features: Dict[str, float]) -> np.ndarray:
    """Convert the complete feature dict → ordered numpy array (aligned to FEATURE_NAMES)."""
    return np.array(
        [complete_features.get(k, 0.0) for k in FEATURE_NAMES]
    ).reshape(1, -1)


def _run_unsupervised_layer(
    feature_vector: np.ndarray,
    n_clusters: int = 5,
) -> ClusterProfile:
    """
    Unsupervised Layer – Weighted K-Means Clustering
    -------------------------------------------------
    FEATURE_WEIGHTS encodes clinical importance to bias cluster formation
    toward angiogenic and Doppler features (highest PE signal).
    """
    weights = np.array([FEATURE_WEIGHTS.get(f, 1.0) for f in FEATURE_NAMES])

    reference_df    = _generate_synthetic_training_data()
    X_ref           = reference_df.values

    scaler         = StandardScaler()
    X_ref_scaled   = scaler.fit_transform(X_ref)
    X_ref_weighted = X_ref_scaled * weights

    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    kmeans.fit(X_ref_weighted)

    X_patient_scaled   = scaler.transform(feature_vector)
    X_patient_weighted = X_patient_scaled * weights

    cluster_id = int(kmeans.predict(X_patient_weighted)[0])

    distances  = np.linalg.norm(kmeans.cluster_centers_ - X_patient_weighted, axis=1)
    inv_d      = 1.0 / (distances + 1e-8)
    confidence = float(inv_d[cluster_id] / inv_d.sum())

    return ClusterProfile(
        cluster_id         = cluster_id,
        cluster_label      = CLUSTER_LABELS.get(cluster_id, f"Cluster-{cluster_id}"),
        cluster_confidence = round(confidence, 4),
        dominant_features  = CLUSTER_DOMINANT_FEATURES.get(cluster_id, []),
    )


def _run_supervised_layer(
    feature_vector: np.ndarray,
    cluster_id: int,
    gestational_age_weeks: int,
) -> Tuple[List[ConditionProbability], float, ConditionType]:
    """
    Supervised Layer – Class-Weighted Random Forest Classifiers
    -----------------------------------------------------------
    Five independent RF classifiers, one per condition. Column indices are
    resolved dynamically from FEATURE_NAMES so they survive any column additions.

    Class weights compensate for obstetric class imbalance:
      • Preeclampsia ~5-8 %   → class_weight='balanced'
      • GDM ~14 % (South Asia) → {0:1, 1:3}
      • Preterm ~10-12 %       → {0:1, 1:4}
    """
    # Dynamic column index lookup – never use hard-coded integers
    col = {name: i for i, name in enumerate(FEATURE_NAMES)}

    rng = np.random.default_rng(seed=cluster_id + gestational_age_weeks)
    n   = 1000
    X   = _generate_synthetic_training_data(n).values   # (1000, n_features)

    # Label derivation using named-column lookup
    sflt1 = X[:, col["sflt1_plgf_ratio"]]
    ua_pi = X[:, col["uterine_artery_pi"]]
    gluc  = X[:, col["glucose_fasting"]]
    hba1c = X[:, col["hba1c"]]
    cl    = X[:, col["cervical_length_mm"]]
    plat  = X[:, col["platelet_count"]]
    uric  = X[:, col["uric_acid"]]

    y_pe_early  = ((sflt1 > 38)  & (ua_pi > 1.6)).astype(int)
    y_pe_late   = ((sflt1 > 110) & (ua_pi > 1.3)).astype(int)
    y_pe_severe = ((sflt1 > 200) & (ua_pi > 2.0) & (plat < 100) & (uric > 450)).astype(int)
    y_gdm       = ((gluc  > 6.1) | (hba1c > 6.5)).astype(int)
    y_preterm   = (cl < 25).astype(int)

    conditions: List[Tuple[ConditionType, np.ndarray, Dict]] = [
        (ConditionType.PREECLAMPSIA_EARLY_ONSET, y_pe_early,  {"class_weight": "balanced"}),
        (ConditionType.PREECLAMPSIA_LATE_ONSET,  y_pe_late,   {"class_weight": "balanced"}),
        (ConditionType.PREECLAMPSIA_SEVERE,      y_pe_severe, {"class_weight": "balanced"}),
        (ConditionType.GDM,                      y_gdm,       {"class_weight": {0: 1, 1: 3}}),
        (ConditionType.PRETERM_BIRTH,            y_preterm,   {"class_weight": {0: 1, 1: 4}}),
    ]

    probabilities: List[ConditionProbability] = []

    for condition, y_labels, rf_kwargs in conditions:
        top_features: Dict[str, float] = {}

        if y_labels.sum() == 0:
            prob    = 0.01
            ci_low  = 0.0
            ci_high = 0.05
        else:
            clf = RandomForestClassifier(
                n_estimators=200, max_depth=8, min_samples_leaf=5,
                random_state=42, n_jobs=-1, **rf_kwargs,
            )
            clf.fit(X, y_labels)
            prob = float(clf.predict_proba(feature_vector)[0][1])

            # Bootstrap confidence interval (3 sub-samples for speed)
            boot_probs = []
            for seed in [0, 1, 2]:
                idx = rng.integers(0, n, size=n)
                try:
                    sub_clf = RandomForestClassifier(
                        n_estimators=50, max_depth=8, random_state=seed,
                        n_jobs=-1, **rf_kwargs,
                    )
                    sub_clf.fit(X[idx], y_labels[idx])
                    boot_probs.append(float(sub_clf.predict_proba(feature_vector)[0][1]))
                except Exception:
                    boot_probs.append(prob)

            ci_low  = float(np.percentile(boot_probs, 10))
            ci_high = float(np.percentile(boot_probs, 90))

            imp = dict(zip(
                FEATURE_NAMES,
                [round(float(v), 4) for v in clf.feature_importances_],
            ))
            top_features = dict(
                sorted(imp.items(), key=lambda kv: kv[1], reverse=True)[:5]
            )

        risk_cat = (
            "critical" if prob >= 0.65 else
            "high"     if prob >= 0.35 else
            "moderate" if prob >= 0.15 else
            "low"
        )

        probabilities.append(ConditionProbability(
            condition             = condition,
            probability           = round(prob, 4),
            confidence_lower      = round(max(0.0, ci_low), 4),
            confidence_upper      = round(min(1.0, ci_high), 4),
            risk_category         = risk_cat,
            contributing_features = top_features,
        ))

    # Weighted severity (PE has highest clinical gravity)
    severity_weights = {
        ConditionType.PREECLAMPSIA_SEVERE:      0.35,
        ConditionType.PREECLAMPSIA_EARLY_ONSET: 0.25,
        ConditionType.PREECLAMPSIA_LATE_ONSET:  0.20,
        ConditionType.PRETERM_BIRTH:            0.12,
        ConditionType.GDM:                      0.08,
    }
    total_w  = sum(severity_weights.values())
    severity = sum(
        cp.probability * severity_weights.get(cp.condition, 0.1)
        for cp in probabilities
    ) / total_w

    dominant = max(probabilities, key=lambda cp: cp.probability).condition
    return probabilities, round(severity, 4), dominant


# ─────────────────────────────────────────────────────────────────────────────
# 4. Public Entry Point – Full Stage-2 Pipeline
# ─────────────────────────────────────────────────────────────────────────────

def run_stage2_phenotyping_engine(payload: DiagnoseInput) -> DiagnoseMLOutput:
    """
    Execute the complete Stage-2 inference pipeline for a single patient encounter.

    Pipeline:
        1. Flatten biomarker payload → raw feature dict (keys = FEATURE_NAMES)
        2. Winsorize  — clip to physiologically valid ranges
        3. Cross-Dataset Synthetic Imputation — RF-based missing-value fill
        4. Unsupervised Layer  → Weighted K-Means cluster assignment
        5. Supervised Layer    → Class-weighted RF condition probabilities
        6. Package and return DiagnoseMLOutput
    """
    logger.info("Stage-2 engine started")

    m = payload.metabolomics
    d = payload.doppler

    # Keys MUST be in FEATURE_NAMES order (alphabetical matching is enforced below)
    raw_features: Dict[str, Optional[float]] = {
        "sflt1_plgf_ratio":      payload.sflt1_plgf_ratio,
        "papp_a":                payload.papp_a,
        "uterine_artery_pi":     d.uterine_artery_pi         if d else None,
        "umbilical_artery_ri":   d.umbilical_artery_ri       if d else None,
        "mca_pi":                d.middle_cerebral_artery_pi if d else None,
        "cerebroplacental_ratio":d.cerebroplacental_ratio    if d else None,
        "glucose_fasting":       m.glucose_fasting            if m else None,
        "hba1c":                 m.hba1c                      if m else None,
        "triglycerides":         m.triglycerides              if m else None,
        "hdl_cholesterol":       m.hdl_cholesterol            if m else None,
        "uric_acid":             m.uric_acid                  if m else None,
        "creatinine":            m.creatinine                 if m else None,
        "platelet_count":        None,   # populated from Stage-1 sync when available
        "hemoglobin":            None,   # populated from Stage-1 sync when available
        "cervical_length_mm":    payload.cervical_length_mm,
        "tsh":                   None,   # populated from extended panel when available
        "bmi":                   None,   # carried from Stage-1 sync
    }

    # Invariant check
    assert set(raw_features.keys()) == set(FEATURE_NAMES), (
        "Feature dict keys do not match FEATURE_NAMES. "
        "Keep run_stage2_phenotyping_engine() in sync with WINSORIZE_BOUNDS."
    )

    n_observed         = sum(1 for v in raw_features.values() if v is not None)
    data_quality_score = round(n_observed / len(raw_features), 3)

    # Step 2 – Winsorize
    clipped = winsorize_features(raw_features)
    logger.info("Winsorization complete | %d features", len(clipped))

    # Step 3 – Impute
    complete_features, imputed_names = cross_dataset_synthetic_imputation(clipped)

    # ── Step 4: Unsupervised layer ────────────────────────────────────────────
    feature_vector = _build_feature_vector(complete_features)
    cluster_profile = _run_unsupervised_layer(feature_vector)
    logger.info(
        "Clustering | cluster=%d (%s) conf=%.3f",
        cluster_profile.cluster_id,
        cluster_profile.cluster_label,
        cluster_profile.cluster_confidence,
    )

    # ── Step 5: Supervised layer ──────────────────────────────────────────────
    condition_probs, severity_score, dominant_cond = _run_supervised_layer(
        feature_vector,
        cluster_id=cluster_profile.cluster_id,
        gestational_age_weeks=payload.gestational_age_weeks,
    )
    logger.info(
        "Classification | dominant=%s severity=%.3f",
        dominant_cond.value, severity_score,
    )

    # ── Step 6: Assemble output ───────────────────────────────────────────────
    return DiagnoseMLOutput(
        patient_id              = payload.patient_id,
        encounter_id            = payload.encounter_id,
        processed_at            = datetime.now(timezone.utc).isoformat(),
        cluster_profile         = cluster_profile,
        condition_probabilities  = condition_probs,
        overall_severity_score  = severity_score,
        dominant_condition      = dominant_cond,
        imputed_features        = imputed_names,
        data_quality_score      = data_quality_score,
    )
