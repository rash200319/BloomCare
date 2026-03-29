# Stage 2 Model Integration - Implementation Complete

## Overview

The BloomCare system now supports the complete Stage 1 → Stage 2 workflow, with intelligent report generation and disease-specific model routing based on clinical risk factors identified during screening.

## Key Changes

### 1. Database Schema Updates (schema.sql)

#### stage1_screenings (Enhanced)
```sql
- Added: contributing_factors (JSONB)
  Stores which risk factors led to high risk score
  Example: {"severe_hypertension": 0.35, "obesity": 0.25, "advanced_maternal_age": 0.20}
```

#### stage2_diagnostics (Enhanced)
```sql
- Added: primary_disease_checked VARCHAR(50)
  Which disease is being evaluated (preeclampsia, gdm, preterm)
  
- Added: model_used VARCHAR(100)
  Which pkl file was used (stage2_diagnostic.pkl, stage2_gdm_diagnostic.pkl, etc.)
  
- Added: stage1_screening_id (Foreign Key)
  Links back to the initial screening that triggered stage 2 evaluation
  
- Added: disease_specific_inputs (JSONB)
  Flexible storage for disease-specific parameters
```

#### stage2_recommendations (New)
Tracks doctor's decision about which disease to check:
```sql
- stage1_screening_id: Links to initial screening
- primary_disease_to_check: Disease selected by doctor (preeclampsia, gdm, preterm)
- clinical_notes: Doctor's clinical reasoning
- created_by: User who made the recommendation
```

#### patient_reports (New)
Stores downloadable health reports:
```sql
- report_type: "stage1", "stage2", or "combined"
- report_content: JSONB with full report data
- download_url: Link for patient to download
- expires_at: When report access expires
```

### 2. Updated Models (backend/models/screening.py)

#### Stage1Screening
```python
contributing_factors: JSONB  # Feature importance from stage 1 model
```

#### Stage2Diagnostic
```python
stage1_screening_id: UUID        # Links to stage 1
primary_disease_checked: str     # "preeclampsia", "gdm", "preterm"
model_used: str                  # "stage2_diagnostic.pkl", etc.
disease_specific_inputs: JSONB   # Disease-specific parameters
```

#### Stage2Recommendation (New)
```python
stage1_screening_id: UUID
primary_disease_to_check: str
clinical_notes: str
created_by: UUID
expires_at: DateTime
```

#### PatientReport (New)
```python
stage1_screening_id: UUID
stage2_diagnostic_id: UUID (Optional)
report_type: str                 # "stage1", "stage2", "combined"
report_content: JSONB            # Full formatted report
generated_by: UUID
```

### 3. API Schema Updates (backend/schemas/screening.py)

#### TriageInput (Updated)
**Removed:** Individual disease risk fields (stage1_risk_preeclampsia, stage1_risk_gdm, stage1_risk_preterm)

**Added:**
```python
bs: Optional[float]                      # Blood sugar
hemoglobin: Optional[float]
pcos: Optional[bool]
previous_complications: Optional[bool]
preexisting_diabetes: Optional[bool]
mental_health: Optional[float]
sleep_pattern: Optional[float]
exercise: Optional[float]
education: Optional[int]
```

#### DiagnoseInput (Updated)
```python
primary_disease_to_check: Optional[str]  # "preeclampsia", "gdm", "preterm"
stage1_screening_id: Optional[str]       # Link to stage 1 results
disease_specific_inputs: Optional[Dict]  # Flexible disease-specific params
```

#### New Schemas
```python
PatientReportRequest
PatientReportResponse
Stage1ScreeningReportData
```

### 4. Updated API Endpoints

#### Triage Endpoint (/api/v1/triage/sync)
- **Enhanced:** Calculates contributing factors automatically
- **Contributing Factors Logic:**
  - Severe hypertension (≥160/110): 25%
  - Hypertension (≥140/90): 20%
  - Obesity (BMI ≥30): 20%
  - Advanced maternal age (≥35): 15%
  - Elevated blood sugar (>6.0): 15%
  - Pre-existing diabetes: 20%
  - PCOS: 12%
  - Previous complications: 18%
  - Anemia (Hb <10.5): 10%
  - Mental health concerns: 8%

