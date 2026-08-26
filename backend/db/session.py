import logging
from sqlalchemy import create_engine, text, MetaData, Text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker
from backend.core.config import settings
from backend.db.base import Base

# Import all models to register them with Base.metadata
from backend.models import (
    User, Patient, Stage1Screening, Stage2Diagnostic,
    ScreeningReport, Appointment, Prescription, SyncQueueLog, OTPRecord, Notification,
    AuditEvent, AppointmentBookingOperation, AppointmentSlotReservation,
    WorkflowOutbox, NotificationDelivery,
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


def _ensure_patient_compat_columns(engine) -> None:
    """Backfill patient columns for older databases without running full migrations."""
    dialect = engine.dialect.name
    try:
        with engine.begin() as conn:
            if dialect == "postgresql":
                conn.execute(text(
                    "ALTER TABLE IF EXISTS patients ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE"
                ))
                conn.execute(text(
                    "ALTER TABLE IF EXISTS patients ADD COLUMN IF NOT EXISTS first_time_login BOOLEAN DEFAULT TRUE"
                ))
                conn.execute(text(
                    "ALTER TABLE IF EXISTS patients ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0"
                ))
                conn.execute(text(
                    "ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0"
                ))
            elif dialect == "sqlite":
                columns = conn.exec_driver_sql("PRAGMA table_info(patients)").fetchall()
                existing = {row[1] for row in columns}
                if "is_active" not in existing:
                    conn.exec_driver_sql(
                        "ALTER TABLE patients ADD COLUMN is_active BOOLEAN DEFAULT 1"
                    )
                if "first_time_login" not in existing:
                    conn.exec_driver_sql(
                        "ALTER TABLE patients ADD COLUMN first_time_login BOOLEAN DEFAULT 1"
                    )
                if "token_version" not in existing:
                    conn.exec_driver_sql(
                        "ALTER TABLE patients ADD COLUMN token_version INTEGER DEFAULT 0"
                    )
                user_cols = conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()
                user_existing = {row[1] for row in user_cols}
                if "token_version" not in user_existing:
                    conn.exec_driver_sql(
                        "ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0"
                    )
    except SQLAlchemyError as exc:
        logger.warning("Unable to ensure patients compatibility columns: %s", exc)


def _ensure_audit_events_table(engine) -> None:
    """Create audit_events when audit logging may be enabled."""
    try:
        with engine.begin() as conn:
            dialect = engine.dialect.name
            if dialect == "postgresql":
                AuditEvent.__table__.create(bind=conn, checkfirst=True)
            elif dialect == "sqlite":
                conn.exec_driver_sql(
                    """
                    CREATE TABLE IF NOT EXISTS audit_events (
                        id VARCHAR(36) PRIMARY KEY,
                        actor_id VARCHAR(36),
                        actor_role VARCHAR(50),
                        action VARCHAR(100) NOT NULL,
                        resource_type VARCHAR(50) NOT NULL DEFAULT 'patient',
                        resource_id VARCHAR(36),
                        detail TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
    except SQLAlchemyError as exc:
        logger.warning("Unable to ensure audit_events table: %s", exc)


def _ensure_appointments_table(engine) -> None:
    """Create the appointments table if it is missing in the active runtime database."""
    try:
        with engine.begin() as conn:
            dialect = engine.dialect.name
            if dialect == "postgresql":
                from backend.models.appointment import Appointment

                Appointment.__table__.create(bind=conn, checkfirst=True)
                conn.execute(text(
                    "ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS created_by_id UUID"
                ))
                conn.execute(text(
                    "ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS created_by_role VARCHAR(50) DEFAULT 'FRONTLINE_STAFF'"
                ))
                conn.execute(text(
                    "ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(100) DEFAULT 'PRENATAL_CHECKUP'"
                ))
                conn.execute(text(
                    "ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30"
                ))
                conn.execute(text(
                    "ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS queue_number INTEGER DEFAULT 0"
                ))
                conn.execute(text(
                    "ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDING'"
                ))
                conn.execute(text(
                    "ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS notes TEXT"
                ))
                conn.execute(text(
                    "ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS completed_by_id UUID"
                ))
                conn.execute(text(
                    "ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ"
                ))
                conn.execute(text(
                    "ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS cancelled_by_id UUID"
                ))
                conn.execute(text(
                    "ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ"
                ))
                conn.execute(text(
                    "ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS reason_for_cancellation VARCHAR(255)"
                ))
                conn.execute(text(
                    "ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP"
                ))
                conn.execute(text(
                    "ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP"
                ))
                conn.execute(text(
                    "ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS booking_operation_id VARCHAR(36)"
                ))
                conn.execute(text(
                    "ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS schedule_version INTEGER DEFAULT 1"
                ))
            elif dialect == "sqlite":
                conn.exec_driver_sql(
                    """
                    CREATE TABLE IF NOT EXISTS appointments (
                        id VARCHAR(36) PRIMARY KEY,
                        patient_id VARCHAR(36),
                        specialist_id VARCHAR(36),
                        created_by_id VARCHAR(36),
                        created_by_role VARCHAR(50) NOT NULL DEFAULT 'FRONTLINE_STAFF',
                        appointment_type VARCHAR(100) NOT NULL DEFAULT 'PRENATAL_CHECKUP',
                        appointment_date DATETIME NOT NULL,
                        duration_minutes INTEGER DEFAULT 30,
                        queue_number INTEGER,
                        status VARCHAR(50) DEFAULT 'PENDING',
                        notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
                columns = conn.exec_driver_sql("PRAGMA table_info(appointments)").fetchall()
                existing = {row[1] for row in columns}
                missing_additions = {
                    "created_by_id": "ALTER TABLE appointments ADD COLUMN created_by_id VARCHAR(36)",
                    "created_by_role": "ALTER TABLE appointments ADD COLUMN created_by_role VARCHAR(50) DEFAULT 'FRONTLINE_STAFF'",
                    "appointment_type": "ALTER TABLE appointments ADD COLUMN appointment_type VARCHAR(100) DEFAULT 'PRENATAL_CHECKUP'",
                    "duration_minutes": "ALTER TABLE appointments ADD COLUMN duration_minutes INTEGER DEFAULT 30",
                    "queue_number": "ALTER TABLE appointments ADD COLUMN queue_number INTEGER DEFAULT 0",
                    "status": "ALTER TABLE appointments ADD COLUMN status VARCHAR(50) DEFAULT 'PENDING'",
                    "notes": "ALTER TABLE appointments ADD COLUMN notes TEXT",
                    "completed_by_id": "ALTER TABLE appointments ADD COLUMN completed_by_id VARCHAR(36)",
                    "completed_at": "ALTER TABLE appointments ADD COLUMN completed_at DATETIME",
                    "cancelled_by_id": "ALTER TABLE appointments ADD COLUMN cancelled_by_id VARCHAR(36)",
                    "cancelled_at": "ALTER TABLE appointments ADD COLUMN cancelled_at DATETIME",
                    "reason_for_cancellation": "ALTER TABLE appointments ADD COLUMN reason_for_cancellation VARCHAR(255)",
                    "created_at": "ALTER TABLE appointments ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
                    "updated_at": "ALTER TABLE appointments ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP",
                    "booking_operation_id": "ALTER TABLE appointments ADD COLUMN booking_operation_id VARCHAR(36)",
                    "schedule_version": "ALTER TABLE appointments ADD COLUMN schedule_version INTEGER DEFAULT 1",
                }
                for column_name, ddl in missing_additions.items():
                    if column_name not in existing:
                        conn.exec_driver_sql(ddl)
    except SQLAlchemyError as exc:
        logger.warning("Unable to ensure appointments table: %s", exc)


def _ensure_notifications_table(engine) -> None:
    """Create the notifications table if it is missing in the active runtime database."""
    try:
        with engine.begin() as conn:
            dialect = engine.dialect.name
            if dialect == "postgresql":
                Notification.__table__.create(bind=conn, checkfirst=True)
                conn.execute(text(
                    "ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(30) DEFAULT 'STAFF'"
                ))
                conn.execute(text(
                    "ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS deduplication_key VARCHAR(255)"
                ))
            elif dialect == "sqlite":
                conn.exec_driver_sql(
                    """
                    CREATE TABLE IF NOT EXISTS notifications (
                        id VARCHAR(36) PRIMARY KEY,
                        recipient_id VARCHAR(36) NOT NULL,
                        recipient_type VARCHAR(30) NOT NULL DEFAULT 'STAFF',
                        appointment_id VARCHAR(36),
                        notification_type VARCHAR(50) NOT NULL,
                        title VARCHAR(255) NOT NULL,
                        message TEXT NOT NULL,
                        is_read BOOLEAN DEFAULT 0,
                        read_at DATETIME,
                        related_data TEXT,
                        deduplication_key VARCHAR(255),
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
                columns = conn.exec_driver_sql("PRAGMA table_info(notifications)").fetchall()
                existing = {row[1] for row in columns}
                if "recipient_type" not in existing:
                    conn.exec_driver_sql(
                        "ALTER TABLE notifications ADD COLUMN recipient_type VARCHAR(30) DEFAULT 'STAFF'"
                    )
                if "deduplication_key" not in existing:
                    conn.exec_driver_sql(
                        "ALTER TABLE notifications ADD COLUMN deduplication_key VARCHAR(255)"
                    )
    except SQLAlchemyError as exc:
        logger.warning("Unable to ensure notifications table: %s", exc)


def _ensure_orchestration_tables(engine) -> None:
    """Create orchestration tables for local/demo installs.

    Production PostgreSQL deployments should apply the checked-in SQL migration
    so the overlap exclusion constraint is installed as well.
    """
    try:
        Base.metadata.create_all(
            bind=engine,
            tables=[
                AppointmentBookingOperation.__table__,
                AppointmentSlotReservation.__table__,
                WorkflowOutbox.__table__,
                NotificationDelivery.__table__,
            ],
            checkfirst=True,
        )
    except SQLAlchemyError as exc:
        logger.warning("Unable to ensure appointment orchestration tables: %s", exc)


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
        from pathlib import Path

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
_ensure_patient_compat_columns(engine)
_ensure_appointments_table(engine)
_ensure_notifications_table(engine)
_ensure_orchestration_tables(engine)
_ensure_audit_events_table(engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Interview demos: ensure login accounts exist when running on SQLite fallback.
try:
    from backend.db.seed_demo import seed_sqlite_if_needed

    seed_sqlite_if_needed(engine, SessionLocal)
except Exception as seed_exc:
    logger.warning("Demo seed bootstrap skipped: %s", seed_exc)
