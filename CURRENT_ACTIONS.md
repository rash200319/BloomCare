# BloomCare – Current Actions & Features by Role

**Last Updated:** April 3, 2026  
**Current Version:** 2.0.0  
**Status:** Development (Alpha)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Admin Role Features](#admin-role-features)
3. [Doctor / Clinical Specialist Features](#doctor--clinical-specialist-features)
4. [Frontline Staff Features](#frontline-staff-features)
5. [Patient Features](#patient-features)
6. [Public / Unauthenticated Features](#public--unauthenticated-features)
7. [AI & ML Pipeline](#ai--ml-pipeline)
8. [Frontend Features](#frontend-features)
9. [Authentication & Security](#authentication--security)
10. [API Health & Monitoring](#api-health--monitoring)

---

## System Overview

BloomCare is a **two-stage maternal risk intelligence system**:

| Component | Purpose | Technology |
|-----------|---------|-----------|
| **Stage 1 Triage** | On-device risk screening from vital signs | Mobile app (React Native) |
| **Stage 2 Diagnosis** | Server-side ML pipeline + biomarker analysis | FastAPI backend + scikit-learn |
| **Frontend** | Web UI for all roles + admin/clinical dashboards | Next.js 14 (React) |
| **Chatbot** | Trilingual (English, Sinhala, Tamil) navigation assistant | Key-answer based (no external API) |

---

## Admin Role Features

### Access Level
- **User Role:** `ADMIN`
- **Permissions:** System-wide access; override all patient/staff/appointment operations

### 1. Dashboard Access
**Endpoint:** `GET /api/v1/dashboard/admin/dashboard`  
**Summary:** Admin Dashboard  
**Returns:**
```json
{
  "message": "Welcome to Admin Dashboard",
  "dashboard": {
    "title": "Admin Dashboard",
    "features": [
      "Staff Management",
      "Patient Management",
      "System Monitoring",
      "Appointment Management",
      "Reports & Analytics"
    ]
  }
}
```

### 2. Staff Management

#### Create Staff Member
**Endpoint:** `POST /api/v1/staff-management/create-staff`  
**Body:**
```json
{
  "full_name": "Dr. Silva",
  "email": "dr.silva@bloomcare.lk",
  "phone_number": "+94712345678",
  "role": "CLINICAL_SPECIALIST",
  "specialization": "Maternal-Fetal Medicine"
}
```
**Returns:** Temporary password for first login
**Status:** HTTP 201

#### List Staff Members
**Endpoint:** `GET /api/v1/staff-management/staff`  
**Query Parameters:**
- `full_name` (optional) – Partial name match
- `id` (optional) – User primary key
- `email` (optional) – Exact email match
- `role` (optional) – Filter by `FRONTLINE_STAFF` or `CLINICAL_SPECIALIST`

**Returns:** Array of staff member profiles

#### Get Staff by Name
**Endpoint:** `GET /api/v1/staff-management/by-name/{name}`  
**Returns:** List of matching staff members

### 3. Patient Management

#### List All Patients
**Endpoint:** `GET /api/v1/patients`  
**Query Parameters:**
- `skip` (default: 0)
- `limit` (default: 100)

**Returns:** Array of all patient records

#### Create/Register Patient
**Endpoint:** `POST /api/v1/patients`  
**Body:**
```json
{
  "national_id": "123456789V",
  "full_name": "Nimalka Fernando",
  "age": 28,
  "due_date": "2026-05-15",
  "contact_number": "+94712345678",
  "emergency_contact": "+94787654321",
  "blood_group": "O+"
}
```
**Returns:** Patient object with auto-generated password  
**Status:** HTTP 201

#### View Patient History
**Endpoint:** `GET /api/v1/patients/{patient_id}/history`  
**Returns:**
- Full Stage-2 diagnostic history
- Linked Stage-1 vital signs context
- Risk timeline
- Condition probabilities

### 4. Appointment Management

#### List All Appointments
**Endpoint:** `GET /api/v1/appointments/specialist/{specialist_name}`  
**Query Parameters:**
- `date` (optional) – Filter by date (YYYY-MM-DD)

**Returns:** Array of appointments for specialist

#### Approve/Update Appointments
**Endpoint:** `PATCH /api/v1/appointments/{appointment_id}`  
**Body:**
```json
{
  "status": "CONFIRMED",
  "appointment_date": "2026-04-10T14:30:00",
  "notes": "Patient confirmed arrival"
}
```
**Returns:** Updated appointment object

#### Cancel Appointment
**Endpoint:** `DELETE /api/v1/appointments/{appointment_id}`  
**Returns:** Cancelled appointment object  
**Status:** HTTP 200

### 5. Reports & Analytics

#### Generate Admin Analytics Report
**Endpoint:** `GET /api/v1/admin/analytics`  
**Query Parameters:**
- `date_from` (optional) – Start date
- `date_to` (optional) – End date
- `by_specialist` (optional) – Group by specialist

**Returns:**
- Total consultations
- High-risk case count
- Condition breakdowns
- Specialist workload
- Trending conditions

#### Generate Stage-1 Report
**Endpoint:** `POST /api/v1/reports/stage1`  
**Body:**
```json
{
  "stage1_screening_id": "screening-uuid"
}
```
**Returns:** PDF / JSON report with contributing factors and recommendations

### 6. System Health & Monitoring

#### Health Check
**Endpoint:** `GET /api/v1/health`  
**Returns:** Detailed component health status

---

## Doctor / Clinical Specialist Features

### Access Level
- **User Role:** `CLINICAL_SPECIALIST` or `DOCTOR`
- **Permissions:** Access assigned patient records; perform Stage-2 diagnosis; schedule/manage appointments; view specialist team appointments

### 1. Dashboard Access
**Endpoint:** `GET /api/v1/dashboard/doctor/dashboard`  
**Summary:** Clinical Dashboard  
**Returns:**
```json
{
  "message": "Welcome to Doctor Dashboard",
  "dashboard": {
    "title": "Clinical Dashboard",
    "features": [
      "Today's Appointments",
      "Patient Queue",
      "Patient History",
      "Clinical Notes",
      "Appointment Scheduling"
    ]
  }
}
```

### 2. Patient Management

#### View Assigned Patients
**Endpoint:** `GET /api/v1/patients`  
**Returns:** Only patients assigned to this doctor

#### View Patient History
**Endpoint:** `GET /api/v1/patients/{patient_id}/history`  
**Returns:**
- Full diagnostic history
- Stage-1 vital context
- Condition risk scores
- Timeline of interventions

### 3. Stage-2 ML Diagnosis

#### Run Full Diagnostic Pipeline
**Endpoint:** `POST /api/v1/diagnose`  
**Body:**
```json
{
  "patient_id": "pat-uuid",
  "gestational_age_weeks": 28,
  "primary_disease_to_check": "preeclampsia",
  "stage1_screening_id": "screening-uuid",
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
**Returns:**
```json
{
  "status": "success",
  "ml_output": {
    "cluster_id": 4,
    "cluster_label": "Multi-Factorial High-Risk",
    "dominant_features": ["high uric acid", "elevated creatinine", "short cervical length", "low PAPP-A"],
    "condition_probabilities": [
      { "condition": "preeclampsia_early_onset", "probability": 0.816, "risk_category": "critical" },
      { "condition": "preeclampsia_late_onset", "probability": 0.54, "risk_category": "high" },
      { "condition": "gestational_diabetes_mellitus", "probability": 0.31, "risk_category": "moderate" },
      { "condition": "preterm_birth", "probability": 0.62, "risk_category": "high" }
    ],
    "overall_severity_score": 0.68,
    "dominant_condition": "preeclampsia_early_onset"
  },
  "recommended_specialist_referral": "Urgent referral to Maternal-Fetal Medicine (MFM) specialist.",
  "urgent": true
}
```

#### Supported Models
- `stage2_diagnostic.pkl` – Preeclampsia detection (default)
- `stage2_gdm_diagnostic.pkl` – Gestational Diabetes Mellitus
- `stage2_preterm_main_msf.pkl` – Preterm Birth (main model)
- `stage2_preterm_support_ehg.pkl` – Preterm Birth (EHG alternative)

**Model Override (Advanced):**
```json
{
  "model_override": "stage2_gdm_diagnostic.pkl"
}
```

### 4. GenAI Clinical Explanations

#### Get Multilingual AI Explanation
**Endpoint:** `POST /api/v1/assistant/explain`  
**Body:**
```json
{
  "ml_output": { "...full DiagnoseResponse..." },
  "requester_role": "doctor"
}
```
**Returns:** Multilingual explanations in:
- **English** – Clinical summary + next steps
- **Sinhala** – සිංහල දේශීය සාරාංශය
- **Tamil** – தமிழ் மொழி சுருக்கம்

**Note:** Currently in mock mode (returns template); enable with real OpenAI key if needed.

### 5. Appointment Management

#### Get Appointments by Specialist
**Endpoint:** `GET /api/v1/appointments/specialist/{specialist_name}`  
**Query Parameters:**
- `date` (optional) – Filter by date (YYYY-MM-DD)

**Returns:** Appointments for this specialist

#### Get Appointments by Patient
**Endpoint:** `GET /api/v1/appointments/patient/{patient_id}`  
**Query Parameters:**
- `status` (optional) – Filter by status (PENDING, CONFIRMED, COMPLETED, CANCELLED)

**Returns:** Appointments for a patient

#### Update Own Appointment
**Endpoint:** `PATCH /api/v1/appointments/{appointment_id}`  
**Body:**
```json
{
  "appointment_date": "2026-04-10T15:00:00",
  "notes": "Patient moved to urgent queue"
}
```
**Returns:** Updated appointment

#### Cancel Appointment
**Endpoint:** `DELETE /api/v1/appointments/{appointment_id}`  
**Returns:** Cancelled appointment

### 6. Patient Insights & Tracking

#### Get Patient Weekly Insight
**Endpoint:** `GET /api/v1/insights/patient/{patient_id}/this-week`  
**Returns:**
```json
{
  "patient_id": "pat-uuid",
  "week_starting": "2026-03-31",
  "development": {
    "gestational_age_weeks": 28,
    "estimated_fetal_weight_g": 1050,
    "development_percentage": 64.3
  },
  "vitals_summary": {
    "avg_systolic": 142.5,
    "avg_diastolic": 92.3,
    "avg_bmi": 28.1,
    "avg_heart_rate": 85.2
  },
  "risk_assessment": {
    "high_risk_screenings": 3,
    "risk_factors": ["Hypertension", "Elevated BMI"]
  },
  "wellness_metrics": {
    "mental_health_score": 6.5,
    "sleep_hours_avg": 7.2,
    "exercise_days": 3
  }
}
```

#### Get Patient Weekly Stats
**Endpoint:** `GET /api/v1/insights/patient/{patient_id}/stats`  
**Returns:**
- Screening count (this week)
- Average risk score
- Highest risk tier
- Vital readings count

### 7. Differential Diagnosis

#### Get Differential Diagnosis
**Endpoint:** `GET /api/v1/differential/{patient_id}`  
**Query Parameters:**
- `condition` (optional) – Focus on specific condition

**Returns:**
- Ranked list of possible conditions
- Supporting/contra-indicating features
- Probability distribution
- Referral suggestions

### 8. Specialist Workflows

#### Specialist Queue
**Endpoint:** `GET /api/v1/specialists/queue`  
**Query Parameters:**
- `specialization` (optional)

**Returns:** Patients awaiting specialist review with priority order

### 9. Reports

#### Generate Stage-1 Report
**Endpoint:** `POST /api/v1/reports/stage1`  
```json
{
  "stage1_screening_id": "screening-uuid"
}
```
**Returns:** Downloadable report (PDF/JSON)

#### Generate Stage-2 Report
**Endpoint:** `POST /api/v1/reports/stage2`  
```json
{
  "stage2_diagnostic_id": "diagnostic-uuid"
}
```
**Returns:** Full diagnostic report with recommendations

---

## Frontline Staff Features

### Access Level
- **User Role:** `FRONTLINE_STAFF`
- **Permissions:** Create/view patients; perform Stage-1 screening sync; escalate to doctor; view own workload

### 1. Dashboard Access
**Endpoint:** `GET /api/v1/dashboard/frontline/dashboard`  
**Summary:** Frontline Triage Dashboard  
**Returns:**
```json
{
  "message": "Welcome to Frontline Dashboard",
  "dashboard": {
    "title": "Frontline Triage Dashboard",
    "features": [
      "Today's Queue",
      "Patient Vitals Log",
      "Quick Triage",
      "Escalation Requests",
      "Shift Summary"
    ]
  }
}
```

### 2. Patient Management

#### View Assigned Patients
**Endpoint:** `GET /api/v1/patients`  
**Returns:** Only patients assigned to this frontline worker

#### Create New Patient (Registration)
**Endpoint:** `POST /api/v1/patients`  
**Body:**
```json
{
  "national_id": "123456789V",
  "full_name": "Nimalka Fernando",
  "age": 28,
  "due_date": "2026-05-15",
  "contact_number": "+94712345678",
  "emergency_contact": "+94787654321",
  "blood_group": "O+"
}
```
**Returns:** New patient record with temporary password  
**Status:** HTTP 201

### 3. Stage-1 Triage Screening

#### Sync Triage Results from Mobile/Device
**Endpoint:** `POST /api/v1/triage/sync`  
**Body (Batch):**
```json
{
  "items": [
    {
      "patient_id": "pat-uuid",
      "encounter_id": "enc-001",
      "gestational_age_weeks": 28,
      "age": 31,
      "blood_pressure": { "systolic": 148, "diastolic": 96 },
      "bmi": 29.4,
      "heart_rate": 92,
      "temperature": 37.1,
      "blood_sugar": 135,
      "hemoglobin": 10.5,
      "pcos": 0,
      "previous_complications": 1,
      "preexisting_diabetes": 0,
      "mental_health": 4,
      "sleep_pattern": 6.5,
      "exercise": 2.5,
      "education": 3,
      "edge_risk_classification": "escalate",
      "edge_risk_score": 0.83,
      "device_id": "DEVICE-MOB-007",
      "collected_at": "2026-03-28T09:15:00Z"
    }
  ]
}
```
**Returns:**
```json
[
  {
    "patient_id": "pat-uuid",
    "encounter_id": "enc-001",
    "server_risk_tier": "escalate",
    "synced_at": "2026-03-28T09:45:00Z",
    "triage_flags": [
      "HYPERTENSION — BP ≥ 140/90. Elevated preeclampsia risk.",
      "OBESITY — BMI ≥ 30. Increased GDM and PE risk."
    ],
    "recommended_action": "ESCALATE to hospital-level care immediately.",
    "escalation_required": true
  }
]
```
**Status:** HTTP 201

### 4. Patient History Access

#### View Patient Screening History
**Endpoint:** `GET /api/v1/patients/{patient_id}/history`  
**Returns:**
- All Stage-1 screenings
- Linked Stage-2 diagnostics (if available)
- Risk timeline

### 5. Insights & Tracking

#### Get Patient Weekly Insight
**Endpoint:** `GET /api/v1/insights/patient/{patient_id}/this-week`  
**Returns:**
- Weekly development tracking
- Vitals trends
- Risk assessment
- Wellness metrics

---

## Patient Features

### Access Level
- **User Role:** `PATIENT`
- **Permissions:** View own record; book appointments; access health portal; view own insights

### 1. Dashboard Access
**Endpoint:** `GET /api/v1/dashboard/patient/dashboard`  
**Summary:** Patient Portal  
**Returns:**
```json
{
  "message": "Welcome to Your Health Portal",
  "dashboard": {
    "title": "Patient Portal",
    "features": [
      "My Appointments",
      "Appointment Booking",
      "Medical History",
      "Test Results",
      "Recommendations"
    ]
  }
}
```

### 2. Appointment Management

#### Get Available Specializations
**Endpoint:** `GET /api/v1/appointments/specializations`  
**Returns:**
```json
[
  { "name": "Maternal-Fetal Medicine", "specialist_count": 3 },
  { "name": "Obstetrics & Gynecology", "specialist_count": 5 }
]
```

#### Get Specialists by Specialization
**Endpoint:** `GET /api/v1/appointments/specialists/{specialization}`  
**Returns:** Array of doctors specializing in that area

#### Get Specialist Availability
**Endpoint:** `GET /api/v1/appointments/availability/{specialist_name}`  
**Query Parameters:**
- `days_ahead` (default: 14, max: 30)

**Returns:** Available time slots

#### Book Appointment
**Endpoint:** `POST /api/v1/appointments`  
**Body:**
```json
{
  "patient_id": "pat-uuid",
  "specialist_name": "Dr. Silva",
  "appointment_date": "2026-04-10T14:30:00",
  "reason": "Follow-up consultation"
}
```
**Returns:** New appointment object  
**Status:** HTTP 201

#### View My Appointments
**Endpoint:** `GET /api/v1/appointments/patient/{patient_id}`  
**Query Parameters:**
- `status` (optional) – Filter by PENDING, CONFIRMED, COMPLETED, CANCELLED

**Returns:** All appointments for patient

#### Reschedule Appointment
**Endpoint:** `PATCH /api/v1/appointments/{appointment_id}`  
**Body:**
```json
{
  "appointment_date": "2026-04-12T15:00:00"
}
```
**Returns:** Updated appointment

#### Cancel Appointment
**Endpoint:** `DELETE /api/v1/appointments/{appointment_id}`  
**Returns:** Cancelled appointment

### 3. Personal Health Insights

#### View Weekly Health Insight
**Endpoint:** `GET /api/v1/insights/patient/{patient_id}/this-week`  
**Returns:**
- Gestational age & fetal development
- Weekly vitals summary
- Personal risk assessment
- Wellness scores

#### View Weekly Quick Stats
**Endpoint:** `GET /api/v1/insights/patient/{patient_id}/stats`  
**Returns:**
- Screening count
- Risk scores
- Vital readings

### 4. Longitudinal Tracking

#### Get Longitudinal Health Profile
**Endpoint:** `GET /api/v1/longitudinal/patient/{patient_id}`  
**Returns:**
- Month-by-month development
- Risk trend over pregnancy
- Condition progression (if any)
- Historical biomarkers

---

## Public / Unauthenticated Features

### 1. Root Health Check
**Endpoint:** `GET /`  
**Returns:** Basic service status

### 2. Detailed Health Check
**Endpoint:** `GET /api/v1/health`  
**Returns:** Component health, version, timestamp

### 3. API Documentation

#### Swagger UI
**URL:** `{backend_url}/docs`  
**Description:** Interactive API exploration and testing

#### ReDoc
**URL:** `{backend_url}/redoc`  
**Description:** Alternative OpenAPI documentation view

---

## AI & ML Pipeline

### 1. Stage-1 Triage Screening
**Location:** Mobile App (on-device)  
**Engine:** TensorFlow Lite / PyTorch Mobile  
**Input:** Vital signs (BP, HR, Temp, BMI, blood sugar, etc.)  
**Output:** Risk classification (routine / escalate) + risk score  
**Speed:** <5 seconds on-device

**Risk Factors Detected:**
- Severe hypertension (SBP ≥ 160 or DBP ≥ 110)
- Hypertension (SBP ≥ 140 or DBP ≥ 90)
- Obesity (BMI ≥ 30)
- Elevated blood sugar (>6.0 mmol/L)
- Anemia (Hgb <10.5 g/dL)
- Mental health concerns
- Sleep deprivation
- Pre-existing diabetes
- PCOS history

### 2. Stage-2 ML Diagnostic Pipeline
**Location:** Backend (FastAPI)  
**Engine:** scikit-learn (Random Forest, K-Means clustering)  
**Processing Steps:**
1. **Winsorize** – Clip biomarkers to clinical reference ranges (WHO/NICE/RCOG)
2. **Impute** – Random Forest regression fills missing values
3. **Cluster** – K-Means assigns patient to phenotype cluster (5 total)
4. **Classify** – 5 condition-specific Random Forests score conditions
5. **Aggregate** – Weighted severity scoring for final risk assessment

**Input Biomarkers (17 total):**
- sFlt-1/PlGF ratio (placentaesis marker)
- PAPP-A (placental protein)
- Doppler indices (uterine, umbilical, MCA)
- Metabolomics (glucose, HbA1c, lipids, creatinine, uric acid)
- Cervical length (ultrasound)
- Platelet count (hemostasis)
- BMI (from Stage-1)
- TSH (thyroid function)

**Output:**
```json
{
  "cluster_id": 4,
  "cluster_label": "Multi-Factorial High-Risk",
  "condition_probabilities": [
    { "condition": "preeclampsia_early_onset", "probability": 0.816, "risk_category": "critical" },
    { "condition": "preeclampsia_late_onset", "probability": 0.54, "risk_category": "high" },
    { "condition": "gestational_diabetes_mellitus", "probability": 0.31, "risk_category": "moderate" },
    { "condition": "preterm_birth", "probability": 0.62, "risk_category": "high" }
  ],
  "overall_severity_score": 0.68,
  "dominant_condition": "preeclampsia_early_onset"
}
```

**Conditions Detected:**
- **Preeclampsia (Early-Onset)** – <34 weeks gestation
- **Preeclampsia (Late-Onset)** – ≥34 weeks gestation
- **Gestational Diabetes Mellitus (GDM)** – Blood glucose abnormalities
- **Preterm Birth Risk** – Cervical insufficiency, biophysical markers

### 3. GenAI Clinical Explanations
**Model:** OpenAI GPT-4o (with mock fallback)  
**Purpose:** Generate human-readable multilingual explanations for clinical findings

**Input:** Full ML diagnostic output  
**Output:** Structured explanations in:
- **English** – Clinical summary + evidence + next steps
- **Sinhala** – සිංහල හඳුන්වා දීම: ක්‍රීනිකල් පනිවිඩ
- **Tamil** – தமிழ் தெளிவு: மருத்துவ சுருக்கமும் அடுத்த படிகளும்

**Current Status:** Mock mode (template responses)  
To enable real GPT-4o:
1. Get OpenAI API key
2. Set `OPENAI_API_KEY=sk-...` in `backend/.env`
3. Set `BLOOMCARE_MOCK_LLM=false` in `backend/.env`
4. Restart backend server

---

## Frontend Features

### 1. Authentication (All Roles)

#### Patient Login
- **Login Endpoint:** `/auth/login/patient`
- **Method:** National ID + Password
- **First Login:** Reset password + choose security questions

#### Staff/Doctor Login
- **Login Endpoint:** `/auth/login/staff`
- **Method:** Email + Password
- **First Login:** Accept terms + set password

#### Profile Management
**Endpoint:** `GET /auth/profile`  
**Endpoint:** `PATCH /auth/profile`  
**Features:**
- View/update contact information
- Change password (8+ chars, mixed case, digit, special char)
- Manage emergency contacts (patient only)

### 2. Trilingual Chatbot (Frontend)

#### Technology
- **Type:** Key-answer based (no external API dependency)
- **Languages:** English, Sinhala, Tamil
- **Intent Matching:** Keyword + contextual awareness
- **Navigation:** Auto-routes to login, features, conditions, dashboard, home

#### Endpoints
**Chatbot API:** `POST /api/chatbot`  
**Body:**
```json
{
  "message": "How do I log in?",
  "currentView": "home",
  "currentRole": "patient"
}
```

**Response:**
```json
{
  "reply": "Go to Login, enter your credentials, and you will reach your role-based dashboard.",
  "navigateTo": "login",
  "mode": "key-answer",
  "language": "en"
}
```

#### Supported Intents
1. **Greeting** – വ.Sinhala: "ආයුබෝවන්" | Tamil: "வணக்கம்"
2. **Login** – Sinhala: "ලොගින්" | Tamil: "உள்நுழை"
3. **Features** – Sinhala: "විශේෂාංග" | Tamil: "அம்சங்கள்"
4. **Conditions** – Sinhala: "තත්ත්ව" | Tamil: "நிலை"
5. **Dashboard** – Sinhala: "dashboard" | Tamil: "dashboard"
6. **Home** – Sinhala: "මුල් පිටුව" | Tamil: "முகப்பு"
7. **Where Am I?** – Sinhala: "මම කොහෙද" | Tamil: "நான் எங்கே"
8. **Help** – Returns feature overview in selected language

### 3. Admin Dashboard
- Staff management (create, list, search)
- Patient management (register, view all, assign to staff)
- Appointment management (approve, reschedule, cancel)
- Analytics & reporting
- System health monitoring

### 4. Clinical Dashboard (Doctor/Specialist)
- Today's appointments
- Patient queue with risk flags
- Quick patient lookup
- Stage-2 diagnosis launcher
- Clinical notes editor
- Referral manager

### 5. Frontline Dashboard
- Assigned patient list + triage queue
- Quick vitals entry
- Stage-1 risk assessment preview
- Escalation button
- Shift summary

### 6. Patient Portal
- My appointments (book, view, reschedule, cancel)
- Medical history timeline
- Test results & reports
- Weekly health insight
- Appointment reminders

### 7. Navigation Features
- Role-based sidebar menu
- Quick links to common actions
- Breadcrumb trail
- Search functionality (patients, specialists, appointments)

---

## Authentication & Security

### 1. JWT Bearer Token
- **Token Generation:** After successful login
- **Expiration:** 30 minutes (configurable)
- **Refresh:** Re-login to get new token
- **Header:** `Authorization: Bearer <token>`

### 2. Password Requirements
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 digit
- At least 1 special character (!@#$%^&*)

### 3. Phone Number Format (Sri Lanka)
- `+94XXXXXXXXX` (international)
- `0XXXXXXXXX` (local)
- Normalized before storage

### 4. Role-Based Access Control (RBAC)
| Role | API Paths | Dashboard | Can Create | Can Approve |
|------|-----------|-----------|-----------|------------|
| ADMIN | `/api/v1/*` | Admin | Staff, Patients | All appointments |
| CLINICAL_SPECIALIST | `/api/v1/diagnose/*`, `/api/v1/patients?` | Clinical | None | Own appointments |
| FRONTLINE_STAFF | `/api/v1/patients?`, `/api/v1/triage/sync` | Frontline | Patients | None (escalate only) |
| PATIENT | `/api/v1/appointments/*`, `/api/v1/insights/my/*` | Patient Portal | None | None |

### 5. CORS Configuration
**Allowed Origins:**
- `http://localhost:3000`
- `http://127.0.0.1:3000`
- `https://localhost:3000`
- `https://127.0.0.1:3000`
- `http://localhost:8005` (mobile dev)
- `http://127.0.0.1:8005` (mobile dev)
- Plus regex: `https?://(localhost|127\.0\.0\.1)(:\d+)?$`

---

## API Health & Monitoring

### 1. Root Endpoint
**Endpoint:** `GET /`  
**Response:**
```json
{
  "service": "BloomCare Maternal Risk Intelligence API",
  "status": "healthy"
}
```

### 2. Liveness Probe (Docker/K8s)
**Endpoint:** `GET /health`  
**Purpose:** Container orchestration health check

### 3. Detailed Component Health
**Endpoint:** `GET /api/v1/health`  
**Response:**
```json
{
  "service": "BloomCare",
  "version": "2.0.0",
  "status": "healthy",
  "timestamp": "2026-03-28T10:15:00Z",
  "components": {
    "database": "connected",
    "ml_pipeline": "ready",
    "openai_api": "mock_mode"
  }
}
```

### 4. Running Backend
```powershell
# Development (with auto-reload)
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload --log-level info

# Production (multi-worker)
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8001 --workers 4 --log-level warning
```

### 5. Testing
```powershell
# From aithon\ root directory
python -m pytest backend/tests/test_api.py -v

# Expected test results:
# PASSED test_health_check
# PASSED test_triage_sync
# PASSED test_diagnose_full_panel
# PASSED test_diagnose_minimal_biomarker
# PASSED test_assistant_explain_mock
```

---

## Summary Table: Feature Completeness

| Feature | Status | Notes |
|---------|--------|-------|
| Patient Registration | ✅ Complete | Admin/Frontline can create |
| Patient Login | ✅ Complete | National ID + password |
| Staff Management | ✅ Complete | Temp passwords, role assignment |
| Stage-1 Triage Sync | ✅ Complete | Batch import from mobile |
| Stage-2 Diagnosis | ✅ Complete | 4 condition models (PE, GDM, PTB) |
| Appointments | ✅ Complete | Book, reschedule, cancel |
| Reports | ✅ Complete | Stage-1, Stage-2 (PDF/JSON) |
| Insights & Tracking | ✅ Complete | Weekly dashboard, stats |
| Differential Diagnosis | ✅ Complete | Ranked condition suggestions |
| GenAI Explanations | ✅ Partial | Mock mode; real OpenAI optional |
| Chatbot (Trilingual) | ✅ Complete | English, Sinhala, Tamil |
| Admin Dashboard | ✅ Complete | Staff, patient, analytics |
| Clinical Dashboard | ✅ Complete | Appointments, queue, diagnosis |
| Frontline Dashboard | ✅ Complete | Patient queue, triage entry |
| Patient Portal | ✅ Complete | Appointments, history, insights |
| Multi-Role RBAC | ✅ Complete | 4 roles with granular permissions |

---

## Quick Start Commands

### Backend
```powershell
cd c:\Users\user\OneDrive\Desktop\New folder (5)\aithon

# Activate venv
.\.venv\Scripts\Activate.ps1

# Start server
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload

# Access docs
# Swagger: http://localhost:8001/docs
# ReDoc: http://localhost:8001/redoc
```

### Frontend
```powershell
cd c:\Users\user\OneDrive\Desktop\New folder (5)\aithon\frontend

# Install dependencies (if first time)
npm install

# Start dev server
npm run dev

# Access UI
# http://localhost:3000
```

### Chatbot Testing
**English:**
```
"How do I log in?"
"What are the features?"
"Where is the dashboard?"
```

**Sinhala:**
```
"ලොගින් කොහොමද?"
"විශේෂාංග කුමක්ද?"
"තත්ත්ව කුමක්ද?"
```

**Tamil:**
```
"உள்நுழைவு எப்படி செய்ய வேண்டும்?"
"அம்சங்கள் என்ன?"
"நிலைகள் என்ன?"
```

---

**Document Generated:** April 3, 2026  
**For Questions:** Contact BloomCare Development Team  
**Version Control:** Git commit hash available on request
