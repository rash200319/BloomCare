"""
BloomCare FastAPI Application Entry Point
"""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import Base, engine

# Import all models so Alembic/SQLAlchemy can detect them
from app.models import models  # noqa: F401

# Routers
from app.api.routes.auth         import router as auth_router
from app.api.routes.patients     import router as patients_router
from app.api.routes.predictions  import router as predictions_router
from app.api.routes.appointments import router as appointments_router
from app.api.routes.sync         import router as sync_router
from app.api.routes.admin        import router as admin_router
from app.api.routes.legacy       import router as legacy_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("bloomcare")


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("──────────────────────────────────────────────")
    logger.info("  BloomCare API starting up…")
    logger.info(f"  Mock LLM mode : {settings.BLOOMCARE_MOCK_LLM}")
    logger.info(f"  Database      : {settings.DATABASE_URL}")
    logger.info("──────────────────────────────────────────────")

    # Create tables (development convenience — use Alembic in production)
    Base.metadata.create_all(bind=engine)
    logger.info("  Database tables verified / created.")

    yield

    logger.info("  BloomCare API shutting down. Goodbye.")


# ── Application ───────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Production-ready backend for BloomCare — a maternal healthcare "
        "AI platform built for Hemas Hospitals. Supports offline-first "
        "workflows, ML-based risk prediction, and role-based access control."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)


# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request Logging Middleware ─────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        f"{request.method} {request.url.path} → {response.status_code} "
        f"({duration_ms:.1f} ms)"
    )
    return response


# ── Global Exception Handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again later."},
    )


# ── Routers ───────────────────────────────────────────────────────────────────
API_PREFIX = "/api/v1"

app.include_router(auth_router,         prefix=API_PREFIX)
app.include_router(patients_router,     prefix=API_PREFIX)
app.include_router(predictions_router,  prefix=API_PREFIX)
app.include_router(appointments_router, prefix=API_PREFIX)
app.include_router(sync_router,         prefix=API_PREFIX)
app.include_router(admin_router,        prefix=API_PREFIX)
app.include_router(legacy_router)       # No prefix, handles root level /predict-risk


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"], summary="Health check")
async def health():
    return {
        "status":   "healthy",
        "app":      settings.APP_NAME,
        "version":  settings.APP_VERSION,
        "mock_llm": settings.BLOOMCARE_MOCK_LLM,
    }


@app.get("/", tags=["Health"], include_in_schema=False)
async def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} v{settings.APP_VERSION}",
        "docs":    "/docs",
    }
