#!/usr/bin/env python3
"""
Database Migration Script
Applies schema updates to support staff & patient management
"""
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import sys


def run_migration():
    """Run database migration"""
    try:
        # Connect to PostgreSQL
        conn = psycopg2.connect(
            host='localhost',
            user='postgres',
            password='2003',
            database='bloomcare'
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()

        print("Starting database migration...")

        # Step 1: Create sequences
        print("  Creating sequences...")
        cursor.execute(
            'CREATE SEQUENCE IF NOT EXISTS "BloomCare".fls_id_sequence START 1;')
        cursor.execute(
            'CREATE SEQUENCE IF NOT EXISTS "BloomCare".doc_id_sequence START 1;')
        cursor.execute(
            'CREATE SEQUENCE IF NOT EXISTS "BloomCare".pat_id_sequence START 1;')

        # Step 2: Add new columns to users table
        print("  Adding columns to users table...")
        cursor.execute('''
            ALTER TABLE "BloomCare".users
            ADD COLUMN IF NOT EXISTS user_id VARCHAR(50) UNIQUE;
        ''')
        cursor.execute(
            'ALTER TABLE "BloomCare".users ADD COLUMN IF NOT EXISTS nic VARCHAR(100) UNIQUE;')
        cursor.execute(
            'ALTER TABLE "BloomCare".users ADD COLUMN IF NOT EXISTS telephone VARCHAR(20);')
        cursor.execute(
            'ALTER TABLE "BloomCare".users ADD COLUMN IF NOT EXISTS birthday DATE;')
        cursor.execute(
            'ALTER TABLE "BloomCare".users ADD COLUMN IF NOT EXISTS specialization VARCHAR(255);')
        cursor.execute(
            'ALTER TABLE "BloomCare".users ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN DEFAULT TRUE;')
        cursor.execute(
            'ALTER TABLE "BloomCare".users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;')

        # Step 3: Add columns to patients table
        print("  Adding columns to patients table...")
        cursor.execute(
            'ALTER TABLE "BloomCare".patients ADD COLUMN IF NOT EXISTS user_id VARCHAR(50) UNIQUE;')
        cursor.execute(
            'ALTER TABLE "BloomCare".patients ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255);')

        # Step 4: Create user_id generation function
        print("  Creating user_id generation function...")
        cursor.execute('''
            CREATE OR REPLACE FUNCTION "BloomCare".generate_user_id(p_role "BloomCare".user_role)
            RETURNS VARCHAR AS $$
            DECLARE
                v_sequence_val BIGINT;
                v_prefix VARCHAR;
                v_user_id VARCHAR;
            BEGIN
                IF p_role = 'FRONTLINE_STAFF' THEN
                    v_sequence_val := nextval('"BloomCare".fls_id_sequence');
                    v_prefix := 'FLS';
                ELSIF p_role = 'CLINICAL_SPECIALIST' THEN
                    v_sequence_val := nextval('"BloomCare".doc_id_sequence');
                    v_prefix := 'DOC';
                ELSIF p_role = 'PATIENT' THEN
                    v_sequence_val := nextval('"BloomCare".pat_id_sequence');
                    v_prefix := 'PAT';
                ELSE
                    RAISE EXCEPTION 'Invalid role for user_id generation: %', p_role;
                END IF;
                
                v_user_id := v_prefix || '-' || LPAD(v_sequence_val::TEXT, 4, '0');
                RETURN v_user_id;
            END;
            $$ LANGUAGE plpgsql;
        ''')

        # Step 5: Create trigger for auto-generating user_id
        print("  Creating trigger for user_id generation...")
        cursor.execute('''
            CREATE OR REPLACE FUNCTION "BloomCare".trigger_generate_user_id()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.user_id IS NULL OR NEW.user_id = '' THEN
                    NEW.user_id := "BloomCare".generate_user_id(NEW.role);
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        ''')

        cursor.execute(
            'DROP TRIGGER IF EXISTS trg_generate_user_id ON "BloomCare".users;')
        cursor.execute('''
            CREATE TRIGGER trg_generate_user_id
            BEFORE INSERT ON "BloomCare".users
            FOR EACH ROW
            EXECUTE FUNCTION "BloomCare".trigger_generate_user_id();
        ''')

        # Step 6: Create indexes
        print("  Creating indexes...")
        cursor.execute(
            'CREATE INDEX IF NOT EXISTS idx_users_user_id ON "BloomCare".users(user_id);')
        cursor.execute(
            'CREATE INDEX IF NOT EXISTS idx_users_nic ON "BloomCare".users(nic);')
        cursor.execute(
            'CREATE INDEX IF NOT EXISTS idx_users_role ON "BloomCare".users(role);')
        cursor.execute(
            'CREATE INDEX IF NOT EXISTS idx_patients_user_id ON "BloomCare".patients(user_id);')

        # Step 7: Create foreign key from patients to users
        print("  Creating foreign key constraints...")
        try:
            cursor.execute('''
                ALTER TABLE "BloomCare".patients
                ADD CONSTRAINT fk_patients_user_id
                FOREIGN KEY (user_id) REFERENCES "BloomCare".users(user_id) ON DELETE CASCADE;
            ''')
        except psycopg2.Error:
            print("    Foreign key already exists (skipping)...")

        # Commit changes
        conn.commit()
        print("✓ Database migration completed successfully!")
        cursor.close()
        conn.close()
        return True

    except psycopg2.Error as e:
        print(f"✗ Database error: {e}")
        return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
