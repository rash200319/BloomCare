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
COPY start.sh Procfile railpack.json .python-version ./
RUN chmod +x start.sh

EXPOSE 8000

# Expands Railway's PORT inside the shell (literal $PORT breaks uvicorn).
CMD ["./start.sh"]
