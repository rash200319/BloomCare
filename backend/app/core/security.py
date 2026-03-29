from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from passlib.context import CryptContext
from jose import JWTError, jwt
from app.core.config import settings

# ── Password Hashing ────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    # Bcrypt has a 72-byte limit; truncate if necessary
    return pwd_context.hash(plain[:72])


def verify_password(plain: str, hashed: str) -> bool:
    # Bcrypt has a 72-byte limit; truncate if necessary
    return pwd_context.verify(plain[:72], hashed)


# ── JWT ──────────────────────────────────────────────────────────────────────
def _create_token(data: dict, expires_delta: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(tz=timezone.utc) + expires_delta
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(subject: Any, role: str) -> str:
    return _create_token(
        {"sub": str(subject), "role": role, "type": "access"},
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(subject: Any, role: str) -> str:
    return _create_token(
        {"sub": str(subject), "role": role, "type": "refresh"},
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str) -> dict:
    """Returns payload dict; raises JWTError on failure."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


# ── Role-Based User ID Generation ────────────────────────────────────────────
ROLE_PREFIXES = {
    "admin":    "ADM",
    "doctor":   "DOC",
    "frontline": "FLS",
    "patient":  "PAT",
}


def generate_user_id(role: str, sequential_number: int) -> str:
    """
    Generates a human-readable, role-aware user ID.
    Example: ADM-0001, DOC-0023, PAT-1042
    """
    prefix = ROLE_PREFIXES.get(role.lower(), "USR")
    return f"{prefix}-{sequential_number:04d}"
