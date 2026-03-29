#  BloomCare Backend README

This repository contains the backend for the BloomCare maternal healthcare system. It is built using FastAPI and PostgreSQL, and includes built-in ML inference for maternal risk screening.

## 🚀 Running Locally (Without Docker)

If you prefer to run the backend natively, ensure you have Python 3.9+ installed.

### Quick Start (SQLite - No Setup Required)

SQLite is configured by default for quick local development:

```bash
python -m venv .venv
cd backend
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt

# Make sure you're in the backend directory

uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Instant database** ✓ — `bloomcare.db` is auto-created on first run.

### Using PostgreSQL (More Realistic Testing)

For a production-like setup with sample data, see [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md):

```bash
# 1. Install PostgreSQL locally or via Docker
# 2. Load schema & sample data:
psql -U postgres -h 127.0.0.1 -f schema_with_sample_data.sql

# 3. Set environment variable or .env file:
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/bloomcare

# 4. Start the API:
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Sample users available** – See `POSTGRESQL_SETUP.md` for credentials.

## 🐳 Running with Docker (Recommended)

To run the entire backend system (FastAPI API and PostgreSQL Database) inside Docker, you need Docker Desktop or Docker Engine installed.

### 1. Start the Containers

Run the following command in the `backend` directory where the `docker-compose.yml` is located:

```bash
docker-compose up --build
```
*(Use `-d` flag to run in detached mode in the background: `docker-compose up -d --build`)*

### 2. Database Migrations (Optional)
The FastAPI app is currently configured to automatically create tables on startup (`Base.metadata.create_all`). If you need to run Alembic migrations manually inside the container:

```bash
docker-compose exec api alembic upgrade head
```

### 3. Accessing the Application
Once the containers are running:
- **API Endpoints:** `http://localhost:8000`
- **Swagger Documentation:** `http://localhost:8000/docs`

### Additional Docker Commands
To stop the application:
```bash
docker-compose down
```

To view logs if running in detached mode:
```bash
docker-compose logs -f api
```

## 🧠 ML Inference Configuration
The system can either run real `.pkl` models from the `models/` directory or return deterministically generated mock data. This is controlled by the `.env` flag:

`BLOOMCARE_MOCK_LLM=true`

Set this to `false` to attempt to load the actual ML models.
