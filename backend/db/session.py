import logging
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker
from ..core.config import settings

logger = logging.getLogger(__name__)


def _create_engine_with_fallback():
	primary_uri = settings.SQLALCHEMY_DATABASE_URI

	try:
		engine = create_engine(primary_uri, pool_pre_ping=True)
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
		with engine.begin() as conn:
			conn.exec_driver_sql(
				"""
				CREATE TABLE IF NOT EXISTS users (
					id TEXT PRIMARY KEY,
					email TEXT NOT NULL UNIQUE,
					hashed_password TEXT NOT NULL,
					full_name TEXT,
					role TEXT NOT NULL DEFAULT 'FRONTLINE_STAFF',
					is_active BOOLEAN NOT NULL DEFAULT 1
				);
				"""
			)
		return engine

engine = _create_engine_with_fallback()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
