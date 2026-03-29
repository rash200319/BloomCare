from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ...core import security
from ...core.config import settings
from ...core.deps import get_db, get_current_user
from ...services import auth_service
from ...schemas.auth import Token
from ...schemas.user import User, UserCreate
from ...models.user import User as DBUser
import uuid

router = APIRouter()


def _serialize_user(user: DBUser) -> User:
    role_value = user.role.value if hasattr(user.role, "value") else str(user.role)
    return User(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=role_value,
        is_active=bool(user.is_active),
    )

@router.post("/login", response_model=Token)
def login_access_token(
    db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    user = auth_service.authenticate(
        db, email=form_data.username, password=form_data.password
    )
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

@router.post("/register", response_model=User)
def register_user(
    *,
    db: Session = Depends(get_db),
    user_in: UserCreate,
) -> Any:
    user = auth_service.get_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system",
        )
    user = DBUser(
        id=str(uuid.uuid4()),
        email=user_in.email,
        hashed_password=security.get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _serialize_user(user)

@router.get("/me", response_model=User)
def read_user_me(
    current_user: DBUser = Depends(get_current_user),
) -> Any:
    return _serialize_user(current_user)
