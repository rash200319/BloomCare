"""P1 security helpers: throttle, token version, audit flag."""

from backend.core.security import create_access_token
from backend.core.config import settings
from backend.services.login_throttle import LoginThrottle
from jose import jwt
from fastapi import HTTPException
import pytest


def test_access_token_includes_token_version():
    token = create_access_token(subject="user-123", token_version=3)
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == "user-123"
    assert payload["tv"] == 3


def test_login_throttle_locks_after_max_failures(monkeypatch):
    LoginThrottle.clear_all()
    monkeypatch.setattr(settings, "BLOOMCARE_LOGIN_MAX_ATTEMPTS", 3)
    monkeypatch.setattr(settings, "BLOOMCARE_LOGIN_LOCKOUT_MINUTES", 15)

    for _ in range(3):
        LoginThrottle.record_failure("staff", "throttle@test.local")

    with pytest.raises(HTTPException) as exc:
        LoginThrottle.assert_allowed("staff", "throttle@test.local")
    assert exc.value.status_code == 429

    LoginThrottle.reset("staff", "throttle@test.local")
    LoginThrottle.assert_allowed("staff", "throttle@test.local")


def test_login_throttle_can_be_disabled(monkeypatch):
    LoginThrottle.clear_all()
    monkeypatch.setattr(settings, "BLOOMCARE_LOGIN_MAX_ATTEMPTS", 0)
    for _ in range(50):
        LoginThrottle.record_failure("patient", "NIC-LOCK")
    LoginThrottle.assert_allowed("patient", "NIC-LOCK")


def test_audit_flag_defaults_off():
    assert settings.BLOOMCARE_AUDIT_LOG_ENABLED is False
