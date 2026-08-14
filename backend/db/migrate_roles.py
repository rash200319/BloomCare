"""Upgrade legacy OBSERTITIAN roles to CLINICAL_SPECIALIST on Postgres."""
from __future__ import annotations

import logging
import sys
from pathlib import Path
from urllib.parse import urlparse

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate_roles() -> None:
    import psycopg2
    from backend.core.config import settings

    result = urlparse(settings.SQLALCHEMY_DATABASE_URI)
    conn = psycopg2.connect(
        database=result.path[1:],
        user=result.username,
        password=result.password,
        host=result.hostname,
        port=result.port,
    )
    conn.autocommit = True
    try:
        cur = conn.cursor()
        cur.execute('SET search_path TO "BloomCare", public')
        try:
            cur.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'CLINICAL_SPECIALIST'")
            logger.info("Ensured CLINICAL_SPECIALIST exists on user_role enum")
        except Exception as exc:
            logger.warning("ADD VALUE skipped/failed (may already exist): %s", exc)

        cur.execute(
            """
            UPDATE users
            SET role = 'CLINICAL_SPECIALIST'
            WHERE role::text = 'OBSERTITIAN'
            """
        )
        logger.info("Updated users rows: %s", cur.rowcount)
        cur.execute(
            """
            UPDATE appointments
            SET created_by_role = 'CLINICAL_SPECIALIST'
            WHERE created_by_role = 'OBSERTITIAN'
            """
        )
        logger.info("Updated appointments rows: %s", cur.rowcount)
    finally:
        conn.close()


if __name__ == "__main__":
    migrate_roles()
