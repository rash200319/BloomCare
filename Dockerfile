# BloomCare API — single image for Railway / local Docker.
# Postgres primary via DATABASE_URL or POSTGRES_*; SQLite fallback at runtime.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# psycopg2-binary ships wheels; keep image lean (no gcc/libpq-dev needed).
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY backend ./backend
COPY models ./models
COPY Procfile railpack.json .python-version ./

EXPOSE 8000

# Railway injects PORT; default 8000 for local `docker run`.
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
