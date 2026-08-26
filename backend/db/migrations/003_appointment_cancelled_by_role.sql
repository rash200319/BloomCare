-- Fixes a live bug: Temporal's finalize_booking_decision activity cancels an
-- appointment (patient self-cancel, or the workflow's own auto-expire on
-- confirmation timeout) without a staff users.id to attribute it to, which
-- violated chk_cancelled_appointment_audit and permanently failed the
-- workflow. Adds cancelled_by_role as an alternative audit trail alongside
-- cancelled_by_id, mirroring the existing created_by_id/created_by_role
-- pattern. Apply with the BloomCare schema on the search_path or run as a
-- schema owner.

ALTER TABLE "BloomCare".appointments
    ADD COLUMN IF NOT EXISTS cancelled_by_role VARCHAR(50);

ALTER TABLE "BloomCare".appointments
    DROP CONSTRAINT IF EXISTS chk_cancelled_appointment_audit;

ALTER TABLE "BloomCare".appointments
    ADD CONSTRAINT chk_cancelled_appointment_audit CHECK (
        (status = 'CANCELLED' AND cancelled_at IS NOT NULL
            AND (cancelled_by_id IS NOT NULL OR cancelled_by_role IS NOT NULL))
        OR status != 'CANCELLED'
    );
