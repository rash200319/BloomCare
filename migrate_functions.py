#!/usr/bin/env python
"""
Database migration script to add PostgreSQL functions for appointment management
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
    
    # Function 1: Get next queue number
    print("Creating get_next_queue_number function...")
    cursor.execute("""
    CREATE OR REPLACE FUNCTION "BloomCare".get_next_queue_number(p_specialist_id UUID, p_appointment_date TIMESTAMPTZ)
    RETURNS INT AS $$
    DECLARE
        v_next_queue INT;
    BEGIN
        SELECT COALESCE(MAX(queue_number), 0) + 1 INTO v_next_queue
        FROM "BloomCare".appointments
        WHERE specialist_id = p_specialist_id
          AND DATE(appointment_date) = DATE(p_appointment_date)
          AND status != 'CANCELLED';
        
        RETURN v_next_queue;
    END;
    $$ LANGUAGE plpgsql;
    """)
    print("✓ get_next_queue_number created")
    
    # Function 2: Check for double booking
    print("Creating check_double_booking function...")
    cursor.execute("""
    CREATE OR REPLACE FUNCTION "BloomCare".check_double_booking(
        p_specialist_id UUID, 
        p_appointment_date TIMESTAMPTZ, 
        p_duration_minutes INT
    )
    RETURNS BOOLEAN AS $$
    DECLARE
        v_appointment_end TIMESTAMPTZ;
    BEGIN
        v_appointment_end := p_appointment_date + (p_duration_minutes || ' minutes')::INTERVAL;
        
        RETURN EXISTS (
            SELECT 1 FROM "BloomCare".appointments
            WHERE specialist_id = p_specialist_id
              AND DATE(appointment_date) = DATE(p_appointment_date)
              AND status != 'CANCELLED'
              AND appointment_date < v_appointment_end
              AND (appointment_date + (COALESCE(duration_minutes, 30) || ' minutes')::INTERVAL) > p_appointment_date
        );
    END;
    $$ LANGUAGE plpgsql;
    """)
    print("✓ check_double_booking created")
    
    # Function 3: Touch updated_at trigger function
    print("Creating touch_updated_at trigger function...")
    cursor.execute("""
    CREATE OR REPLACE FUNCTION "BloomCare".touch_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at := CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    """)
    print("✓ touch_updated_at created")
    
    # Trigger: Auto-update updated_at on appointments
    print("Creating trigger for appointments.updated_at...")
    cursor.execute("""
    DROP TRIGGER IF EXISTS trg_appointments_touch_updated_at ON "BloomCare".appointments;
    CREATE TRIGGER trg_appointments_touch_updated_at
    BEFORE UPDATE ON "BloomCare".appointments
    FOR EACH ROW
    EXECUTE FUNCTION "BloomCare".touch_updated_at();
    """)
    print("✓ Trigger created")
    
    conn.commit()
    print("\n✓ Migration completed successfully!")
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"✗ Migration failed: {e}")
    if conn:
        conn.rollback()
        conn.close()
