import psycopg2
from backend.core.config import settings

conn = psycopg2.connect(
    database=settings.POSTGRES_DB,
    user=settings.POSTGRES_USER,
    password=settings.POSTGRES_PASSWORD,
    host=settings.POSTGRES_SERVER,
    port=settings.POSTGRES_PORT
)
conn.autocommit = True
cursor = conn.cursor()

cursor.execute('SET search_path TO "BloomCare"')

try:
    cursor.execute('ALTER TABLE patients ADD COLUMN due_date DATE;')
    print("✓ Column due_date added successfully")
except psycopg2.errors.DuplicateColumn:
    print("✓ Column due_date already exists")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

cursor.close()
conn.close()
