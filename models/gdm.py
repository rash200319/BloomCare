
# STAGE 2: GESTATIONAL DIABETES (GDM) PHENOTYPING ENGINE

import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.cluster import KMeans
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

DATA_DIR = Path(__file__).resolve().parents[1] / "Data"

print("\n--- Training GDM Expert Model ---")
try:
    # Load both datasets
    df_gdm = pd.read_csv(DATA_DIR / "Gestational Diabetic Dat Set.csv")
    df_bmi = pd.read_csv(DATA_DIR / "Gestational Diabetes.csv")
    print("Both GDM Datasets Loaded Successfully.")
except FileNotFoundError:
    print("Error: One or both GDM datasets not found.")

# Clean column headers
df_gdm.columns = df_gdm.columns.str.strip()
df_bmi.columns = df_bmi.columns.str.strip()

# ---------------------------------------------------------------------
# AI FEATURE ENGINEERING: Cross-Dataset Synthetic Imputation
# ---------------------------------------------------------------------
print("Synthesizing missing BMI data using Transfer Learning...")

# 1. Clean the smaller dataset (The 'Teacher')
df_bmi_clean = df_bmi.dropna(subset=['Age', 'Pregnancy No', 'BMI'])

# 2. Train a Regressor to predict BMI based on Age and Pregnancy No
bmi_imputer_model = RandomForestRegressor(n_estimators=100, random_state=42)
bmi_imputer_model.fit(df_bmi_clean[['Age', 'Pregnancy No']], df_bmi_clean['BMI'])

# 3. Clean the 'Age' and 'No of Pregnancy' in the massive dataset (The 'Student')
df_gdm['Age'] = pd.to_numeric(df_gdm['Age'], errors='coerce')
df_gdm['No of Pregnancy'] = pd.to_numeric(df_gdm['No of Pregnancy'], errors='coerce')
df_gdm['Age'] = df_gdm['Age'].fillna(df_gdm['Age'].median())
df_gdm['No of Pregnancy'] = df_gdm['No of Pregnancy'].fillna(df_gdm['No of Pregnancy'].median())

# 4. Predict the missing BMI values
X_predict_bmi = df_gdm[['Age', 'No of Pregnancy']].rename(columns={'No of Pregnancy': 'Pregnancy No'})
df_gdm['BMI_Synthetic'] = bmi_imputer_model.predict(X_predict_bmi)

# 5. Merge the real BMI (if it exists) with the Synthetic BMI
df_gdm['BMI'] = pd.to_numeric(df_gdm['BMI'], errors='coerce')
df_gdm['BMI'] = df_gdm['BMI'].fillna(df_gdm['BMI_Synthetic'])
print(f"Successfully synthesized BMI for missing rows!")

# ---------------------------------------------------------------------
# CORE PIPELINE: Clustering & Classification
# ---------------------------------------------------------------------
gdm_numeric_cols = ['Age', 'No of Pregnancy', 'BMI', 'HDL', 'Sys BP', 'Dia BP', 'OGTT', 'Hemoglobin']
df_gdm[gdm_numeric_cols] = df_gdm[gdm_numeric_cols].apply(pd.to_numeric, errors='coerce')

# --- Unsupervised Clustering (Metabolic Phenotype) ---
# Notice we have now safely added 'BMI' to our clustering logic!
gdm_cluster_cols = ['OGTT', 'Hemoglobin', 'Sys BP', 'HDL', 'BMI']
X_gdm_cluster = df_gdm[gdm_cluster_cols]

gdm_imputer = SimpleImputer(strategy='median')
X_gdm_cluster_scaled = StandardScaler().fit_transform(gdm_imputer.fit_transform(X_gdm_cluster))

kmeans_gdm = KMeans(n_clusters=2, random_state=42, n_init=50)
df_gdm['cluster_label'] = kmeans_gdm.fit_predict(X_gdm_cluster_scaled)

# Identify the high-risk metabolic cluster 
centers_gdm = kmeans_gdm.cluster_centers_
# Weights: High OGTT (1.5), High BP (1.0), High Hemoglobin (1.0), High BMI (1.2), High HDL is GOOD (-1.0)
gdm_feature_weights = np.array([1.5, 1.0, 1.0, -1.0, 1.2]) 
gdm_risk_scores = np.dot(centers_gdm, gdm_feature_weights)
high_risk_gdm_cluster = np.argmax(gdm_risk_scores)

df_gdm['gdm_phenotype'] = (df_gdm['cluster_label'] == high_risk_gdm_cluster).astype(int)
print(f"High-Risk GDM Phenotype Identified: Cluster {high_risk_gdm_cluster}")

# --- Supervised Classification ---
X_gdm = df_gdm.drop(columns=['Case Number', 'Class Label(GDM /Non GDM)', 'cluster_label', 'gdm_phenotype', 'BMI_Synthetic'])
y_gdm = df_gdm['gdm_phenotype']

X_gdm_imp = pd.DataFrame(gdm_imputer.fit_transform(X_gdm), columns=X_gdm.columns)
X_gdm_train, X_gdm_test, y_gdm_train, y_gdm_test = train_test_split(X_gdm_imp, y_gdm, test_size=0.2, stratify=y_gdm, random_state=42)

rf_model_gdm = RandomForestClassifier(n_estimators=200, max_depth=8, class_weight='balanced', random_state=42)
rf_model_gdm.fit(X_gdm_train, y_gdm_train)

print(f"GDM Stage 2 ROC-AUC: {roc_auc_score(y_gdm_test, rf_model_gdm.predict_proba(X_gdm_test)[:, 1]):.4f}")

# Save the GDM Engine and Imputers
joblib.dump(rf_model_gdm, 'stage2_gdm_diagnostic.pkl')
joblib.dump(gdm_imputer, 'gdm_imputer.pkl')
joblib.dump(bmi_imputer_model, 'bmi_synthetic_imputer.pkl') # Save this so the patient app can use it!