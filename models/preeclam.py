# --- Data Handling & Visualization Libraries ---
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import joblib
import shap
import warnings
from pathlib import Path
# --- Machine Learning: Preprocessing & Model Selection ---
# tuning
from sklearn.model_selection import train_test_split, StratifiedKFold, GridSearchCV

from sklearn.preprocessing import LabelEncoder, StandardScaler # standardization
from sklearn.pipeline import Pipeline # Chains multiple processing steps into a single workflow

# --- Machine Learning: Algorithms ---
from sklearn.neural_network import MLPClassifier    
from sklearn.ensemble import RandomForestClassifier 
from sklearn.cluster import KMeans                  
from sklearn.impute import SimpleImputer            

# --- Machine Learning: Evaluation Metrics ---

from sklearn.metrics import (
    classification_report,  
    confusion_matrix,       
    roc_auc_score,          
    precision_recall_curve, 
    auc,                    
    silhouette_score,        
    RocCurveDisplay          
)

# --- Global Environment Settings ---
warnings.filterwarnings("ignore")
np.random.seed(42)                  
sns.set_theme(style="whitegrid")    

DATA_DIR = Path(__file__).resolve().parents[1] / "Data"


try:
    df_stage2 = pd.read_csv(DATA_DIR / "preeclampsia.csv")
except FileNotFoundError:
    raise FileNotFoundError("Critical Error: 'preeclampsia.csv' not found.")


df_stage2 = df_stage2.rename(columns={'sysbp': 'diabp', 'diabp': 'sysbp'})


df_stage2.columns = df_stage2.columns.str.strip().str.lower().str.replace(":", "", regex=False)
expected_columns = ['age','gest_age','height','weight','bmi','sysbp','diabp','hb','pcv','tsh',
                    'platelet','creatinine','plgfsflt','seng','cysc','pp_13','glycerides',
                    'htn','diabetes','fam_htn','sp_art','occupation','diet','activity','sleep']
df_stage2 = df_stage2[expected_columns]  

#--- feature typing and cleaning

numeric_cols = ['age','gest_age','height','weight','bmi','sysbp','diabp','hb','pcv','tsh',
                'platelet','creatinine','plgfsflt','seng','cysc','pp_13','glycerides']
df_stage2[numeric_cols] = df_stage2[numeric_cols].apply(pd.to_numeric, errors='coerce')

binary_cols = ['htn','diabetes','fam_htn','sp_art']
df_stage2[binary_cols] = df_stage2[binary_cols].apply(pd.to_numeric, errors='coerce')

print(" Running Unsupervised Clustering (K-Means).....")

cluster_cols = ['sysbp', 'diabp', 'plgfsflt', 'creatinine', 'seng', 'cysc', 'pp_13']

# Create feature subset for the clustering algorithm
X_cluster = df_stage2[cluster_cols]

# --- Preprocessing Pipeline for Clustering

cluster_imputer = SimpleImputer(strategy='median')
X_cluster_imp = cluster_imputer.fit_transform(X_cluster)
cluster_scaler = StandardScaler()
X_cluster_scaled = cluster_scaler.fit_transform(X_cluster_imp)

#---algorithm execution
kmeans = KMeans(n_clusters=2, random_state=42, n_init=100)
df_stage2['cluster_label'] = kmeans.fit_predict(X_cluster_scaled)

# --- Validation metric
sil = silhouette_score(X_cluster_scaled, df_stage2['cluster_label'])
print(f"Silhouette Score: {sil:.3f}")

# --- Clinical Weighting

#We extract the mathematical centers of the two clusters.
centers = kmeans.cluster_centers_
feature_weights = np.array(
    [1.0,
     1.0,
     1.3, #plgfsflt (Key Indicator: Placental Ischemia)
     1.1, #creatinine (Key Indicator: Renal Dysfunction)
     1.0,
     1.0,
     1.0])

risk_scores = np.dot(centers, feature_weights)


