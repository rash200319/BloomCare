from datetime import datetime, timedelta, timezone
from typing import Any, Union, Optional
import bcrypt
from passlib.context import CryptContext
from jose import jwt

from .config import settings

# Generate and verify passlib-managed hashes using pbkdf2_sha256.
# Legacy bcrypt rows are verified via bcrypt.checkpw below.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def create_access_token(
    subject: Union[str, Any],
    expires_delta: Optional[timedelta] = None,
    token_version: int = 0,
) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "tv": int(token_version or 0),
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Legacy user rows may use bcrypt ($2a$, $2b$, $2y$). Verify directly to avoid
    # passlib+bcrypt backend version incompatibilities.
    if hashed_password and hashed_password.startswith("$2"):
        try:
            return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
        except ValueError:
            return False

    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)
