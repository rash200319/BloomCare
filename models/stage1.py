# --- Data Handling & Visualization Libraries ---
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import joblib
import warnings
from pathlib import Path

# --- Machine Learning Libraries ---
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.impute import KNNImputer
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (classification_report, confusion_matrix, 
                             roc_auc_score, precision_recall_curve, auc)

# --- Global Settings ---
warnings.filterwarnings("ignore")
np.random.seed(42)                  
sns.set_theme(style="whitegrid")    

print(" INITIALIZING MULTI-MODAL DATA FUSION...")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "Data"

# --- 1. LOAD & STANDARDIZE DATASET 1 (Clinical Vitals) ---
df_updated = pd.read_csv(DATA_DIR / "Dataset - Updated.csv")
df_updated = df_updated.dropna(subset=['Risk Level']) # Drop if target is missing

# Convert Target: "Low" = 0 (Normal), "High"/"Mid" = 1 (High Risk)
df_updated['High_Risk_Target'] = df_updated['Risk Level'].astype(str).str.strip().str.lower().apply(
    lambda x: 0 if x == 'low' else 1
)
df_updated = df_updated.drop(columns=['Risk Level'])

# --- 2. LOAD & STANDARDIZE DATASET 2 (Biopsychosocial) ---
df_msf = pd.read_csv(DATA_DIR / "MSF_Stage1_Cleaned.csv")

# Align column names to match Dataset 1
df_msf = df_msf.rename(columns={
    'Age_Of_Mother': 'Age', 
    'Issues_Pregnancy': 'High_Risk_Target'
})
# Drop unique IDs as they hold no predictive power
df_msf = df_msf.drop(columns=['Mother_UID'], errors='ignore')

# --- 3. CONCATENATE INTO ONE MASSIVE DATASET ---
df_master = pd.concat([df_updated, df_msf], ignore_index=True)
print(f" Datasets merged! Total Master Rows: {len(df_master)}")

# --- 4. DATA SPLITTING (To Prevent Leakage) ---
X = df_master.drop(columns=['High_Risk_Target'])
y = df_master['High_Risk_Target']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)

# --- 5. THE DATA FUSION PIPELINE (KNN Imputation + Random Forest) ---
# We use KNN Imputer to cross-pollinate missing features between the two datasets
pipeline_stage1 = Pipeline([
    ('knn_imputer', KNNImputer(n_neighbors=5, weights='distance')), 
    ('scaler', StandardScaler()),
    ('rf_model', RandomForestClassifier(n_estimators=100, class_weight='balanced', random_state=42))
])

print("Training Unified Model and Imputing Missing Modalities...")
pipeline_stage1.fit(X_train, y_train)

# --- 6. EVALUATION & METRICS ---
y_probs = pipeline_stage1.predict_proba(X_test)[:, 1]
y_pred = pipeline_stage1.predict(X_test)

print("\n STAGE 1 RESULTS: UNIFIED MULTI-MODAL SCREENER")
print("-" * 60)
print(classification_report(y_test, y_pred))
print(f" ROC-AUC SCORE: {roc_auc_score(y_test, y_probs):.4f}")

# --- 7. EXPORT DATA AND MODEL ---
# Save the imputed dataset so the judges can literally look at your "Data Fusion"
X_full_imputed = pd.DataFrame(pipeline_stage1.named_steps['knn_imputer'].transform(X), columns=X.columns)
df_fused_final = pd.concat([X_full_imputed, y.reset_index(drop=True)], axis=1)
df_fused_final.to_csv(PROJECT_ROOT / "Stage1_Master_Fused_Dataset.csv", index=False)
print("\n Unified Dataset exported as 'Stage1_Master_Fused_Dataset.csv'")

# Save the enterprise model
joblib.dump(pipeline_stage1, PROJECT_ROOT / 'stage1_multimodal_screener.pkl')
print(" Master Model successfully exported as 'stage1_multimodal_screener.pkl'")