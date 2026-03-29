"""
Data Cleaning Script for Stage1_Master_Fused_Dataset.csv
Converts float values to integers for categorical/ordinal columns
"""

import pandas as pd
import numpy as np
from pathlib import Path

# Setup paths
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "Data"
INPUT_FILE = PROJECT_ROOT / "Stage1_Master_Fused_Dataset.csv"
OUTPUT_FILE = PROJECT_ROOT / "Stage1_Master_Fused_Dataset_Cleaned.csv"

print("🔧 CLEANING FUSED DATASET...")
print(f"📖 Reading from: {INPUT_FILE}")

# Load dataset
df = pd.read_csv(INPUT_FILE)
print(f"Original shape: {df.shape}")

# Define column categories with their proper integer ranges
CATEGORICAL_COLUMNS = {
    # Demographic/Family columns (ordinal/count)
    'Age_Father': (0, 60),           # Should be integer age
    'Yrs_Of_Marriage': (0, 30),      # Should be integer years
    'Sibling': (0, 5),               # Count of siblings
    
    # Lifestyle/Behavioral (ordinal Likert scale-like)
    'Education': (0, 7),             # Education level
    'Exercise': (1, 5),              # Frequency/intensity scale
    'Laptop': (1, 5),                # Usage frequency
    'Outside Food': (1, 5),          # Frequency
    'Tea/Coffee': (1, 4),            # Frequency
    'Cigratte': (1, 3),              # Usage (yes/no/frequency)
    'Alcohol': (1, 3),               # Usage (yes/no/frequency)
    'Work_Hours': (1, 5),            # Work hours category
    'Stress': (1, 5),                # Stress level
    'Happy': (1, 5),                 # Happiness level
    'Contraceptive_Time': (0, 5),    # Time duration
    'Intercourse': (1, 5),           # Frequency
    'depressed': (1, 5),             # Depression level
    'Time_Taken_To_Concieve': (1, 5),# Time duration
    'Family_Income': (1, 6),         # Income category
    
    # Medical/Health (binary or categorical)
    'Fertility_Treatment': (0, 2),   # Binary or categorical
    'NOISE/AIR pollution': (1, 5),   # Exposure level
    'Health Concious': (1, 5),       # Health consciousness level
    'Daily Diet': (1, 5),            # Diet quality
    'Menstrual_Cycle': (1, 5),       # Cycle regularity
    'Sleep_Pattern': (1, 5),         # Sleep quality
    'sunlight': (1, 5),              # Exposure level
    'Travel_Time': (1, 5),           # Time duration category
    'Travel_Mode': (1, 5),           # Type of transport
    'Works_As': (1, 6),              # Job category
    'Contraceptive_Type': (0, 6),    # Type of contraceptive
}

# Continuous columns that should remain float
CONTINUOUS_COLUMNS = [
    'Age', 'Systolic BP', 'Diastolic', 'BS', 'Body Temp', 'BMI',
    'Heart Rate', 'weight_before_preg', 'Height(cm)', 'Hemoglobin'
]

# Binary columns (0 or 1)
BINARY_COLUMNS = [
    'Previous Complications', 'Preexisting Diabetes', 'Gestational Diabetes',
    'Mental Health', 'PCOS'
]

df_cleaned = df.copy()

print("\n📊 CONVERSION SUMMARY:")
print("-" * 70)

# Convert categorical columns to integers
for col in CATEGORICAL_COLUMNS:
    if col in df_cleaned.columns:
        before_dtype = df_cleaned[col].dtype
        min_val, max_val = CATEGORICAL_COLUMNS[col]
        
        # Round to nearest integer with boundary clipping
        df_cleaned[col] = df_cleaned[col].round(0).astype(int)
        df_cleaned[col] = df_cleaned[col].clip(lower=min_val, upper=max_val)
        
        after_dtype = df_cleaned[col].dtype
        unique_vals = df_cleaned[col].nunique()
        print(f"✓ {col:30} | {before_dtype} → {after_dtype} | Range: [{min_val}-{max_val}] | Unique: {unique_vals}")

# Convert binary columns to integers (0 or 1)
for col in BINARY_COLUMNS:
    if col in df_cleaned.columns:
        before_dtype = df_cleaned[col].dtype
        df_cleaned[col] = df_cleaned[col].round(0).astype(int).clip(0, 1)
        after_dtype = df_cleaned[col].dtype
        print(f"✓ {col:30} | {before_dtype} → {after_dtype} (Binary)    | Unique: {df_cleaned[col].nunique()}")

# Keep continuous columns as float (already correct)
print("\n📈 CONTINUOUS COLUMNS (Kept as float64):")
for col in CONTINUOUS_COLUMNS:
    if col in df_cleaned.columns:
        print(f"  • {col:30} | float64 | Mean: {df_cleaned[col].mean():.2f}")

# Ensure target column stays as integer
if 'High_Risk_Target' in df_cleaned.columns:
    df_cleaned['High_Risk_Target'] = df_cleaned['High_Risk_Target'].astype(int)

print("\n" + "=" * 70)
print(f"✅ Data Cleaning Complete!")
print(f"Original shape: {df.shape}")
print(f"Cleaned shape:  {df_cleaned.shape}")
print(f"\n📁 Saving to: {OUTPUT_FILE}")
df_cleaned.to_csv(OUTPUT_FILE, index=False)

# Show before/after comparison
print("\n🔍 SAMPLE DATA COMPARISON (First 3 rows):")
print("\n--- BEFORE (Floats) ---")
print(df[['Age_Father', 'Yrs_Of_Marriage', 'Education', 'Exercise', 'Family_Income']].head(3))
print("\n--- AFTER (Integers) ---")
print(df_cleaned[['Age_Father', 'Yrs_Of_Marriage', 'Education', 'Exercise', 'Family_Income']].head(3))

print("\n✨ Cleaned dataset saved successfully!")
print(f"\nTo use the cleaned dataset, replace:")
print(f"  Stage1_Master_Fused_Dataset.csv  →  Stage1_Master_Fused_Dataset_Cleaned.csv")
