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

# --- ERROR HANDLING & DATA LOADING ---
try:
   
    df_stage1 = pd.read_csv(DATA_DIR / "Dataset - Updated.csv")
    print(" Dataset 1 Loaded (Vitals Data).")

except FileNotFoundError:
    print(" Error: 'Dataset - Updated.csv' not found. Skipping Stage 1.")


df_stage1.fillna(df_stage1.median(numeric_only=True), inplace=True)

df_stage1['General_Risk_Flag'] = df_stage1['Risk Level'].apply(
    lambda x: 0 if str(x).strip().lower() == 'low' else 1
)

# --- FEATURE ENGINEERING: CALCULATING MEAN ARTERIAL PRESSURE (MAP) ---

df_stage1['MAP'] = (df_stage1['Systolic BP'] + 2 * df_stage1['Diastolic']) / 3

# --- SYNTHETIC FEATURE SIMULATION (Environmental & Socioeconomic Factors) ---

# (0=Low, 1=Moderate, 2=High).
df_stage1['Heat_Exposure'] = np.random.choice([0, 1, 2], size=len(df_stage1), p=[0.25, 0.35, 0.40])

# (0=Clean, 1=Moderate, 2=Polluted).
df_stage1['Air_Pollution'] = np.random.choice([0, 1, 2], size=len(df_stage1), p=[0.30, 0.40, 0.30])

# (0=High Access, 1=Moderate, 2=Low Access).
df_stage1['Access_To_Care'] = np.random.choice([0, 1, 2], size=len(df_stage1), p=[0.45, 0.35, 0.20])

# --- DOMAIN-DRIVEN DATA OVERRIDE (Expert Logic) ---

df_stage1.loc[df_stage1['Systolic BP'] > 140, 'Heat_Exposure'] = 2

# --- DATA SPLITTING: FEATURES (X) vs. TARGET (y) ---

X1 = df_stage1.drop(columns=['General_Risk_Flag', 'Risk Level'])
y1 = df_stage1['General_Risk_Flag']

# --- DATA PARTITIONING: TRAIN/TEST SPLIT ---
X1_train, X1_test, y1_train, y1_test = train_test_split(X1, y1, test_size=0.2, stratify=y1, random_state=42)

# --- MACHINE LEARNING PIPELINE: STANDARDIZATION & NEURAL NETWORK ---
pipeline_stage1 = Pipeline([
    ('scaler', StandardScaler()),
    ('mlp', MLPClassifier(hidden_layer_sizes=(64, 32), max_iter=500, random_state=42))
])

# --- MODEL TRAINING (THE LEARNING PHASE) ---
pipeline_stage1.fit(X1_train, y1_train)

# --- STAGE 1 EVALUATION (TESTING THE AI'S KNOWLEDGE) ---

y1_probs = pipeline_stage1.predict_proba(X1_test)[:, 1]
y1_pred = pipeline_stage1.predict(X1_test)
print("\n STAGE 1 RESULTS (Neural Network):")
print(classification_report(y1_test, y1_pred))
print(f"STAGE 1 ROC-AUC: {roc_auc_score(y1_test, y1_probs):.4f}")


# --- STAGE 1 VISUALIZATION: PRECISION-RECALL CURVE ---

precision, recall, _ = precision_recall_curve(y1_test, y1_probs)
pr_auc = auc(recall, precision)

plt.figure(figsize=(6, 4))
plt.plot(recall, precision, label=f'NN Screener (AUC = {pr_auc:.2f})', color='purple', linewidth=2)

# Labeling and Formatting:
plt.xlabel('Recall (Sensitivity)')
plt.ylabel('Precision')          
plt.title('Stage 1: Screening Performance (High Sensitivity)')
plt.legend()
plt.grid(True, alpha=0.3)
plt.show()

# --- STAGE 1 PERFORMANCE REPORT: CONFUSION MATRIX ---

sns.heatmap(confusion_matrix(y1_test, y1_pred),
            annot=True, fmt='d', cmap='Purples')

# Labeling for clarity:
plt.title("Stage 1 Confusion Matrix (Screening)")
plt.xlabel("Predicted") 
plt.ylabel("Actual")    
plt.show()

joblib.dump(pipeline_stage1, 'stage1_screener.pkl')