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
