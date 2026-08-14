"""Role normalization and appointment status helpers."""

import pytest

from backend.models.user import UserRole
from backend.services.appointment_service import AppointmentService as S


def test_user_role_enum_has_clinical_specialist():
    assert UserRole.CLINICAL_SPECIALIST.value == "CLINICAL_SPECIALIST"
    assert "OBSERTITIAN" not in {role.value for role in UserRole}


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("CLINICAL_SPECIALIST", "CLINICAL_SPECIALIST"),
        ("OBSERTITIAN", "CLINICAL_SPECIALIST"),
        ("DOCTOR", "CLINICAL_SPECIALIST"),
        ("doctor", "CLINICAL_SPECIALIST"),
        ("FRONTLINE_STAFF", "FRONTLINE_STAFF"),
        ("ADMIN", "ADMIN"),
        (UserRole.CLINICAL_SPECIALIST, "CLINICAL_SPECIALIST"),
    ],
)
def test_normalize_role_aliases(raw, expected):
    assert S._normalize_role(raw) == expected


@pytest.mark.parametrize(
    "raw,is_specialist",
    [
        ("CLINICAL_SPECIALIST", True),
        ("OBSERTITIAN", True),
        ("DOCTOR", True),
        ("FRONTLINE_STAFF", False),
        ("ADMIN", False),
        ("PATIENT", False),
    ],
)
def test_is_specialist_role(raw, is_specialist):
    assert S._is_specialist_role(raw) is is_specialist


@pytest.mark.parametrize(
    "status,expected",
    [
        ("SCHEDULED", "PENDING"),
        ("PENDING", "PENDING"),
        ("CONFIRMED", "CONFIRMED"),
        (" scheduled ", "PENDING"),
    ],
)
def test_normalize_status(status, expected):
    assert S._normalize_status(status) == expected


def test_default_appointment_type_by_role():
    assert S._default_appointment_type("CLINICAL_SPECIALIST") == "HIGH_RISK_FOLLOW_UP"
    assert S._default_appointment_type("OBSERTITIAN") == "HIGH_RISK_FOLLOW_UP"
    assert S._default_appointment_type("FRONTLINE_STAFF") == "PRENATAL_CHECKUP"
