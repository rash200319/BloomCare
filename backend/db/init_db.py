import os
import psycopg2
from urllib.parse import urlparse
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from ..core.config import settings

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
        
        # Optionally insert initial admin user here if needed
        from ..core.security import get_password_hash
        
        admin_email = "admin@bloomcare.health"
        cursor.execute("SELECT id FROM users WHERE email = %s", (admin_email,))
        if not cursor.fetchone():
            pwd_hash = get_password_hash("admin123")
            cursor.execute(
                """
                INSERT INTO users (email, hashed_password, full_name, role)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (email)
                DO UPDATE SET
                    hashed_password = EXCLUDED.hashed_password,
                    full_name = EXCLUDED.full_name,
                    role = EXCLUDED.role
                """,
                (item["email"], pwd_hash, item["full_name"], item["role"])
            )
            logger.info("Upserted seed user %s (%s)", item["email"], item["role"])
            
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    init_db()
