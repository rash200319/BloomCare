### Initial setup (one-time)

# 1. Start Docker Desktop, then start PostgreSQL container
cd backend
docker compose up -d
cd ..

# 2. Create Python virtual environment
python -m venv .venv

# 3. Activate it (Windows PowerShell)
.\.venv\Scripts\Activate.ps1

# 4. Install backend dependencies
pip install -r backend/requirements.txt

# 5. Initialize DB schema + seed demo accounts
python backend/db/init_db.py

# 6. Install frontend dependencies
cd frontend
npm install
cd ..


#### Daily run
Open two terminals from the repo root (d:\Git\BloomCare2\BloomCare):

## Terminal 1 — Postgres + Backend
# Make sure Docker Desktop is running, then:
cd backend
docker compose up -d
cd ..

.\.venv\Scripts\Activate.ps1
python -m uvicorn backend.main:app --host 0.0.0

## Terminal 2 — Frontend
cd frontend
npm run dev
Then open http://localhost:3000 (backend Swagger docs at http://127.0.0.1:8001/docs).


### To stop everything
# Ctrl+C in each terminal to stop uvicorn / npm run dev, then:
cd backend
docker compose down     # stops Postgres container (keeps data)
