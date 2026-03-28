# BloomCare Backend – Maternal Risk Intelligence System

> **AI-powered, asynchronous FastAPI backend for early detection of Preeclampsia, Gestational Diabetes (GDM), and Preterm Birth.**
> Designed for frontline maternal healthcare in Sri Lanka with EHR (FHIR R4) interoperability.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Prerequisites](#prerequisites)
5. [Installation](#installation)
6. [Configuration](#configuration)
7. [Running the Backend](#running-the-backend)
8. [API Endpoints](#api-endpoints)
9. [Request & Response Examples](#request--response-examples)
10. [Running Tests](#running-tests)
11. [ML Pipeline Details](#ml-pipeline-details)
12. [Troubleshooting](#troubleshooting)
13. [Production Readiness Notes](#production-readiness-notes)

---

## Overview

BloomCare is a **two-stage AI screening system**:

| Stage | Location | Method |
|-------|----------|--------|
| **Stage 1 – Triage** | On-device (TFLite / PyTorch Mobile) | Lightweight MLP on frontline vitals |
| **Stage 2 – Diagnosis** | Server-side (this backend) | Full ML phenotyping pipeline + GenAI |

The backend handles:
- Syncing Stage-1 edge device results from mobile apps
- Running the full data engineering + multi-condition ML pipeline on clinical biomarkers
- Generating bilingual (English / Sinhala / Tamil) AI explanations via OpenAI GPT-4o
- Providing a backward-compatible `/predict-risk` endpoint for the existing React frontend

---

## Architecture

```
bloomcare/
├── main.py          →  FastAPI application + all route handlers
├── models.py        →  Pydantic schemas (request + response models)
├── ml_services.py   →  Two-stage ML pipeline (Winsorization → Imputation → KMeans → RF)
├── llm_service.py   →  OpenAI GPT-4o integration (multilingual clinical explanations)
├── tests/
│   └── test_api.py  →  Integration test suite (pytest + httpx)
├── requirements.txt →  Pinned Python dependencies
└── .env.example     →  Environment variable template
```

---

## Project Structure

```
d:\hemasaithon\aithon\
├── bloomcare\               ← This backend package
│   ├── __init__.py
│   ├── main.py
│   ├── models.py
│   ├── ml_services.py
│   ├── llm_service.py
│   ├── requirements.txt
│   ├── README.md            ← You are here
│   └── tests\
│       └── test_api.py
├── frontend\                ← Next.js frontend (separate)
├── stage1_general_risk_screener.pkl  ← Pre-trained Stage-1 model (optional)
└── api_requirements.txt     ← Legacy requirements (for reference)
```

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Python | ≥ 3.10 | 3.11+ recommended |
| pip | ≥ 23.0 | |
| (Optional) OpenAI API Key | — | Only needed for live LLM mode |

---

## Installation

### 1. Clone / Navigate to the project

```powershell
# Navigate to the backend root
cd d:\hemasaithon\aithon
```

### 2. Create and activate a virtual environment

```powershell
# Create virtual environment
python -m venv .venv

# Activate (Windows PowerShell)
.\.venv\Scripts\Activate.ps1

# Activate (Windows CMD)
.\.venv\Scripts\activate.bat
```

### 3. Install dependencies

```powershell
# Install from the bloomcare package requirements (recommended)
pip install -r bloomcare\requirements.txt

# OR install from the legacy api requirements
pip install -r api_requirements.txt
```

---

## Configuration

Copy the environment template and fill in your values:

```powershell
copy bloomcare\.env.example bloomcare\.env
```

Edit `bloomcare\.env`:

```env
# ── OpenAI (GenAI Assistant) ──────────────────────────────────────
# Leave blank or set BLOOMCARE_MOCK_LLM=true to use offline mock mode
OPENAI_API_KEY=sk-...your-key-here...
BLOOMCARE_OPENAI_MODEL=gpt-4o

# Set to "true" for development without an OpenAI key
BLOOMCARE_MOCK_LLM=true

# ── API Security ──────────────────────────────────────────────────
# (Production) Add your actual domain
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# ── Database (Production) ─────────────────────────────────────────
# DATABASE_URL=postgresql://user:password@localhost/bloomcare
```

> **If you have no OpenAI key**, keep `BLOOMCARE_MOCK_LLM=true`. The `/api/v1/assistant/explain` endpoint will return a structured mock response — everything else works fully.

---

## Running the Backend

### Development server (recommended)

```powershell
# From the aithon\ directory (NOT inside bloomcare\)
cd d:\hemasaithon\aithon

python -m uvicorn bloomcare.main:app --host 0.0.0.0 --port 8001 --reload --log-level info
```

| Flag | Purpose |
|------|---------|
| `--host 0.0.0.0` | Listen on all interfaces (accessible from frontend at localhost:8001) |
| `--port 8001` | Port 8001 (frontend expects this) |
| `--reload` | Auto-restart on file changes (development only) |
| `--log-level info` | Show INFO-level logs including pipeline steps |

### Production server (no reload)

```powershell
python -m uvicorn bloomcare.main:app --host 0.0.0.0 --port 8001 --workers 4 --log-level warning
```

### Verify the server is running

Open in browser → **http://localhost:8001**

Expected response:
```json
{
  "service": "BloomCare Maternal Risk Intelligence API",
  "version": "2.0.0",
  "status": "healthy",
  "timestamp": "2026-03-28T09:27:00+00:00"
}
```

### Interactive API Docs (Swagger UI)

➡️ **http://localhost:8001/docs**

### ReDoc (alternative docs)

➡️ **http://localhost:8001/redoc**

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/` | Root health check | None |
| `GET` | `/health` | Liveness probe (Docker/k8s) | None |
| `GET` | `/api/v1/health` | Detailed component health | None |
| `POST` | `/predict-risk` | **Legacy** Stage-1 risk from vitals (existing frontend) | None |
| `POST` | `/api/v1/triage/sync` | Sync edge device triage result | None |
| `POST` | `/api/v1/diagnose` | Full Stage-2 ML diagnostic pipeline | None |
| `POST` | `/api/v1/assistant/explain` | GenAI multilingual clinical explanation | None |

---

## Request & Response Examples

### POST `/predict-risk` — Legacy endpoint (existing frontend)

**Request:**
```json
{
  "patient_name": "Nimalka Fernando",
  "age": 29,
  "systolic": 148,
  "diastolic": 96,
  "bmi": 27.5,
  "heart_rate": 88,
  "bs": 135,
  "temperature": 37.2,
  "hemoglobin": 10.5,
  "pcos": 0,
  "previous_complications": 1,
  "preexisting_diabetes": 0,
  "mental_health": 4,
  "sleep_pattern": 6.5,
  "exercise": 2.5,
  "education": 3,
  "map": null
}
```

**Response (HTTP 200):**
```json
{
  "risk_level": "high",
  "risk_score": 0.76,
  "recommendations": [
    "Urgent: Repeat BP within 15 minutes",
    "Immediate escalation for Stage-2 specialist review",
    "Capture advanced biomarkers for differential diagnosis",
    "Elevated blood sugar — consider OGTT screening for GDM."
  ],
  "bp_status": "High",
  "observation": "Requires Immediate Attention"
}
```

---

### POST `/api/v1/triage/sync` — Stage-1 edge sync

**Request:**
```json
{
  "patient_id": "PAT-0001-LK",
  "encounter_id": "ENC-2026-03-28-001",
  "gestational_age_weeks": 28,
  "age": 31,
  "blood_pressure": { "systolic": 148, "diastolic": 96 },
  "bmi": 29.4,
  "heart_rate": 92,
  "temperature": 37.1,
  "edge_risk_classification": "escalate",
  "edge_risk_score": 0.83,
  "device_id": "BLOOMCARE-MOB-007"
}
```

**Response (HTTP 201):**
```json
{
  "patient_id": "PAT-0001-LK",
  "encounter_id": "ENC-2026-03-28-001",
  "server_risk_tier": "escalate",
  "synced_at": "2026-03-28T09:45:00+00:00",
  "triage_flags": [
    "HYPERTENSION — BP ≥ 140/90. Elevated preeclampsia risk.",
    "OBESITY — BMI ≥ 30. Increased GDM and PE risk."
  ],
  "recommended_action": "ESCALATE to hospital-level care immediately. Proceed to Stage-2 biomarker panel.",
  "escalation_required": true
}
```

---

### POST `/api/v1/diagnose` — Stage-2 ML pipeline

> ⚠️ This endpoint trains ML models on-the-fly (synthetic data). First call takes **30–60 seconds**. Production should use pre-trained serialised models.

**Request:**
```json
{
  "patient_id": "PAT-0001-LK",
  "gestational_age_weeks": 28,
  "sflt1_plgf_ratio": 52.3,
  "papp_a": 0.31,
  "metabolomics": {
    "glucose_fasting": 6.8,
    "hba1c": 6.2,
    "triglycerides": 3.1,
    "hdl_cholesterol": 1.1,
    "creatinine": 85.0,
    "uric_acid": 380.0
  },
  "doppler": {
    "uterine_artery_pi": 1.72,
    "umbilical_artery_ri": 0.79,
    "middle_cerebral_artery_pi": 1.45,
    "cerebroplacental_ratio": 0.84,
    "end_diastolic_flow": "present"
  },
  "cervical_length_mm": 22.0
}
```

**Response (HTTP 200):**
```json
{
  "status": "success",
  "ml_output": {
    "cluster_profile": {
      "cluster_id": 4,
      "cluster_label": "Multi-Factorial High-Risk",
      "cluster_confidence": 0.42,
      "dominant_features": ["high uric acid", "elevated creatinine", "short cervical length", "low PAPP-A"]
    },
    "condition_probabilities": [
      { "condition": "preeclampsia_early_onset", "probability": 0.816, "risk_category": "critical" },
      { "condition": "preeclampsia_late_onset",  "probability": 0.54,  "risk_category": "high" },
      { "condition": "gestational_diabetes_mellitus", "probability": 0.31, "risk_category": "moderate" },
      { "condition": "preterm_birth", "probability": 0.62, "risk_category": "high" }
    ],
    "overall_severity_score": 0.68,
    "dominant_condition": "preeclampsia_early_onset",
    "imputed_features": ["hemoglobin", "platelet_count", "tsh", "bmi"],
    "data_quality_score": 0.706
  },
  "recommended_specialist_referral": "Urgent referral to Maternal-Fetal Medicine (MFM) specialist.",
  "urgent": true
}
```

---

### POST `/api/v1/assistant/explain` — GenAI multilingual explanation

**Request:**
```json
{
  "ml_output": { "...full DiagnoseMLOutput object from above..." },
  "requester_role": "frontline_health_worker"
}
```

**Response (HTTP 200):**
```json
{
  "patient_id": "PAT-0001-LK",
  "dominant_condition": "preeclampsia_early_onset",
  "overall_severity_score": 0.68,
  "explanations": [
    { "language_code": "en", "summary": "...", "clinical_next_steps": ["..."] },
    { "language_code": "si", "summary": "...", "clinical_next_steps": ["..."] },
    { "language_code": "ta", "summary": "...", "clinical_next_steps": ["..."] }
  ],
  "generated_at": "...",
  "model_used": "mock" 
}
```

---

## Running Tests

```powershell
# From the aithon\ directory
cd d:\hemasaithon\aithon

# Run all tests with verbose output
python -m pytest bloomcare/tests/test_api.py -v

# Run with short traceback on failures
python -m pytest bloomcare/tests/test_api.py -v --tb=short

# Run a specific test
python -m pytest bloomcare/tests/test_api.py::test_diagnose_full_panel -v

# Run with coverage report (requires pytest-cov)
python -m pytest bloomcare/tests/test_api.py --cov=bloomcare --cov-report=term-missing
```

All 5 tests should pass (including the Stage-2 ML pipeline test):
```
PASSED bloomcare/tests/test_api.py::test_health_check
PASSED bloomcare/tests/test_api.py::test_triage_sync
PASSED bloomcare/tests/test_api.py::test_diagnose_full_panel
PASSED bloomcare/tests/test_api.py::test_diagnose_minimal_biomarker
PASSED bloomcare/tests/test_api.py::test_assistant_explain_mock
```

---

## ML Pipeline Details

The Stage-2 engine runs a **5-step pipeline**:

```
Input Biomarkers
     │
     ▼
1. Winsorize          → Clip outliers to clinical reference ranges (WHO/NICE/RCOG)
     │
     ▼
2. RF Imputation      → Random Forest Regressors fill any missing biomarkers
     │                   using cross-dataset synthetic reference cohort
     ▼
3. Weighted K-Means   → Assign patient to 1 of 5 latent phenotype clusters
     │                   (Low-Risk / Hypertensive-PE / Hyperglycaemic / etc.)
     ▼
4. RF Classifiers     → 5 class-weighted Random Forest classifiers estimate
     │                   condition probabilities (PE early/late/severe, GDM, PTB)
     ▼
5. Severity Scoring   → Weighted combination → overall severity score
```

### Feature Space (17 biomarkers)

| Feature | Description | Importance |
|---------|-------------|------------|
| `sflt1_plgf_ratio` | sFlt-1/PlGF ratio | ⭐⭐⭐ Highest (PE detection) |
| `uterine_artery_pi` | Uterine artery PI (Doppler) | ⭐⭐⭐ |
| `umbilical_artery_ri` | Umbilical artery RI | ⭐⭐⭐ |
| `glucose_fasting` | Fasting glucose | ⭐⭐ (GDM) |
| `hba1c` | HbA1c | ⭐⭐ (GDM) |
| `cervical_length_mm` | Cervical length | ⭐⭐ (Preterm) |
| `papp_a` | PAPP-A | ⭐⭐ |
| `uric_acid` | Uric acid | ⭐ |
| `creatinine` | Serum creatinine | ⭐ |
| `platelet_count` | Platelets | ⭐ |
| `triglycerides` | Triglycerides | ⭐ |
| `hdl_cholesterol` | HDL cholesterol | ⭐ |
| `hemoglobin` | Haemoglobin (from Stage-1) | ⭐ |
| `tsh` | TSH (thyroid) | ⭐ |
| `mca_pi` | MCA pulsatility index | ⭐ |
| `cerebroplacental_ratio` | CPR | ⭐ |
| `bmi` | BMI (from Stage-1) | ⭐ |

---

## Troubleshooting

### Server won't start

```powershell
# Make sure you're in the RIGHT directory (aithon\, not bloomcare\)
cd d:\hemasaithon\aithon

# Check Python version
python --version   # Must be 3.10+

# Check all packages are installed
pip list | findstr fastapi
pip list | findstr uvicorn
```

### `ModuleNotFoundError: No module named 'bloomcare'`

```powershell
# You must run uvicorn from d:\hemasaithon\aithon (the parent of bloomcare\)
# Do NOT cd into bloomcare\ first
cd d:\hemasaithon\aithon
python -m uvicorn bloomcare.main:app --port 8001
```

### `/api/v1/diagnose` is slow (30–60 seconds)

This is expected in development — the ML models are trained on-the-fly using synthetic data.  
In production, pre-train and serialise models with `joblib.dump()` and load them at server startup.

### `OPENAI_API_KEY not set` warning

The backend falls back to mock explanations automatically. Set `BLOOMCARE_MOCK_LLM=true` in `.env` to suppress the warning. All other endpoints work without an API key.

### Frontend CORS errors

Add your frontend origin to `ALLOWED_ORIGINS` in `bloomcare/main.py`:

```python
ALLOWED_ORIGINS = [
    "http://localhost:3000",   # Next.js default
    "http://localhost:3001",
    ...
]
```

---

## Production Readiness Notes

The following items should be completed before a production deployment:

- [ ] **Replace synthetic ML training data** with the anonymised multi-centre Sri Lanka reference dataset
- [ ] **Pre-train and serialise ML models** (`joblib.dump`) — load at startup via `lifespan()`, not per-request
- [ ] **Add PostgreSQL / FHIR R4 persistence** — currently all triage syncs are in-memory only
- [ ] **Implement authentication** — JWT / OAuth2 for all endpoints
- [ ] **Set `BLOOMCARE_MOCK_LLM=false`** and provide a real `OPENAI_API_KEY`
- [ ] **Configure production CORS origins** (remove `localhost` entries)
- [ ] **Use `--workers N`** (e.g. `--workers 4`) with Uvicorn for multi-core servers
- [ ] **Add Prometheus metrics** middleware for observability
- [ ] **Deploy behind a reverse proxy** (nginx / Caddy) with TLS termination

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Web framework | FastAPI 0.115 (async) |
| ASGI server | Uvicorn 0.32 |
| Data validation | Pydantic v2 |
| ML – clustering | scikit-learn KMeans |
| ML – classification | scikit-learn RandomForestClassifier |
| Data engineering | NumPy, Pandas |
| GenAI | OpenAI Python SDK (async) |
| Testing | pytest, pytest-asyncio, httpx |
| Model serialisation | joblib |
| Environment | python-dotenv |

---

*BloomCare Backend — Built for frontline maternal care in Sri Lanka 🌸*
