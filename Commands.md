### Initial setup (one-time)

# 1. Start Docker Desktop, then start PostgreSQL and Temporal containers
cd backend
docker compose up -d
cd ..
docker compose -f infra/temporal/docker-compose.yml up -d

# 2. Create Python virtual environment
python -m venv .venv

# 3. Activate it (Windows PowerShell)
.\.venv\Scripts\Activate.ps1

# 4. Install backend dependencies
pip install -r backend/requirements.txt

# 5. Initialize DB schema + seed demo accounts
python backend/db/init_db.py

# 6. Confirm backend/.env has TEMPORAL_ENABLED=true (required for appointment
#    self-service booking + reminders to actually run; see below)

# 7. Install frontend dependencies
cd frontend
npm install
cd ..


#### Daily run
Open three terminals from the repo root (d:\Git\BloomCare2\BloomCare):

## Terminal 1 — Postgres + Temporal + Backend API
# Make sure Docker Desktop is running, then:
cd backend
docker compose up -d
cd ..
docker compose -f infra/temporal/docker-compose.yml up -d

.\.venv\Scripts\Activate.ps1
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001 --reload

## Terminal 2 — Temporal worker (required for patient self-service bookings
## and reminders; frontline-staff-created appointments don't need it)
.\.venv\Scripts\Activate.ps1
python -m backend.orchestration.appointments.worker --reload
# --reload watches the backend/ directory and restarts the worker on file
# changes (same watchfiles package uvicorn's own --reload uses). Without it,
# editing workflow.py/activities.py/contracts.py has zero effect on a
# running worker -- it keeps executing whatever was loaded at startup until
# manually restarted. Drop --reload for a production-style single run.
#
# TEMPORAL_ENABLED=false in backend/.env now makes this refuse to start
# (logs an error, exits 1) instead of silently orchestrating anyway.

## Terminal 3 — Frontend
cd frontend
npm run dev
Then open http://localhost:3000 (backend Swagger docs at http://127.0.0.1:8001/docs,
Temporal UI at http://localhost:8088).

The asynchronous patient booking API is `POST /api/v1/appointment-operations`.
Without Terminal 2 running, that endpoint still returns 202 Accepted, but the
booking sits queued and unprocessed — no validation, no appointment, no
reminders — until a worker is running to pick it up.


### To stop everything
# Ctrl+C in each terminal to stop uvicorn / the worker / npm run dev, then:
cd backend
docker compose down     # stops Postgres container (keeps data)
cd ..
docker compose -f infra/temporal/docker-compose.yml down   # stops Temporal (keeps data)
