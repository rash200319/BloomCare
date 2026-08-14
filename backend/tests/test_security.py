"""Password hashing / JWT helpers."""

from backend.core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)
from jose import jwt
from backend.core.config import settings


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
