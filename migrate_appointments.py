#!/usr/bin/env python
"""
Database migration script to add missing columns to appointments table
"""
import psycopg2

try:
    conn = psycopg2.connect(
        dbname='bloomcare',
        user='postgres',
        password='2003',
        host='localhost',
        port=5432
    )
    cursor = conn.cursor()
    
    print("Adding duration_minutes column...")
    cursor.execute('ALTER TABLE "BloomCare".appointments ADD COLUMN IF NOT EXISTS duration_minutes INT DEFAULT 30;')
    print("✓ duration_minutes added")
    
    print("Adding queue_number column...")
    cursor.execute('ALTER TABLE "BloomCare".appointments ADD COLUMN IF NOT EXISTS queue_number INT;')
    print("✓ queue_number added")
    
    print("Adding updated_at column...")
    cursor.execute('ALTER TABLE "BloomCare".appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;')
    print("✓ updated_at added")
    
    conn.commit()
    print("\n✓ Migration completed successfully!")
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"✗ Migration failed: {e}")
    if conn:
        conn.rollback()
        conn.close()
