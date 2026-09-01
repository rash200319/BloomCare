"""Backward-compatible re-exports for staff/patient/auth services."""
from backend.services.password_helpers import (
    generate_temporary_password,
    validate_password_strength,
)
from backend.services.staff_service import StaffService
from backend.services.patient_service import PatientService
from backend.services.auth_service import AuthService

__all__ = [
    "StaffService",
    "PatientService",
    "AuthService",
    "generate_temporary_password",
    "validate_password_strength",
]
