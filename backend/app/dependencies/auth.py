"""
Auth dependency — extracts the current user from the JWT and verifies RBAC.
"""

from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError

from app.core.database import get_db
from app.core.security import decode_token
from app.models.models import User

bearer_scheme = HTTPBearer(auto_error=False)


def _get_token_payload(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> dict:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type.")
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    payload: Annotated[dict, Depends(_get_token_payload)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    user_id: str | None = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload.")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive.")
    return user


# ── Role Guards ───────────────────────────────────────────────────────────────
def _require_roles(*roles: str):
    def dependency(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if current_user.role.value not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(roles)}",
            )
        return current_user
    return dependency


require_admin    = _require_roles("admin")
require_doctor   = _require_roles("admin", "doctor")
require_frontline = _require_roles("admin", "frontline", "doctor")
require_patient  = _require_roles("patient")
require_any_staff = _require_roles("admin", "doctor", "frontline")
