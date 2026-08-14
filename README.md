# BloomCare

**AI-powered maternal healthcare platform** for early risk screening, clinical triage, specialist decision support, appointments, prescriptions, longitudinal tracking, and role-based care workflows.

BloomCare is designed for low-connectivity clinical environments. It combines an offline-first Stage 1 screener (web + mobile) with server-side Stage 2 diagnostics for preeclampsia, gestational diabetes (GDM), and preterm birth risk — plus explainable AI outputs and multilingual UI (English, Sinhala, Tamil).

> **Demo deployment (AWS):** [http://54.206.93.158](http://54.206.93.158)  
> Demo only — not secure and **must not** be used for production or real patient data.

---

## Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Architecture](#architecture)
4. [Repository Structure](#repository-structure)
5. [Tech Stack](#tech-stack)
6. [Prerequisites](#prerequisites)
7. [Quick Start](#quick-start)
8. [Configuration](#configuration)
9. [Running Each Component](#running-each-component)
10. [AI / ML Pipeline](#ai--ml-pipeline)
11. [API Overview](#api-overview)
12. [Offline-First Behavior](#offline-first-behavior)
13. [User Roles & Portals](#user-roles--portals)
14. [Development Scripts](#development-scripts)
15. [Testing](#testing)
16. [Troubleshooting](#troubleshooting)
17. [Security & Compliance Notes](#security--compliance-notes)
18. [License & Attribution](#license--attribution)

---

## Overview

BloomCare supports the full care pathway from community-level screening to specialist intervention:

| Layer | Responsibility |
|-------|----------------|
| **Web frontend** | Role-based portals for frontline staff, clinicians, admins, and patients |
| **Mobile app** | Offline Stage 1 triage, PIN login, queue + sync |
| **Backend API** | Auth, patients, triage sync, Stage 2 diagnosis, appointments, prescriptions, analytics |
| **ML models** | Stage 1 on-device risk; Stage 2 multi-condition diagnostics with explainability |

**Clinical focus areas**

- Preeclampsia risk
- Gestational diabetes (GDM)
- Preterm birth risk
- Escalation and referral workflows
- Longitudinal vital and screening trends

---

## Key Features

### Authentication & onboarding

- Role-based sign-in: frontline staff, clinician/specialist, admin, patient
- Patient login via national ID; staff login via email
- First-login password setup for new accounts
- Session persistence across refreshes
- Multilingual auth UI (English / Sinhala / Tamil)

### Frontline staff portal

- Search and register patients
- Capture Stage 1 vitals, pregnancy history, and risk factors
- Online or offline risk scoring with local queue + reconnect sync
- Referral cards / screening summaries
- Appointment booking (specialization, specialist, date, time slot)
- Notifications when doctors confirm, cancel, or complete appointments
- Profile settings and language switching

### Doctor / clinical specialist portal

- Escalated patient queue and histories
- Stage 1 + Stage 2 review, risk trends, and explainability
- Differential diagnosis outputs
- Appointment status management (confirm / complete / cancel)
- Prescriptions (dosage, frequency, route, instructions)
- Clinical reports and notifications

### Patient portal

- Pregnancy progress, trimester, due-date countdown
- Screening history, vitals trends, and AI explanations
- Appointments, prescriptions, and notifications
- Weekly pregnancy guidance / insights
- Cached offline viewing when available

### Admin portal

- Analytics dashboards and KPIs
- High-risk counts, clinic trends, workload distribution
- Monthly screening report export
- Staff account creation and management

### Shared capabilities

- Offline-first screening with service worker + web app manifest
- AI assistant / chatbot for navigation and guidance
- Notification badges and read/unread filtering
- Responsive desktop and mobile layouts
- Role-based access control (RBAC)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Clients                                          │
│  ┌─────────────────────┐              ┌──────────────────────────────┐   │
│  │  Next.js Web App    │              │  Expo / React Native Mobile  │   │
│  │  (role portals)     │              │  (offline Stage 1 + sync)    │   │
│  │  + stage1_offline   │              │  + SQLite / SecureStore      │   │
│  └──────────┬──────────┘              └──────────────┬───────────────┘   │
└─────────────┼────────────────────────────────────────┼───────────────────┘
              │  HTTPS / JWT                           │
              ▼                                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     FastAPI Backend (`/api/v1`)                          │
│  Auth · Patients · Triage · Diagnose · Differential · Appointments       │
│  Prescriptions · Notifications · Insights · Admin Analytics              │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
     ┌────────────────────┐          ┌────────────────────┐
     │  PostgreSQL        │          │  ML Artifacts      │
     │  (primary)         │          │  Stage 1 / Stage 2 │
     │  SQLite fallback   │          │  + SHAP / LLM      │
     └────────────────────┘          └────────────────────┘
```

**Two-stage AI design**

| Stage | Where it runs | Purpose |
|-------|---------------|---------|
| **Stage 1 – Triage** | Browser / mobile (`stage1_offline_ai.js`) | Fast vitals-based risk for frontline use, including offline |
| **Stage 2 – Diagnosis** | Backend (`.pkl` models) | Condition-focused scoring for PE, GDM, preterm + explainability |

---

## Repository Structure

```
.
├── frontend/                 # Next.js 16 + React 19 web app
│   ├── app/                  # App Router entry + API routes
│   ├── components/           # Portals, dashboards, chatbot, UI
│   ├── lib/                  # API client, utils, weekly insights
│   ├── public/               # PWA assets, offline Stage 1 script
│   └── package.json
│
├── backend/                  # FastAPI service
│   ├── api/v1/               # Route modules
│   ├── core/                 # Config, security, deps
│   ├── db/                   # Session, schema init
│   ├── models/               # SQLAlchemy models
│   ├── schemas/              # Pydantic request/response models
│   ├── services/             # Auth, ML, appointments, admin, etc.
│   ├── docker-compose.yml    # PostgreSQL
│   └── requirements.txt
│
├── mobile/                   # Expo React Native app
│   ├── src/screens/          # Login, patient, frontline
│   ├── src/services/         # Offline DB, sync, auth, risk engine
│   └── package.json
│
├── models/                   # Training / export scripts + model artifacts
├── Data/                     # Training datasets and cleaning scripts
├── bloomcare_local.db        # SQLite fallback DB (created when Postgres is down)
├── stage1_offline_ai.js      # Stage 1 inference bundle (also copied under frontend/mobile)
├── stage1_general_risk_screener.pkl
├── stage2_*.pkl              # Stage 2 condition models (also under models/)
├── requirements.txt          # ML training deps (pandas, sklearn, …)
├── start.bat                 # Legacy Windows helper (prefer uvicorn below)
├── README.md                 # This file
└── LICENSE
```

Additional docs:

| Document | Location |
|----------|----------|
| Backend deep dive | [`backend/README.md`](backend/README.md) |
| Mobile app README | [`mobile/README.md`](mobile/README.md) |
| Mobile offline guide | [`mobile/OFFLINE_IMPLEMENTATION_GUIDE.md`](mobile/OFFLINE_IMPLEMENTATION_GUIDE.md) |
| Mobile quick start | [`mobile/QUICK_START.md`](mobile/QUICK_START.md) |
| Screen update notes | [`mobile/SCREEN_UPDATE_GUIDE.md`](mobile/SCREEN_UPDATE_GUIDE.md) |
| Technical presentation script | [`script.md`](script.md) |

---

## Tech Stack

| Area | Technologies |
|------|----------------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Radix UI, Recharts |
| **Backend** | FastAPI, Uvicorn, SQLAlchemy 2, Pydantic Settings, JWT (python-jose), Passlib |
| **Database** | PostgreSQL 15 (Docker Compose); SQLite fallback (`bloomcare_local.db`) if Postgres is unavailable |
| **Mobile** | Expo ~53, React Native 0.79, TypeScript, Expo SQLite, SecureStore, NetInfo |
| **ML** | scikit-learn, joblib, pandas, numpy, SHAP (optional), exported JS Stage 1 model |
| **LLM / explainability** | OpenAI (optional, mock mode available), Groq (frontend explain route) |

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ (20+ recommended) | Frontend and mobile |
| npm | 9+ | Comes with Node |
| Python | 3.10+ (3.11+ recommended) | Backend and model training |
| Docker Desktop | Optional but recommended | Runs PostgreSQL via Compose |
| Expo Go | Optional | Device testing for mobile |
| Git | Latest | Source control |

---

## Quick Start

Run all commands from this repository root (the folder that contains `frontend/`, `backend/`, and `mobile/`).

### 1. Start PostgreSQL

```bash
cd backend
docker compose up -d
cd ..
```

Default Compose credentials (see `backend/docker-compose.yml` and `backend/core/config.py`):

- **User:** `bloomcare_user`
- **Password:** `bloomcare_pass`
- **Database:** `bloomcare_db`
- **Port:** `5432`

Initialize schema / seed:

```bash
python backend/db/init_db.py
```

If PostgreSQL is not running, the backend automatically falls back to SQLite at `./bloomcare_local.db` in this repo root (relative to the process working directory). Always start uvicorn from the repo root so that fallback path stays consistent.

### 2. Configure environment files

```bash
# Backend
copy backend\.env.example backend\.env

# Frontend
copy frontend\.env.example frontend\.env.local
```

On macOS/Linux use `cp` instead of `copy`.

Set the frontend backend URL (recommended local default):

```env
# frontend/.env.local
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8001
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8001/api/v1
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8001/api/v1
```

Keep `BLOOMCARE_MOCK_LLM=true` in `backend/.env` if you do not have an OpenAI key.

### 3. Install and run the backend

```bash
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# Windows CMD
.\.venv\Scripts\activate.bat

# macOS / Linux
source .venv/bin/activate

pip install -r backend/requirements.txt

# Must run from repo root (parent of backend/), not from inside backend/
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload --log-level info
```

Verify:

- Root: [http://127.0.0.1:8001](http://127.0.0.1:8001)
- Swagger: [http://127.0.0.1:8001/docs](http://127.0.0.1:8001/docs)
- ReDoc: [http://127.0.0.1:8001/redoc](http://127.0.0.1:8001/redoc)

### 4. Install and run the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. (Optional) Run the mobile app

```bash
cd mobile
npm install
npm run start
```

Point the app at your LAN API (see [Configuration](#configuration)). Scan the Expo QR code with Expo Go.

---

## Configuration

### Backend (`backend/.env`)

| Variable | Purpose | Typical local value |
|----------|---------|---------------------|
| `OPENAI_API_KEY` | Live clinical explanations | Optional |
| `BLOOMCARE_OPENAI_MODEL` | OpenAI model name | `gpt-4o` |
| `BLOOMCARE_MOCK_LLM` | Use offline mock LLM | `true` for local dev |
| `BLOOMCARE_PORT` | Documented API port in `.env.example` | `8001` |
| `SECRET_KEY` | JWT signing key | Change in production |
| `POSTGRES_*` | Database connection | Matches Docker Compose |

Database settings also default in `backend/core/config.py` if unset.

### Frontend (`frontend/.env.local`)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_BACKEND_URL` | Backend origin (used by `frontend/lib/api.ts`; default `http://127.0.0.1:8001`) |
| `NEXT_PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_API_BASE` | API base including `/api/v1` |
| `NEXT_PUBLIC_AUTH_TOKEN_KEY` | localStorage key for access token |
| `GROQ_API_KEY` | Server-side explainability route (optional) |

### Mobile

Set API base via Expo public env, or edit the default in `mobile/src/config/api.ts`:

```bash
# Example (PowerShell) — use the same port as uvicorn
$env:EXPO_PUBLIC_API_BASE_URL="http://192.168.1.50:8001/api/v1"
npm run start
```

| Target | Suggested API host |
|--------|--------------------|
| Android emulator | `http://10.0.2.2:8001/api/v1` |
| Physical device | `http://<YOUR_LAN_IP>:8001/api/v1` |

Phone and laptop must be on the same Wi‑Fi. Avoid VPN during local LAN testing.

> **Port note:** Mobile defaults to `http://127.0.0.1:8001/api/v1`. For a physical device or Android emulator, set `EXPO_PUBLIC_API_BASE_URL` (see `mobile/.env.example`) so mobile, frontend, and uvicorn all use **8001**.

---

## Running Each Component

### Backend (production-style)

```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8001 --workers 4 --log-level warning
```

### Frontend (production build)

```bash
cd frontend
npm run build
npm run start
```

### Mobile native builds

```bash
cd mobile
npm run android   # Expo run:android
npm run ios       # Expo run:ios (macOS)
npm run typecheck
```

### Model training / export

Training scripts live under `models/` (for example `stage1.py`, `preeclam.py`, `gdm.py`, `prematureb.py`, `export_js.py`).

```bash
pip install -r requirements.txt
# plus any extra deps used by a specific script (e.g. imbalanced-learn for Stage 1)
python models/stage1.py
```

Exported Stage 1 JS is used by the web PWA (`frontend/public/scripts/stage1_offline_ai.js`) and mobile (`mobile/src/services/stage1_offline_ai.js`).

### Legacy `start.bat`

`start.bat` still references a removed `api.py` / `api_requirements.txt` layout. Prefer the uvicorn command in [Quick Start](#quick-start).

---

## AI / ML Pipeline

### Stage 1 — Frontline triage

- Inputs: vitals and basic maternal risk factors (BP, HR, BMI, glucose, history flags, etc.)
- Runtime: on-device JS model (`stage1_offline_ai.js`) with optional server fallback
- Outputs: risk level / score, recommendations, escalation triggers
- Clinical threshold helpers (examples): systolic ≥ 140, diastolic ≥ 90, heart rate ≥ 100, blood sugar ≥ 7.8

### Stage 2 — Specialist diagnostics

Condition-focused artifacts (under repo root and `models/`):

| Artifact | Focus |
|----------|--------|
| `models/stage2_diagnostic.pkl` | Preeclampsia-focused prediction |
| `models/stage2_gdm_diagnostic.pkl` | Gestational diabetes |
| `stage2_preterm_main_msf.pkl` / `models/stage2_preterm_main_msf.pkl` | Primary preterm model |
| `stage2_preterm_support_ehg.pkl` / `models/stage2_preterm_support_ehg.pkl` | Support / fallback preterm model |

Specialist differential evaluation can score PE, GDM, and preterm in parallel and select a primary risk from calibrated probabilities. Preterm scoring may blend main + support models when informative signal exists, otherwise falls back to main-only.

### Explainability

- SHAP when available
- Fallback to model feature importance or local sensitivity estimates
- Multilingual clinical explanations via OpenAI (or mock LLM in development)

Risk outputs are normalized into categories such as **Low / Moderate / High** and persisted with diagnostic records for audit and longitudinal review.

---

## API Overview

Base path: **`/api/v1`**

| Area | Prefix / routes | Description |
|------|-----------------|-------------|
| Auth | `/auth` | Staff & patient login, registration |
| Patients | `/patients`, `/patient-management` | Patient records and management |
| Triage | `/triage` | Stage 1 predict / sync from edge devices |
| Diagnose | `/diagnose` | Stage 2 diagnostic pipeline |
| Differential | differential + specialist routers | Multi-condition evaluation |
| Appointments | `/appointments` | Scheduling and status updates |
| Prescriptions | `/prescriptions` | Medication orders |
| Notifications | `/notifications`, `/staff/...` | Patient & staff alerts |
| Insights | `/insights` | Weekly development / pregnancy insights |
| Dashboard | `/dashboard` | Role-protected dashboards |
| Admin | `/admin` | Analytics and operational KPIs |
| Assistant | `/assistant` | GenAI clinical explanations |
| Reports | `/reports` | Clinical reporting |
| Longitudinal | longitudinal routes | Trend / history tracking |
| Health | `/` and health routes | Liveness / readiness |

Interactive docs: **`http://127.0.0.1:8001/docs`** after the API is running.

JWT auth: obtain a token from `/api/v1/auth/login/staff` or `/api/v1/auth/login/patient`, then send `Authorization: Bearer <token>`.

---

## Offline-First Behavior

### Web

- Service worker + web app manifest for PWA-style use
- Local queue for screenings when offline
- Stage 1 AI fallback when the backend is unreachable
- Reconnect sync when connectivity returns

### Mobile

- SQLite offline database (profiles, appointments, insights, screening history, pending sync queue)
- SecureStore for hashed PIN and JWT
- Online credential login → optional PIN setup for offline access
- Staff morning sync downloads assigned patients for disconnected clinics
- Background / manual sync flushes pending operations on reconnect

**Known offline limits**

- New patient registration typically requires online NIC validation
- Staff can only work with the morning-synced patient set while offline
- Chat / messaging is online-only

See [`mobile/QUICK_START.md`](mobile/QUICK_START.md) and [`mobile/OFFLINE_IMPLEMENTATION_GUIDE.md`](mobile/OFFLINE_IMPLEMENTATION_GUIDE.md) for detailed flows.

---

## User Roles & Portals

| Role | Primary UI | Typical tasks |
|------|------------|---------------|
| **Frontline staff** | Frontline triage dashboard / mobile staff screen | Register, screen, escalate, book appointments |
| **Clinician / specialist** | Clinical dashboard | Review escalations, Stage 2, prescribe, manage appointments |
| **Patient** | Patient portal / mobile patient screen | View progress, results, Rx, appointments, insights |
| **Admin** | Admin / KPI dashboards | Analytics, staff accounts, report export |

---

## Development Scripts

### Frontend (`frontend/`)

```bash
npm run dev      # Development server (port 3000)
npm run build    # Production build
npm run start    # Serve production build
npm run lint     # ESLint
```

### Mobile (`mobile/`)

```bash
npm run start
npm run android
npm run ios
npm run web
npm run typecheck
```

### Backend (from repo root)

```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload
python backend/db/init_db.py
```

---

## Testing

Backend (from repo root):

```bash
python -m pytest backend/tests -v
```

Mobile typecheck:

```bash
cd mobile
npm run typecheck
```

Suggested manual checks:

1. Staff login → Stage 1 screening online → risk returned  
2. Disable network → Stage 1 still scores via offline model  
3. Reconnect → queued records sync  
4. Specialist differential evaluation returns PE / GDM / preterm probabilities  
5. Patient portal shows appointments, prescriptions, and insights  
6. Admin KPI charts and staff management load  

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| Frontend cannot reach API | Confirm uvicorn is on the same host/port as `NEXT_PUBLIC_BACKEND_URL` |
| CORS errors | Ensure origin is `http://localhost:3000` (allowed in `backend/main.py`) |
| DB connection errors | `docker compose up -d` in `backend/`; verify `POSTGRES_*` credentials |
| Unexpected empty local data | Confirm uvicorn was started from repo root so SQLite uses `./bloomcare_local.db` (not a second copy under `backend/`) |
| Mobile assess hangs | Fix LAN IP / port; open `http://<LAN_IP>:8001/` from the phone browser; override the mobile `8005` default |
| SHAP install fails | Use `backend/requirements-no-shap.txt` if needed; explainability falls back |
| LLM / assistant errors | Set `BLOOMCARE_MOCK_LLM=true` for local development |
| `ModuleNotFoundError: backend` | Run uvicorn from the repo root, not from inside `backend/` |
| Port conflicts | Change uvicorn port and update frontend/mobile env vars to match |

---

## Security & Compliance Notes

- Change `SECRET_KEY` and database passwords before any shared or production deployment.
- Never commit real `.env` files (see `.gitignore`).
- Demo AWS host is **not** hardened for PHI / real clinical use.
- `bloomcare_local.db` is a local fallback database — do not treat it as production storage.
- Mobile SQLite is typically unencrypted; sensitive deployments should consider encrypted storage.
- Prefer HTTPS in production; keep JWT lifetimes and CORS allow-lists tight.
- BloomCare outputs support clinical decision-making but do **not** replace professional medical judgment.

---

## License & Attribution

- License: **MIT** — see [`LICENSE`](LICENSE)
- Copyright © 2026 Rashmi Paboda
- Built for maternal healthcare workflows with multilingual support for Sri Lanka (English / Sinhala / Tamil)

---

## Related Documentation

- [`backend/README.md`](backend/README.md) — API, ML pipeline, and backend ops  
- [`mobile/README.md`](mobile/README.md) — Mobile Stage 1 offline app  
- [`script.md`](script.md) — 5-minute technical presentation script  

---

**BloomCare** — offline-capable maternal risk intelligence from frontline screening to specialist care.
