# PostgreSQL Setup Guide for BloomCare

This guide helps you set up PostgreSQL locally and load the sample database schema.

## Prerequisites

- **PostgreSQL 12+** installed locally or via Docker
- **psql** command-line tool  

## Option 1: Install PostgreSQL Locally (Windows)

### 1a. Download & Install
1. Download PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run the installer
3. **Remember the password** you set for the `postgres` user (default port: 5432)
4. Ensure `psql` is added to PATH during installation

### 1b. Verify Installation
```powershell
psql --version
psql -U postgres -h localhost -c "SELECT version();"
```

## Option 2: Use PostgreSQL via Docker

```powershell
# Pull PostgreSQL image
docker pull postgres:15

# Run PostgreSQL container
docker run --name bloomcare-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:15

# Verify it's running
docker ps
```

---

## Create Database & Load Schema

### Step 1: Load the Schema with Sample Data

From the `backend/` directory:

```powershell
# Connect to PostgreSQL and run the schema file
psql -U postgres -h 127.0.0.1 -f schema_with_sample_data.sql

# You may be prompted for the password (default: postgres)
```

**Expected output:**
```
CREATE TYPE
CREATE TYPE
CREATE TYPE
CREATE TABLE
...
 total_users  
──────────────
            5
(1 row)
```

### Step 2: Verify the Database

```powershell
# Connect to the bloomcare database
psql -U postgres -h 127.0.0.1 -d bloomcare

# Run these commands to verify:
SELECT * FROM users;
SELECT * FROM patients;
SELECT COUNT(*) FROM vitals;
```

---

## Configure Backend to Use PostgreSQL

### Option A: Using Environment Variables

Create a `.env` file in `backend/` directory:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/bloomcare
POSTGRES_SERVER=127.0.0.1
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=bloomcare
POSTGRES_PORT=5432
```

Then start the backend:

```powershell
cd backend
.\.venv\Scripts\activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Option B: Modify config.py Directly

Edit `backend/app/core/config.py`:

```python
DATABASE_URL: str = "postgresql://postgres:postgres@127.0.0.1:5432/bloomcare"
```

---

## Test Database Connection

```powershell
cd backend

# Test with Python
.\.venv\Scripts\python -c "
from app.core.config import settings
from app.core.database import engine
try:
    with engine.connect() as conn:
        print('✓ Database connection successful!')
        result = conn.execute('SELECT COUNT(*) FROM users')
        print(f'✓ Users in database: {result.scalar()}')
except Exception as e:
    print(f'✗ Connection failed: {e}')
"
```

---

## Sample Data Credentials

### Users in the Database

| Role | Username | Password | Full Name |
|------|----------|----------|-----------|
| Admin | admin | admin123 | Dr. Admin User |
| Doctor | dr_silva | admin123 | Dr. Chaminda Silva |
| Doctor | dr_peiris | admin123 | Dr. Amara Peiris |
| Frontline | nurse_kamal | admin123 | Nurse Kamal Ratnayake |
| Patient | patient_nuwanthika | admin123 | Nuwanthika Prasad |
| Patient | patient_malini | admin123 | Malini Jayasena |
| Patient | patient_sunethra | admin123 | Sunethra Wickramasinghe |

⚠️ **For development only!** Change passwords in production.

---

## Troubleshooting

### "psql: FATAL: database does not exist"
→ Run `schema_with_sample_data.sql` first

### "connection refused"
→ Verify PostgreSQL is running: `pg_isready -h 127.0.0.1 -p 5432`

### "password authentication failed"
→ Check your `.env` file or `config.py` credentials match PostgreSQL setup

### "psql: command not found"
→ Add PostgreSQL `bin/` directory to PATH, or run from `C:\Program Files\PostgreSQL\15\bin\psql.exe`

---

## Switching Between SQLite and PostgreSQL

**To use SQLite (default, no setup needed):**
```env
DATABASE_URL=sqlite:///./bloomcare.db
```

**To use PostgreSQL:**
```env
DATABASE_URL=postgresql://username:password@localhost:5432/bloomcare
```

The backend automatically detects the database type and configures connection settings appropriately.

---

## Next Steps

1. Start the backend: `uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`
2. Visit http://127.0.0.1:8000/docs for API documentation
3. Log in with any of the sample user credentials above
