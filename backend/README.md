# BloomCare Backend

FastAPI service for BloomCare maternal risk workflows: auth, patients, Stage‑1 triage sync, Stage‑2 diagnostics, appointments, prescriptions, notifications, insights, and admin analytics.

Canonical setup instructions live in the **[root README](../README.md)**. This file is a backend-focused summary only.

> Demo only — not hardened for production or real patient data.

---

## Stack

| Piece | Tech |
|-------|------|
| API | FastAPI + Uvicorn |
| ORM | SQLAlchemy 2 + Pydantic v2 |
| Auth | JWT (`python-jose`) + Passlib |
| DB | PostgreSQL 15 (Docker Compose) or SQLite fallback (`bloomcare_local.db` at repo root) |
| ML | Joblib Stage‑2 models (PE / GDM / preterm); optional SHAP |
| LLM | OpenAI (optional); `BLOOMCARE_MOCK_LLM=true` for local demos |

---

## Layout

```
backend/
├── main.py              # FastAPI app entry
├── api/api_router.py    # Mounts /api/v1 routers
├── api/v1/              # Route modules
├── core/                # Config, security, deps
├── db/                  # Session, schema, seeds, migrations
├── models/              # SQLAlchemy models
├── schemas/             # Pydantic schemas
├── services/            # Business logic + ML helpers
├── tests/               # pytest suite
├── docker-compose.yml   # PostgreSQL
├── requirements.txt
└── .env.example
```

---

## Quick start (from repo root)

```bash
# Optional Postgres
cd backend && docker compose up -d && cd ..

copy backend\.env.example backend\.env   # or cp on macOS/Linux

python -m venv .venv
# activate .venv, then:
pip install -r backend/requirements.txt
pip install -r backend/requirements-dev.txt   # for tests

python -m uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload
```

- API: http://127.0.0.1:8001  
- Swagger: http://127.0.0.1:8001/docs  

Always run uvicorn from the **repo root** (parent of `backend/`).

---

## Configuration

See `backend/.env.example`. Important keys:

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY` | JWT signing key — **change before any shared deploy** |
| `POSTGRES_*` | Matches `docker-compose.yml` |
| `BLOOMCARE_MOCK_LLM` | `true` for demos without OpenAI |
| `OPENAI_API_KEY` | Optional live explanations |

If Postgres is unreachable, the app falls back to SQLite at `BloomCare/bloomcare_local.db` and auto-seeds demo accounts.

---

## Auth & roles

Staff / patient login: `/api/v1/auth/login/staff` and `/api/v1/auth/login/patient`.

| Role | Typical access |
|------|----------------|
| `FRONTLINE_STAFF` | Patients, triage, appointments |
| `CLINICAL_SPECIALIST` | Escalations, Stage‑2 diagnose, prescriptions |
| `ADMIN` | Analytics, staff creation (`/staff-management/*`) |
| `PATIENT` | Own portal data |

Legacy role alias `OBSERTITIAN` still maps to `CLINICAL_SPECIALIST` for old rows. Demo specialist email: `obstetrician@bloomcare.health`.

Management routes require JWT:

- `/patient-management/*` — clinic staff (frontline / specialist / admin)
- `/staff-management` create/list — **admin only**

---

## Stage‑2 ML

Pre-trained artifacts under `models/` / repo root (`.pkl`). Pipeline details and condition models are described in the root README **AI / ML Pipeline** section. Explainability uses SHAP when available, otherwise feature-importance fallbacks; LLM explanations are mockable.

---

## Tests

```bash
# from repo root
python -m pytest backend/tests -v
```

Coverage includes health/OpenAPI smoke, demo login, role aliasing, JWT helpers, demo seeds, and frontend demo-credential contract.

---

## Production notes (honest)

This backend is a **portfolio / interview demo**. Before any real deployment you would still need: rotated secrets, HTTPS, locked CORS, encrypted storage, PHI-safe ops, and clinical validation. Do not claim FHIR R4 or production-grade RBAC beyond what the routes enforce today.
