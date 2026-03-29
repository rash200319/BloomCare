import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor

# 1. Load the Main Target Dataset
df_gdm = pd.read_csv("Gestational Diabetic Dat Set.csv")
df_gdm.columns = df_gdm.columns.str.strip()

# 2. Load the External Datasets for Sys BP Transfer Learning
df_updated = pd.read_csv("Dataset - Updated.csv")
df_pre = pd.read_csv("preeclampsia.csv")

df_updated.columns = df_updated.columns.str.strip()
df_pre.columns = df_pre.columns.str.strip()

print("Initial Missing Sys BP:", df_gdm['Sys BP'].isna().sum())
print("Initial Missing OGTT:", df_gdm['OGTT'].isna().sum())

# =====================================================================
# TASK 1: CROSS-DATASET TRANSFER LEARNING FOR 'SYS BP'
# =====================================================================

# Extract Age, Dia BP, and Sys BP from 'Dataset - Updated'
ext1 = df_updated[['Age', 'Diastolic', 'Systolic BP']].dropna().rename(
    columns={'Diastolic': 'Dia_BP', 'Systolic BP': 'Sys_BP'}
)

# Extract Age, Dia BP, and Sys BP from 'preeclampsia' dataset
ext2 = df_pre[['age', 'diabp', 'sysbp']].dropna().rename(
    columns={'age': 'Age', 'diabp': 'Sys_BP', 'sysbp': 'Dia_BP'}
)

# Combine external datasets to create a massive BP training set
df_bp_train = pd.concat([ext1, ext2], ignore_index=True)

# Train the Transfer Learning Model for Sys BP
X_bp = df_bp_train[['Age', 'Dia_BP']]
y_bp = df_bp_train['Sys_BP']

sysbp_model = RandomForestRegressor(n_estimators=100, random_state=42)
sysbp_model.fit(X_bp, y_bp)

# Predict missing Sys BP in our main GDM dataset
missing_sysbp = df_gdm['Sys BP'].isna()
X_missing_sysbp = df_gdm.loc[missing_sysbp, ['Age', 'Dia BP']].rename(columns={'Dia BP': 'Dia_BP'})

if not X_missing_sysbp.empty:
    df_gdm.loc[missing_sysbp, 'Sys BP'] = np.round(sysbp_model.predict(X_missing_sysbp))


# =====================================================================
# TASK 2: INTERNAL ML IMPUTATION FOR 'OGTT'
# =====================================================================

# We use features that strongly correlate with metabolic health
ogtt_features = ['Age', 'Sys BP', 'Dia BP', 'Hemoglobin', 'Class Label(GDM /Non GDM)']

# Grab the rows that HAVE an OGTT value to train our model
df_ogtt_train = df_gdm.dropna(subset=['OGTT'] + ogtt_features)
X_ogtt = df_ogtt_train[ogtt_features]
y_ogtt = df_ogtt_train['OGTT']

# Train an internal ML model to predict OGTT
ogtt_model = RandomForestRegressor(n_estimators=100, random_state=42)
ogtt_model.fit(X_ogtt, y_ogtt)

# Predict the missing 513 OGTT values
missing_ogtt = df_gdm['OGTT'].isna()
X_missing_ogtt = df_gdm.loc[missing_ogtt, ogtt_features]

if not X_missing_ogtt.empty:
    # We round it because OGTT is measured in whole numbers (mg/dL)
    df_gdm.loc[missing_ogtt, 'OGTT'] = np.round(ogtt_model.predict(X_missing_ogtt))

print("\nFinal Missing Sys BP:", df_gdm['Sys BP'].isna().sum())
print("Final Missing OGTT:", df_gdm['OGTT'].isna().sum())

# Save the clinically accurate dataset
df_gdm.to_csv("GDM_Dataset_Enterprise_Imputed.csv", index=False)
print("\nSuccess! Saved to GDM_Dataset_Enterprise_Imputed.csv")