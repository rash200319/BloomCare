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
    is_postgres = primary_uri.startswith("postgresql:") or primary_uri.startswith("postgres:")

    try:
        connect_args = {}
        if is_postgres:
            connect_args = {
                "connect_timeout": 2,
                "options": '-csearch_path="BloomCare",public',
            }
        elif primary_uri.startswith("sqlite:"):
            connect_args = {"check_same_thread": False}

        engine = create_engine(
            primary_uri,
            pool_pre_ping=True,
            connect_args=connect_args,
        )
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Connected to database: %s", primary_uri.split("@")[-1] if "@" in primary_uri else primary_uri)
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


def _ensure_runtime_compat_columns(engine) -> None:
    """Add columns used by status/review persistence on older local SQLite DBs."""
    dialect = engine.dialect.name
    try:
        with engine.begin() as conn:
            if dialect == "postgresql":
                conn.execute(text(
                    'ALTER TABLE IF EXISTS "BloomCare".appointments ADD COLUMN IF NOT EXISTS completed_by_id UUID'
                ))
                conn.execute(text(
                    'ALTER TABLE IF EXISTS "BloomCare".appointments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ'
                ))
                conn.execute(text(
                    'ALTER TABLE IF EXISTS "BloomCare".appointments ADD COLUMN IF NOT EXISTS cancelled_by_id UUID'
                ))
                conn.execute(text(
                    'ALTER TABLE IF EXISTS "BloomCare".appointments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ'
                ))
                conn.execute(text(
                    'ALTER TABLE IF EXISTS "BloomCare".appointments ADD COLUMN IF NOT EXISTS reason_for_cancellation VARCHAR(255)'
                ))
                conn.execute(text(
                    'ALTER TABLE IF EXISTS "BloomCare".stage1_screenings ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ'
                ))
                conn.execute(text(
                    "ALTER TABLE IF EXISTS stage1_screenings ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ"
                ))
            elif dialect == "sqlite":
                appointment_cols = {
                    row[1] for row in conn.exec_driver_sql("PRAGMA table_info(appointments)").fetchall()
                }
                sqlite_appointment_additions = {
                    "completed_by_id": "ALTER TABLE appointments ADD COLUMN completed_by_id VARCHAR(36)",
                    "completed_at": "ALTER TABLE appointments ADD COLUMN completed_at DATETIME",
                    "cancelled_by_id": "ALTER TABLE appointments ADD COLUMN cancelled_by_id VARCHAR(36)",
                    "cancelled_at": "ALTER TABLE appointments ADD COLUMN cancelled_at DATETIME",
                    "reason_for_cancellation": "ALTER TABLE appointments ADD COLUMN reason_for_cancellation VARCHAR(255)",
                }
                for column_name, ddl in sqlite_appointment_additions.items():
                    if column_name not in appointment_cols:
                        conn.exec_driver_sql(ddl)

                screening_cols = {
                    row[1] for row in conn.exec_driver_sql("PRAGMA table_info(stage1_screenings)").fetchall()
                }
                if "reviewed_at" not in screening_cols:
                    conn.exec_driver_sql(
                        "ALTER TABLE stage1_screenings ADD COLUMN reviewed_at DATETIME"
                    )
    except SQLAlchemyError as exc:
        logger.warning("Unable to ensure runtime compatibility columns: %s", exc)


engine = _create_engine_with_fallback()
_ensure_runtime_compat_columns(engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

try:
    from backend.db.seed_demo import seed_sqlite_if_needed

    seed_sqlite_if_needed(engine, SessionLocal)
except Exception as seed_exc:
    logger.warning("Demo seed bootstrap skipped: %s", seed_exc)