#### Diagnose Endpoint (/api/v1/diagnose)
- **Disease Model Mapping:**
  ```python
  "preeclampsia"  → stage2_diagnostic.pkl
  "gdm"           → stage2_gdm_diagnostic.pkl
  "preterm"       → stage2_preterm_main_msf.pkl (default)
  "preterm_ehg"   → stage2_preterm_support_ehg.pkl
  ```
- **New Fields:**
  - Stores `stage1_screening_id` for traceability
  - Stores `primary_disease_checked` for audit trail
  - Stores `model_used` for reproducibility
  - Stores `disease_specific_inputs` for flexibility

### 5. New Reports API (backend/api/v1/reports.py)

#### POST /api/v1/reports/stage1
Generates Stage 1 screening report
```json
{
  "report_title": "Stage 1 Screening Report - 2024-03-29",
  "patient_id": "uuid",
  "screening_date": "2024-03-29T10:30:00Z",
  "gestational_age_weeks": 20,
  "vitals": {
    "age": 28,
    "blood_pressure": "145/92 mmHg",
    "bmi": "28.5 kg/m²",
    "blood_sugar": "6.2 mmol/L",
    "hemoglobin": "11.8 g/dL"
  },
  "risk_classification": "HIGH RISK - ESCALATION REQUIRED",
  "risk_score": 0.76,
  "contributing_factors": [
    "• Hypertension (≥140/90 mmHg) (35%)",
    "• Elevated blood sugar (>6.0 mmol/L) (28%)",
    "• Advanced maternal age (≥35 years) (21%)"
  ],
  "recommendations": [
    "Consult with a maternal-fetal medicine specialist",
    "Schedule Stage 2 diagnostic evaluation",
    "Monitor vital signs regularly"
  ],
  "next_steps": "Patient should schedule appointment with MFM specialist within 2 weeks..."
}
```

**Response:**
```json
{
  "id": "report-uuid",
  "patient_id": "patient-uuid",
  "report_type": "stage1",
  "report_title": "Stage 1 Screening Report - 2024-03-29",
  "generated_at": "2024-03-29T14:22:00Z",
  "download_url": "/api/v1/reports/{report_id}/download"
}
```

#### POST /api/v1/reports/stage2
Generates Stage 2 diagnostic report
```json
{
  "disease_checked": "preeclampsia",
  "model_used": "stage2_diagnostic.pkl",
  "overall_severity_score": 0.72,
  "dominant_condition": "preeclampsia_early_onset",
  "condition_probabilities": [...],
  "biomarkers": {
    "sFlt-1/PlGF ratio": 45.8,
    "PlGF absolute": 2100,
    "PAPP-A": 0.85,
    "cervical_length": "35 mm"
  }
}
```

#### GET /api/v1/reports/{report_id}/download
Downloads report as JSON or PDF
- Supports query param `?format=json` or `?format=pdf`
- Returns file with proper Content-Disposition header
- Currently returns JSON, can be extended to PDF via ReportLab

#### GET /api/v1/reports/patient/{patient_id}
Lists all reports for a patient
```json
[
  {
    "id": "report-uuid",
    "patient_id": "patient-uuid",
    "report_type": "stage1",
    "report_title": "Stage 1 Screening Report - 2024-03-29",
    "generated_at": "2024-03-29T14:22:00Z",
    "expires_at": "2024-06-29T14:22:00Z"
  }
]
```

## Workflow Example

### Step 1: Frontline Worker - Stage 1 Screening
```bash
POST /api/v1/triage/sync
{
  "items": [{
    "patient_id": "uuid123",
    "encounter_id": "ENC-001",
    "gestational_age_weeks": 22,
    "age": 32,
    "blood_pressure": {"systolic": 145, "diastolic": 92},
    "bmi": 28.5,
    "heart_rate": 88,
    "temperature": 36.8,
    "bs": 6.2,
    "hemoglobin": 11.8,
    "pcos": false,
    "previous_complications": false,
    "preexisting_diabetes": false,
    "edge_risk_classification": "escalate",
    "edge_risk_score": 0.76
  }]
}
```

