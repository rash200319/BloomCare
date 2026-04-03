import logging
from sqlalchemy import create_engine, text, MetaData, Text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker
from backend.core.config import settings
from backend.db.base import Base

# Import all models to register them with Base.metadata
from backend.models import (
    User, Patient, Stage1Screening, Stage2Diagnostic,
    ScreeningReport, Appointment, Prescription, SyncQueueLog, OTPRecord
)

logger = logging.getLogger(__name__)


def _ensure_stage2_audit_columns(engine) -> None:
    dialect = engine.dialect.name
    try:
        with engine.begin() as conn:
            if dialect == "postgresql":
                conn.execute(text(
                    "ALTER TABLE IF EXISTS stage2_diagnostics ADD COLUMN IF NOT EXISTS explainability_data JSONB"))
                conn.execute(text(
                    "ALTER TABLE IF EXISTS stage2_diagnostics ADD COLUMN IF NOT EXISTS input_snapshot JSONB"))
            elif dialect == "sqlite":
                columns = conn.exec_driver_sql(
                    "PRAGMA table_info(stage2_diagnostics)").fetchall()
                existing = {row[1] for row in columns}
                if "explainability_data" not in existing:
                    conn.exec_driver_sql(
                        "ALTER TABLE stage2_diagnostics ADD COLUMN explainability_data TEXT")
                if "input_snapshot" not in existing:
                    conn.exec_driver_sql(
                        "ALTER TABLE stage2_diagnostics ADD COLUMN input_snapshot TEXT")
    except SQLAlchemyError as exc:
        logger.warning(
            "Unable to ensure stage2_diagnostics audit columns: %s", exc)


def _create_engine_with_fallback():
    primary_uri = settings.SQLALCHEMY_DATABASE_URI

    try:
        engine = create_engine(
            primary_uri,
            pool_pre_ping=True,
            # Ensure ORM queries resolve tables in the BloomCare schema first.
            # BloomCare is a quoted mixed-case schema, so search_path must quote it.
            connect_args={"connect_timeout": 2,
                          "options": "-csearch_path=\"BloomCare\",public"},
        )
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Connected to PostgreSQL: %s", primary_uri)
        return engine
    except SQLAlchemyError as exc:
        fallback_uri = "sqlite:///./bloomcare_local.db"
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
        # Create all tables from SQLAlchemy models for SQLite
        logger.info("Creating tables for SQLite fallback...")
        # SQLite doesn't support schemas or JSONB, so we need to adapt tables
        # Create a modified metadata without the schema
        sqlite_metadata = MetaData(schema=None)
        for table in Base.metadata.sorted_tables:
            # Recreate table without schema and with TEXT instead of JSONB
            columns = []
            for col in table.columns:
                # Replace JSONB with TEXT for SQLite
                col_type = Text() if col.type.__class__.__name__ == 'JSONB' else col.type
                # Create new column with modified type
                new_col = col.copy()
                new_col.type = col_type
                columns.append(new_col)

            # Create new table in sqlite_metadata without schema
            from sqlalchemy import Table as SATable
            SATable(table.name, sqlite_metadata, *columns)

        sqlite_metadata.create_all(engine)

        # CRITICAL: Remove schema from Base.metadata so ORM queries don't use "BloomCare" prefix
        # This ensures all tables are queried as 'users', 'patients', etc. without schema
        Base.metadata.schema = None
        for table in Base.metadata.sorted_tables:
            table.schema = None

        logger.info("SQLite tables created successfully")
        return engine


engine = _create_engine_with_fallback()
_ensure_stage2_audit_columns(engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
