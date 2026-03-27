# Hemas AI - Developer Handoff (UI + Backend)

This README is the source of truth for how to integrate the current models.

## 1) Current Pipeline Overview

- Stage 01 (`models/stage1.py`) = **General maternal risk triage** (High/Low)
- Stage 02 Preeclampsia (`models/preeclam.py`) = phenotype diagnostic model
- Stage 02 GDM (`models/gdm.py`) = metabolic phenotype model
- Stage 02 Preterm (`models/prematureb.py`) =
  - **Main model** from `Data/MSF_cleaned.csv` (real-world imbalanced)
  - **Support model** from `Data/preterm.csv` (balanced validation + SHAP)

---

## 2) UI Team: What Inputs to Collect

Use these fields for Stage 01 triage form (send exactly these keys):

- `Age`
- `BMI`
- `Systolic_BP`
- `Diastolic`
- `Heart_Rate`
- `BS`
- `Body_Temp`
- `Hemoglobin`
- `PCOS`
- `Previous_Complications`
- `Preexisting_Diabetes`
- `Mental_Health`
- `Sleep_Pattern`
- `Exercise`
- `Education`

### UI Notes
- Missing values are allowed; backend model imputes missing numerics.
- Binary inputs should be `0` or `1`.
- UI should show:
  - Risk label (`High` / `Low`)
  - Probability
  - Threshold used

---

## 3) Backend Team: Stage 01 Contract

### Model Artifact
- `stage1_general_risk_screener.pkl`

### Training Command
```bash
python models/stage1.py --train
```

### Local Prediction Command
```bash
python models/stage1.py --predict-json "{'Age':28,'Systolic_BP':150,'Diastolic':95,'BMI':31}"
```

### Python Usage
```python
from models.stage1 import predict_stage1_risk

payload = {
    "Age": 28,
    "Systolic_BP": 150,
    "Diastolic": 95,
    "BMI": 31,
    "Gestational_Diabetes": 1,
    "Previous_Complications": 1,
    "Hemoglobin": 10.5
}

result = predict_stage1_risk(payload)
print(result)
```

### Stage 01 Output Shape
```json
{
  "general_risk": {
    "probability": 0.91,
    "risk": "High",
    "threshold": 0.35
  }
}
```

---

## 4) Backend Team: Stage 02 Artifacts

### Preeclampsia
- Train/run: `python models/preeclam.py`
- Artifacts:
  - `stage2_diagnostic.pkl`
  - `explainer.png`

### GDM
- Train/run: `python models/gdm.py`
- Artifacts:
  - `stage2_gdm_diagnostic.pkl`
  - `gdm_imputer.pkl`
  - `bmi_synthetic_imputer.pkl`
  - `stage2_gdm_shap_explainer.png`

### Preterm (Main + Support)
- Train/run: `python models/prematureb.py`
- Artifacts:
  - Main (production): `stage2_preterm_main_msf.pkl`
  - Support (analysis): `stage2_preterm_support_ehg.pkl`
  - Support SHAP: `stage2_preterm_support_shap.png`
  - Summary: `stage2_preterm_training_summary.json`

### Important for Preterm
- Use **main model** (`stage2_preterm_main_msf.pkl`) for production prediction.
- Use **support model** only for validation and feature explanations.

---

## 5) JS Export (Offline Frontend Inference)

`models/export_js.py` exports Stage 01 RF model into JavaScript:

```bash
python models/export_js.py
```

Output:
- `stage1_offline_ai.js`

The first comment in that JS file contains the exact feature order expected by the model. UI must send values in that exact order for offline inference.

---

## 6) Data Sources Used Right Now

- `Data/Dataset - Updated.csv`
- `Data/MSF_cleaned.csv`
- `Data/preeclampsia.csv`
- `Data/GDM_Dataset_Enterprise_Imputed.csv`
- `Data/Gestational Diabetes.csv`
- `Data/preterm.csv`

---

## 7) Integration Checklist (UI + Backend)

- Backend loads Stage 01 artifact at service startup.
- UI sends numeric payload with agreed key names.
- Backend returns risk JSON exactly as documented.
- UI renders `risk`, `probability`, and short guidance.
- Stage 02 models are invoked only after Stage 01 screening flow.

---

## 8) Current Decisions (to avoid confusion)

- Stage 01 currently returns **single** output: `general_risk`.
- Preterm strategy is intentionally dual-track:
  - Main = imbalanced real-world credibility
  - Support = balanced interpretability
- `explainer.png` in preeclampsia is now saved automatically by script.
