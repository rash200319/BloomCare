"""Appointment service facade — public API unchanged for routers/tests."""
from backend.models.user import UserRole
from backend.services.appointment_rules import AppointmentRules
from backend.services.appointment_booking import AppointmentBooking
from backend.services.appointment_queries import AppointmentQueries


class AppointmentService(AppointmentRules, AppointmentBooking, AppointmentQueries):
    """Service for managing appointments."""


class _LegacySystemUser:
    """Compatibility shim for legacy booking callers that did not pass a creator."""

    id = None
    role = UserRole.ADMIN
