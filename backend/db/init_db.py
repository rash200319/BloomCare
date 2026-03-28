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
            
        cursor.execute(sql)
        logger.info("Schema execution completed successfully!")
        
        # Optionally insert initial admin user here if needed
        from ..core.security import get_password_hash
        
        admin_email = "admin@bloomcare.health"
        cursor.execute("SELECT id FROM users WHERE email = %s", (admin_email,))
        if not cursor.fetchone():
            pwd_hash = get_password_hash("admin123")
            cursor.execute(
                """
                INSERT INTO users (email, hashed_password, full_name, role)
                VALUES (%s, %s, %s, 'ADMIN')
                """,
                (admin_email, pwd_hash, "System Administrator")
            )
            logger.info("Created default admin user (admin@bloomcare.health / admin123)")
            
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    init_db()