**Response:** Screening saved with contributing_factors calculated automatically

### Step 2: Patient - Download Report
```bash
POST /api/v1/reports/stage1
{
  "stage1_screening_id": "screening-uuid"
}
```

**Response:** Report generated with:
- Vital signs summary
- Contributing risk factors (human-readable)
- Clinical recommendations
- Download link

Patient downloads report to review with doctor

### Step 3: Doctor - Review & Select Disease to Check
Doctor reviews stage 1 report and determines which disease needs evaluation based on contributing factors.

For this patient:
- Contributing factors: Hypertension (35%), High blood sugar (28%), Advanced age (21%)
- Decision: Check for both preeclampsia AND GDM
- Creates Stage2Recommendation with notes

### Step 4: Specialist - Run Stage 2
```bash
POST /api/v1/diagnose
{
  "patient_id": "uuid123",
  "stage1_screening_id": "screening-uuid",
  "gestational_age_weeks": 22,
  "primary_disease_to_check": "preeclampsia",
  "sflt1_plgf_ratio": 45.8,
  "papp_a": 0.85,
  "metabolomics": {
    "glucose_fasting": 6.2,
    "hba1c": 5.8
  },
  "doppler": {
    "uterine_artery_pi": 1.85,
    "cerebroplacental_ratio": 1.62
  },
  "cervical_length_mm": 35
}
```

**System automatically:**
- Routes to stage2_diagnostic.pkl (for preeclampsia)
- Stores primary_disease_checked = "preeclampsia"
- Stores model_used = "stage2_diagnostic.pkl"
- Links to stage1_screening_id for audit trail

### Step 5: Generate & Download Reports
```bash
POST /api/v1/reports/stage2
{
  "stage2_diagnostic_id": "diagnostic-uuid"
}

GET /api/v1/reports/{report_id}/download
```

Patient receives comprehensive report showing:
- Stage 1 screening summary
- Stage 2 diagnostic results
- Risk assessment  
- Clinical recommendations
- Next follow-up steps

## Key Features

### 1. Traceability
Every stage 2 diagnosis is linked back to the stage 1 screening that triggered it via `stage1_screening_id`. This allows:
- Audit trails
- Outcome tracking
- Quality assurance

### 2. Model Flexibility
The `DISEASE_MODEL_MAP` allows easy routing to different pkl models based on clinical decision:
- One model per disease type
- Easy to swap/update models
- Preterm supports two variants (main MSF vs EHG)

### 3. Report Generation
Automated reports with:
- Machine-readable JSON format
- Human-readable summaries
- Risk factor explanations
- Clinical recommendations
- Can be extended to PDF using ReportLab

### 4. Contributing Factors
Instead of disease-specific risk scores at stage 1, the system shows:
- Which vitals/factors caused high risk
- Normalized importance scores (0-1)
- Human-readable descriptions
- Used by doctors to select which disease to evaluate

## Future Enhancements

1. **PDF Export**
   - Use ReportLab to generate professional PDFs
   - Include charts and visualizations
   - Add signature fields for doctors

2. **Export Formats**
   - HL7 FHIR for interoperability
   - CSV for bulk exports

3. **Multi-Disease Evaluation**
   - Run multiple stage 2 models in one session
   - Compare risk scores across diseases
   - Generate combined report

4. **Decision Support**
   - Auto-recommend which disease to check based on stage 1 factors
   - Suggest next follow-up date based on risk profile

5. **Patient Portal**
   - Secure login for patients
   - View their reports
   - Track pregnancy journey
   - Receive notifications for follow-ups

## Migration Steps

1. **Database:** Run schema.sql migrations
2. **Models:** Deploy updated screening models
3. **API:** Deploy updated endpoints
4. **Frontend:** Update forms to accept new fields
5. **Testing:** Test complete workflow end-to-end

