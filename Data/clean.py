import pandas as pd
import numpy as np

# 1. Load the MSF Dataset
df_msf = pd.read_csv("MSF_Dataset_Complete_450.csv")

# 2. Drop all the "Ghost" Unnamed columns
df_msf = df_msf.loc[:, ~df_msf.columns.str.contains('^Unnamed')]

# 3. Drop columns with more than 50% missing data (they add too much noise)
threshold = len(df_msf) * 0.5
df_msf = df_msf.dropna(thresh=threshold, axis=1)

# 4. Drop weirdly named arbitrary columns (like '1', '2', '9(a)')
cols_to_drop = ['1', '2', '3', '4', '5', '9(a)', '9(b)', '9(c )', '12']
df_msf = df_msf.drop(columns=[col for col in cols_to_drop if col in df_msf.columns])

# 5. Impute the remaining missing values
# For numerical columns (like Age, BMI), we use the median
for col in df_msf.select_dtypes(include=['float64', 'int64']).columns:
    df_msf[col] = df_msf[col].fillna(df_msf[col].median())

# For categorical/text columns, we use the mode (most common answer)
for col in df_msf.select_dtypes(include=['object']).columns:
    df_msf[col] = df_msf[col].fillna(df_msf[col].mode()[0])

print("Total columns after cleaning:", len(df_msf.columns))
print("Target Variable (Issues_Pregnancy) distribution:\n", df_msf['Issues_Pregnancy'].value_counts())

# Save the pristine dataset for Stage 1 training
df_msf.to_csv("MSF_Stage1_Cleaned.csv", index=False)