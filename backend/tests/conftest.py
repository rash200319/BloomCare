"""Shared fixtures for BloomCare backend tests.

Run from repo root:
  pip install -r backend/requirements-dev.txt
  python -m pytest backend/tests -v
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def app():
    """Import the FastAPI app once per test session (avoids reloading ML models)."""
    from backend.main import app as fastapi_app

    return fastapi_app


@pytest.fixture(scope="session")
def client(app):
    with TestClient(app) as test_client:
        # Ensure interview demo accounts exist (SQLite fallback or Postgres).
        from backend.db.seed_demo import ensure_demo_seeds
        from backend.db.session import SessionLocal

        db = SessionLocal()
        try:
            ensure_demo_seeds(db)
        finally:
            db.close()
        yield test_client


@pytest.fixture
def demo_password() -> str:
    return "rash2003"
