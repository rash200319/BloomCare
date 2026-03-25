# STAGE 2: PRETERM BIRTH PHENOTYPING ENGINE (Holistic Model)

import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.cluster import KMeans
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

DATA_DIR = Path(__file__).resolve().parents[1] / "Data"

print("\n--- Training Holistic Preterm Birth Expert Model ---")
try:
    df_preterm = pd.read_csv(DATA_DIR / "MSF_Stage1_Cleaned.csv")
    print("Preterm Dataset Loaded.")
except FileNotFoundError:
    print("Error: Preterm dataset not found.")

# Clean column headers
df_preterm.columns = df_preterm.columns.str.strip()

# 1. SELECTING A RICH, MULTI-DOMAIN FEATURE SET
preterm_rich_cols = [
    'Age_Of_Mother', 'BMI', 'Hemoglobin', 'PCOS', 'Miscarrage History', 
    'Exercise', 'Outside Food', 'NOISE/AIR pollution', 'Sleep_Pattern', 
    'Stress', 'Family_Support', 'Work_Hours'
]

# Ensure all selected columns exist (ignores any typos in column names gracefully)
valid_cols = [col for col in preterm_rich_cols if col in df_preterm.columns]
X_preterm_raw = df_preterm[valid_cols].apply(pd.to_numeric, errors='coerce')

# --- Unsupervised Clustering (Biopsychosocial Phenotype) ---
# --- Unsupervised Clustering (Biopsychosocial Phenotype) ---
# 1. Handle missing values
preterm_imputer = SimpleImputer(strategy='median')
X_preterm_imp = pd.DataFrame(preterm_imputer.fit_transform(X_preterm_raw), columns=valid_cols)

# 2. THE FIX: Outlier Clipping (Winsorization) 
# We clip the top 1% and bottom 1% of extreme values so typos don't break K-Means
lower_bounds = X_preterm_imp.quantile(0.01)
upper_bounds = X_preterm_imp.quantile(0.99)
X_preterm_clipped = X_preterm_imp.clip(lower=lower_bounds, upper=upper_bounds, axis=1)

# 3. Scale and Cluster
X_preterm_scaled = StandardScaler().fit_transform(X_preterm_clipped)

# We use K-Means to find the "High-Stress / Poor Health" cluster
kmeans_preterm = KMeans(n_clusters=2, random_state=42, n_init=50)
df_preterm['cluster_label'] = kmeans_preterm.fit_predict(X_preterm_scaled)

# Identify High-Risk Cluster based on Clinical AND Lifestyle factors
centers_preterm = kmeans_preterm.cluster_centers_

# We assign logical weights to find the bad cluster. 
hemo_idx = valid_cols.index('Hemoglobin') if 'Hemoglobin' in valid_cols else -1
stress_idx = valid_cols.index('Stress') if 'Stress' in valid_cols else -1

if hemo_idx != -1 and stress_idx != -1:
    # Cluster with lowest Hemoglobin and Highest Stress is High Risk
    risk_scores = centers_preterm[:, stress_idx] - centers_preterm[:, hemo_idx] 
    high_risk_preterm_cluster = np.argmax(risk_scores)
else:
    high_risk_preterm_cluster = 1 # Fallback

df_preterm['preterm_phenotype'] = (df_preterm['cluster_label'] == high_risk_preterm_cluster).astype(int)
print(f"High-Risk Preterm Phenotype Identified: Cluster {high_risk_preterm_cluster}")

# --- Supervised Classification ---
X_preterm_train, X_preterm_test, y_preterm_train, y_preterm_test = train_test_split(
    X_preterm_clipped, # <--- Make sure to use the clean clipped data here too!
    df_preterm['preterm_phenotype'],
    test_size=0.2,
    stratify=df_preterm['preterm_phenotype'],
    random_state=42
)

rf_model_preterm = RandomForestClassifier(n_estimators=200, max_depth=8, class_weight='balanced', random_state=42)
rf_model_preterm.fit(X_preterm_train, y_preterm_train)

print(f"Preterm Stage 2 ROC-AUC: {roc_auc_score(y_preterm_test, rf_model_preterm.predict_proba(X_preterm_test)[:, 1]):.4f}")

# Save the Preterm Engine
joblib.dump(rf_model_preterm, 'stage2_preterm_diagnostic.pkl')
joblib.dump(preterm_imputer, 'preterm_imputer.pkl')

