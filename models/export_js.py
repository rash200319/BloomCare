import joblib
import m2cgen as m2c
from pathlib import Path

# Load your new optimized masterpiece model
PROJECT_ROOT = Path(__file__).resolve().parents[1]
model_path = PROJECT_ROOT / "stage1_general_risk_screener.pkl"
artifact = joblib.load(model_path)

# Extract the Random Forest model from inside the Pipeline
pipeline = artifact["models"]["general_risk"]
rf_model = pipeline.named_steps["rf_model"]

# Get the exact order of features the JS file will expect
feature_cols = artifact["feature_columns"]

print("Converting Optimized Edge AI to JavaScript...")
js_code = m2c.export_to_javascript(rf_model)

# Save the JS file for the Frontend Developer
output_path = PROJECT_ROOT / "stage1_offline_ai.js"
with open(output_path, "w", encoding="utf-8") as f:
    f.write(f"// IMPORTANT: Pass the patient array in exactly this order:\n")
    f.write(f"// {feature_cols}\n\n")
    f.write(js_code)

print(f"✅ Successfully exported '{output_path}'!")