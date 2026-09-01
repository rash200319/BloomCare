from fastapi import HTTPException

from backend.services.appointment_service import AppointmentService


def test_pending_to_completed_is_allowed():
    AppointmentService._ensure_allowed_status_transition("PENDING", "COMPLETED")


def test_scheduled_to_completed_is_allowed():
    AppointmentService._ensure_allowed_status_transition("SCHEDULED", "COMPLETED")


def test_confirmed_to_completed_is_allowed():
    AppointmentService._ensure_allowed_status_transition("CONFIRMED", "COMPLETED")


def test_completed_to_pending_is_rejected():
    try:
        AppointmentService._ensure_allowed_status_transition("COMPLETED", "PENDING")
    except HTTPException as exc:
        assert exc.status_code == 400
        return
    raise AssertionError("expected HTTP 400 for COMPLETED → PENDING")


def test_serialize_keeps_completed_status(monkeypatch):
    from types import SimpleNamespace
    from backend.services import appointment_rules

    fake_db = SimpleNamespace()

    class _Query:
        def filter(self, *args, **kwargs):
            return self

        def order_by(self, *args, **kwargs):
            return self

        def first(self):
            return None

    fake_db.query = lambda *args, **kwargs: _Query()
    appointment = SimpleNamespace(
        id="11111111-1111-1111-1111-111111111111",
        patient_id="22222222-2222-2222-2222-222222222222",
        specialist_id=None,
        created_by_id=None,
        created_by_role="FRONTLINE_STAFF",
        appointment_type="PRENATAL_CHECKUP",
        appointment_date="2026-09-01T10:00:00Z",
        duration_minutes=30,
        queue_number=1,
        status="COMPLETED",
        notes=None,
        completed_by_id=None,
        completed_at=None,
        cancelled_by_id=None,
        cancelled_at=None,
        reason_for_cancellation=None,
        created_at="2026-09-01T10:00:00Z",
        updated_at="2026-09-01T10:00:00Z",
    )
    result = AppointmentService._serialize_appointment(fake_db, appointment)
    assert result.status == "COMPLETED"