high_risk_cluster = np.argmax(risk_scores)

# --- Label Generation
df_stage2['phenotype_group'] = (df_stage2['cluster_label'] == high_risk_cluster).astype(int)

print(f"High-Risk Phenotype Identified: Cluster {high_risk_cluster}")
print("   -> Characterized by High sFlt-1 Ratio & Renal Stress")

# --- Class Balance Verification ---
counts = df_stage2['phenotype_group'].value_counts(normalize=True) * 100

print("\nPhenotype Distribution (%):")
print(counts)


print("\n--- Medical Sanity Check ---")
print(df_stage2.groupby('phenotype_group')[['sysbp','diabp','plgfsflt','creatinine']].mean())

#-- Supervised Classification
X2 = df_stage2[numeric_cols + binary_cols]
#Extract the Target Vector
y2 = df_stage2['phenotype_group']

# ---Preprocessing for Supervised Learning
clf_imputer = SimpleImputer(strategy='median')

# Transformation & DataFrame Reconstruction
X2_imp = pd.DataFrame(clf_imputer.fit_transform(X2), columns=X2.columns)

# --- Split Validation Strategy ---
X2_train, X2_test, y2_train, y2_test = train_test_split(
    X2_imp, y2, test_size=0.2, stratify=y2, random_state=42
)

# --- Model Definition: Random Forest Classifier ---
# An ensemble of decision trees that vote on the final diagnosis.
rf_model = RandomForestClassifier(
    n_estimators=300,
    max_depth=10,
    class_weight='balanced',

    random_state=42 
)
rf_model.fit(X2_train, y2_train)
y2_pred = rf_model.predict(X2_test)
y2_probs = rf_model.predict_proba(X2_test)[:, 1]

print("\n STAGE 2 RESULTS (Biomarker Engine):")
print(classification_report(y2_test, y2_pred))
print(f"STAGE 2 ROC-AUC: {roc_auc_score(y2_test, y2_probs):.4f}")

fig, axes = plt.subplots(1, 3, figsize=(18, 5))

sns.scatterplot(
    data=df_stage2, x='sysbp', y='plgfsflt', hue='phenotype_group',
    palette=['green', 'red'], alpha=0.6, s=80, ax=axes[0]
)
axes[0].axvline(x=140, color='black', linestyle='--', label='BP Threshold (140)')
axes[0].axhline(y=38, color='blue', linestyle='--', label='Ratio Threshold (38)')
axes[0].set_title("The 'Silent Risk' Gap (Pulse Pressure Phenotype)", fontweight='bold')
axes[0].set_xlabel("Systolic BP (mmHg)")
axes[0].set_ylabel("sFlt-1/PlGF Ratio")
axes[0].legend()

# Plot 2: Confusion Matrix (Stage 2)
cm = confusion_matrix(y2_test, y2_pred)
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=axes[1])
axes[1].set_title("Stage 2 Confusion Matrix (Diagnostic Accuracy)")
axes[1].set_xlabel("Predicted Risk")
axes[1].set_ylabel("True Phenotype")

# Plot 3: Feature Importance (Explainability)
feat_imp = pd.Series(rf_model.feature_importances_, index=X2.columns).sort_values(ascending=False).head(10)
sns.barplot(x=feat_imp.values, y=feat_imp.index, palette='viridis', ax=axes[2])
axes[2].set_title("Key Drivers of High-Risk Phenotype")
axes[2].set_xlabel("Importance (Gini)")

plt.tight_layout()
explainer_path = Path(__file__).resolve().parents[1] / "explainer.png"
plt.savefig(explainer_path, dpi=300, bbox_inches='tight')
plt.close()
print(f"Saved explainer plot: {explainer_path}")

joblib.dump(rf_model, 'stage2_diagnostic.pkl')
print("Summary: Stage 1 Screens Vitals (High Sens) -> Stage 2 Diagnoses Phenotype (High Spec).")