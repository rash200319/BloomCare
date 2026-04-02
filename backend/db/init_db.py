import sys
from pathlib import Path

# Allow direct script execution: python backend/db/init_db.py
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.core.config import settings
import os
import psycopg2
from urllib.parse import urlparse
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_db():
    logger.info("Initializing database from schema.sql...")

    # Parse SQLAlchemy URI to get psycopg2 parameters
    result = urlparse(settings.SQLALCHEMY_DATABASE_URI)
    username = result.username
    password = result.password
    database = result.path[1:]
    hostname = result.hostname
    port = result.port

    try:
        # Connect to DB directly
        conn = psycopg2.connect(
            database=database,
            user=username,
            password=password,
            host=hostname,
            port=port
        )
        conn.autocommit = True
        cursor = conn.cursor()

        schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
        with open(schema_path, "r") as f:
            sql = f.read()

        try:
            cursor.execute(sql)
            logger.info("Schema execution completed successfully!")
        except Exception as schema_error:
            # Schema may be partially present in development; continue with seeding.
            logger.warning("Schema execution reported: %s", schema_error)
            conn.rollback()

        cursor.execute('SET search_path TO "BloomCare"')

        # Insert default users for demo/testing
        from backend.core.security import get_password_hash

        seed_users = [
            {
                "email": "frontline.staff@bloomcare.health",
                "full_name": "Frontline Staff Demo",
                "role": "FRONTLINE_STAFF",
                "password": "rash2003",
            },
            {
                "email": "hospitaladmin@bloomcare.health",
                "full_name": "Hospital Admin Demo",
                "role": "ADMIN",
                "password": "rash2003",
            },
            {
                "email": "obsertitian@bloomcare.health",
                "full_name": "Obsertitian Demo",
                "role": "CLINICAL_SPECIALIST",
                "password": "rash2003",
            },
        ]

        for item in seed_users:
            pwd_hash = get_password_hash(item["password"])
            cursor.execute(
                """
                INSERT INTO users (email, hashed_password, full_name, role, first_time_login)
                VALUES (%s, %s, %s, %s, FALSE)
                ON CONFLICT (email)
                DO UPDATE SET
                    hashed_password = EXCLUDED.hashed_password,
                    full_name = EXCLUDED.full_name,
                    role = EXCLUDED.role,
                    first_time_login = EXCLUDED.first_time_login
                """,
                (item["email"], pwd_hash, item["full_name"], item["role"])
            )
            logger.info("Upserted seed user %s (%s)",
                        item["email"], item["role"])

        patient_pwd_hash = get_password_hash("rash2003")
        cursor.execute(
            """
            INSERT INTO patients (national_id, full_name, age, hashed_password, first_time_login)
            VALUES (%s, %s, %s, %s, FALSE)
            ON CONFLICT (national_id)
            DO UPDATE SET
                full_name = EXCLUDED.full_name,
                age = EXCLUDED.age,
                hashed_password = EXCLUDED.hashed_password,
                first_time_login = EXCLUDED.first_time_login
            """,
            ("199912345678", "Patient Demo", 27, patient_pwd_hash)
        )
        logger.info("Upserted seed patient %s", "199912345678")

    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()


if __name__ == "__main__":
    init_db()
