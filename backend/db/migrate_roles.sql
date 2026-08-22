-- Migrate legacy OBSERTITIAN role → CLINICAL_SPECIALIST (PostgreSQL)
-- Safe to re-run. Keeps demo emails (e.g. obstetrician@bloomcare.health) unchanged.
--
-- Usage:
--   psql -d <your_db> -f backend/db/migrate_roles.sql
-- Or: python backend/db/migrate_roles.py

SET search_path TO "BloomCare", public;

DO $$
BEGIN
    BEGIN
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'CLINICAL_SPECIALIST';
    EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN undefined_object THEN NULL;
    END;
END $$;

-- Some Postgres versions cannot use new enum values in the same transaction as ADD VALUE.
-- Run the UPDATEs after the DO block commits when executing manually in one session with autocommit.

UPDATE users
SET role = 'CLINICAL_SPECIALIST'
WHERE role::text = 'OBSERTITIAN';

UPDATE appointments
SET created_by_role = 'CLINICAL_SPECIALIST'
WHERE created_by_role = 'OBSERTITIAN';
