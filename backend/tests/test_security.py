"""Password hashing / JWT helpers."""

from backend.core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)
from backend.core.config import settings, DEMO_SECRET_KEY, validate_security_settings
from jose import jwt
import pytest


def test_password_hash_roundtrip():
    hashed = get_password_hash("rash2003")
    assert hashed != "rash2003"
    assert verify_password("rash2003", hashed)
    assert not verify_password("wrong", hashed)


def test_access_token_contains_subject():
    token = create_access_token(subject="user-123")
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == "user-123"
    assert "exp" in payload


def test_access_token_default_lifetime_under_one_day():
    assert settings.ACCESS_TOKEN_EXPIRE_MINUTES <= 60 * 24


def test_validate_security_settings_allows_local_demo_secret(monkeypatch):
    monkeypatch.setattr(settings, "BLOOMCARE_ENFORCE_SECRETS", False)
    monkeypatch.setattr(settings, "BLOOMCARE_ENV", "local")
    if settings.SECRET_KEY == DEMO_SECRET_KEY:
        validate_security_settings()


def test_validate_security_settings_fails_when_enforced(monkeypatch):
    monkeypatch.setattr(settings, "BLOOMCARE_ENFORCE_SECRETS", True)
    monkeypatch.setattr(settings, "SECRET_KEY", DEMO_SECRET_KEY)
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        validate_security_settings()
