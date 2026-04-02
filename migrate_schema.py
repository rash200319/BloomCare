#!/usr/bin/env python3
"""
Database Migration Script
Aligns legacy schemas with id-based auth (no user_id columns).
"""
import sys
import os
from pathlib import Path

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT


def run_migration() -> bool:
    """Run database migration."""
    try:
        env_path = Path(__file__).resolve().parent / "backend" / ".env"
        if env_path.exists():
            for line in env_path.read_text(encoding="utf-8").splitlines():
                raw = line.strip()
                if not raw or raw.startswith("#") or "=" not in raw:
                    continue
                key, value = raw.split("=", 1)
                key = key.strip()
                value = value.strip()
                if key and key not in os.environ:
                    os.environ[key] = value

        host = os.getenv("POSTGRES_SERVER", os.getenv("PGHOST", "localhost"))
        user = os.getenv("POSTGRES_USER", os.getenv("PGUSER", "postgres"))
        password = os.getenv("POSTGRES_PASSWORD", os.getenv("PGPASSWORD", "rash2003"))
        database = os.getenv("POSTGRES_DB", os.getenv("PGDATABASE", "postgres"))
        port = int(os.getenv("POSTGRES_PORT", os.getenv("PGPORT", "5432")))

        conn = psycopg2.connect(
            host=host,
            user=user,
            password=password,
            database=database,
            port=port,
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()

        print("Starting database migration...")

        print("  Ensuring required users columns...")
        cursor.execute('ALTER TABLE "BloomCare".users ADD COLUMN IF NOT EXISTS specialization VARCHAR(100);')
        cursor.execute('ALTER TABLE "BloomCare".users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);')
        cursor.execute('ALTER TABLE "BloomCare".users ADD COLUMN IF NOT EXISTS first_time_login BOOLEAN DEFAULT TRUE;')

        print("  Ensuring required patients columns...")
        cursor.execute('ALTER TABLE "BloomCare".patients ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255);')
        cursor.execute('ALTER TABLE "BloomCare".patients ADD COLUMN IF NOT EXISTS first_time_login BOOLEAN DEFAULT TRUE;')

        print("  Removing legacy user_id artifacts...")
        cursor.execute('DROP TRIGGER IF EXISTS trg_generate_user_id ON "BloomCare".users;')
        cursor.execute('DROP FUNCTION IF EXISTS "BloomCare".trigger_generate_user_id();')
        cursor.execute('DROP FUNCTION IF EXISTS "BloomCare".generate_user_id("BloomCare".user_role);')

        cursor.execute('ALTER TABLE "BloomCare".patients DROP CONSTRAINT IF EXISTS fk_patients_user_id;')
        cursor.execute('DROP INDEX IF EXISTS "BloomCare".idx_users_user_id;')
        cursor.execute('DROP INDEX IF EXISTS "BloomCare".idx_patients_user_id;')

        cursor.execute('ALTER TABLE "BloomCare".users DROP COLUMN IF EXISTS user_id;')
        cursor.execute('ALTER TABLE "BloomCare".patients DROP COLUMN IF EXISTS user_id;')
        cursor.execute('ALTER TABLE "BloomCare".users DROP COLUMN IF EXISTS nic;')
        cursor.execute('ALTER TABLE "BloomCare".users DROP COLUMN IF EXISTS telephone;')
        cursor.execute('ALTER TABLE "BloomCare".users DROP COLUMN IF EXISTS birthday;')
        cursor.execute('ALTER TABLE "BloomCare".users DROP COLUMN IF EXISTS is_first_login;')
        cursor.execute('ALTER TABLE "BloomCare".users DROP COLUMN IF EXISTS updated_at;')

        print("  Ensuring recommended indexes...")
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_patients_national_id ON "BloomCare".patients(national_id);')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_role ON "BloomCare".users(role);')

        conn.commit()
        cursor.close()
        conn.close()

        print("✓ Database migration completed successfully!")
        return True
    except psycopg2.Error as exc:
        print(f"✗ Database error: {exc}")
        return False
    except Exception as exc:
        print(f"✗ Error: {exc}")
        return False


if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)