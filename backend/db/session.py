import logging
from pathlib import Path

from sqlalchemy import MetaData, Text, create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker

from backend.core.config import settings
from backend.db.base import Base

# Register all models on Base.metadata before create_all / ORM use.
from backend.models import (  # noqa: F401
    Appointment,
    AuditEvent,
    Notification,
    OTPRecord,
    Patient,
    Prescription,
    ScreeningReport,
    Stage1Screening,
    Stage2Diagnostic,
    SyncQueueLog,
    User,
)

logger = logging.getLogger(__name__)


def _create_engine_with_fallback():
    primary_uri = settings.SQLALCHEMY_DATABASE_URI

    try:
        engine = create_engine(
            primary_uri,
            pool_pre_ping=True,
            connect_args={
                "connect_timeout": 2,
                "options": '-csearch_path="BloomCare",public',
            },
        )
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Connected to PostgreSQL: %s", primary_uri)
        return engine
    except SQLAlchemyError as exc:
        project_root = Path(__file__).resolve().parents[2]
        sqlite_path = project_root / "bloomcare_local.db"
        fallback_uri = f"sqlite:///{sqlite_path.as_posix()}"
        logger.warning(
            "PostgreSQL unavailable (%s). Falling back to local SQLite at %s",
            exc,
            fallback_uri,
        )
        engine = create_engine(
            fallback_uri,
            connect_args={"check_same_thread": False},
            pool_pre_ping=True,
        )

        # SQLite: no schemas / JSONB — rebuild metadata then create tables.
        logger.info("Creating tables for SQLite fallback...")
        sqlite_metadata = MetaData(schema=None)
        for table in Base.metadata.sorted_tables:
            columns = []
            for col in table.columns:
                col_type = Text() if col.type.__class__.__name__ == "JSONB" else col.type
                new_col = col.copy()
                new_col.type = col_type
                columns.append(new_col)
            from sqlalchemy import Table as SATable

            SATable(table.name, sqlite_metadata, *columns)

        sqlite_metadata.create_all(engine)

        Base.metadata.schema = None
        for table in Base.metadata.sorted_tables:
            table.schema = None

        logger.info("SQLite tables created successfully")
        return engine


engine = _create_engine_with_fallback()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

try:
    from backend.db.seed_demo import seed_sqlite_if_needed

    seed_sqlite_if_needed(engine, SessionLocal)
except Exception as seed_exc:
    logger.warning("Demo seed bootstrap skipped: %s", seed_exc)
