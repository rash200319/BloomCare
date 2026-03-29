"""
Authentication Routes
POST /api/v1/auth/register  → Create account
POST /api/v1/auth/login     → Get tokens
POST /api/v1/auth/refresh   → Rotate tokens
GET  /api/v1/auth/me        → Who am I?
"""

from datetime import datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from jose import JWTError

from app.core.database import get_db
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    decode_token, generate_user_id
)
from app.models.models import User, UserRole, Patient
from app.schemas.schemas import (
    UserRegister, UserLogin, TokenResponse,
    RefreshRequest, RegisterResponse, LoginResponse,
    UserPublic, MessageResponse
)
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Register ────────────────────────────────────────────────────────────────────
@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description=(
        "Creates a new BloomCare account. "
        "A role-based system ID (e.g. **PAT-0001**, **DOC-0023**) is automatically assigned."
    ),
)
def register(body: UserRegister, db: Annotated[Session, Depends(get_db)]):

    # ── Duplicate checks ─────────────────────────────────────────────────────
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{body.username}' is already taken. Please choose another.",
        )
    if db.query(User).filter(User.nic_number == body.nic_number).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this NIC number already exists.",
        )

    # ── Generate sequential role-based ID ────────────────────────────────────
    # Count existing users with the same role to determine the next number.
    role_enum = UserRole(body.role)
    role_count = db.query(User).filter(User.role == role_enum).count()
    new_user_id = generate_user_id(body.role, role_count + 1)

    # Edge case: if ID already exists (concurrent requests), bump the counter
    while db.query(User).filter(User.user_id == new_user_id).first():
        role_count += 1
        new_user_id = generate_user_id(body.role, role_count + 1)

    # ── Create User ───────────────────────────────────────────────────────────
    user = User(
        user_id=new_user_id,
        username=body.username,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        birthday=body.birthday,
        address=body.address,
        telephone=body.telephone,
        nic_number=body.nic_number,
        role=role_enum,
    )
    db.add(user)
    db.flush()  # Flush to get user.id before committing

    # ── Auto-create Patient profile for patient role ──────────────────────────
    if role_enum == UserRole.patient:
        patient_profile = Patient(user_id=user.id)
        db.add(patient_profile)

    db.commit()
    db.refresh(user)

    # ── Issue tokens ──────────────────────────────────────────────────────────
    access_token  = create_access_token(user.id, user.role.value)
    refresh_token = create_refresh_token(user.id, user.role.value)

    return RegisterResponse(
        message=(
            f"Welcome to BloomCare, {user.full_name}! "
            f"Your system ID is {user.user_id}."
        ),
        user_id=user.user_id,
        username=user.username,
        role=user.role.value,
        access_token=access_token,
        refresh_token=refresh_token,
    )


# ── Login ─────────────────────────────────────────────────────────────────────
@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Login with username and password",
    description=(
        "Authenticate using your **username** and **password**. "
        "Returns access + refresh JWT tokens along with your profile."
    ),
)
def login(body: UserLogin, db: Annotated[Session, Depends(get_db)]):

    user = db.query(User).filter(User.username == body.username).first()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password. Please try again.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Contact an administrator.",
        )

    # Record last login time
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    access_token  = create_access_token(user.id, user.role.value)
    refresh_token = create_refresh_token(user.id, user.role.value)

    return LoginResponse(
        user=UserPublic.model_validate(user),
        access_token=access_token,
        refresh_token=refresh_token,
    )


# ── Refresh Token ──────────────────────────────────────────────────────────────
@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
)
def refresh_token(body: RefreshRequest, db: Annotated[Session, Depends(get_db)]):
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type.")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token is invalid or expired.")

    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive.")

    return TokenResponse(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=create_refresh_token(user.id, user.role.value),
    )


# ── Me ─────────────────────────────────────────────────────────────────────────
@router.get(
    "/me",
    response_model=UserPublic,
    summary="Get current user profile",
)
def get_me(current_user: Annotated[User, Depends(get_current_user)]):
    return UserPublic.model_validate(current_user)
