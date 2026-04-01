from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.core import security
from backend.core.config import settings
from backend.core.deps import get_db, get_current_user
from backend.schemas.auth import LoginRequest, LoginResponse, ChangePasswordRequest
from backend.models.user import User as DBUser
from backend.services.staff_patient_service import AuthService

router = APIRouter()


# ============== AUTH ENDPOINTS FOR STAFF & PATIENT MANAGEMENT ==============

@router.post(
    "/login-user-id",
    response_model=LoginResponse,
    summary="Login with User ID",
    description="Login using user_id and password (for staff and patients)"
)
def login_with_user_id(
    credentials: LoginRequest,
    db: Session = Depends(get_db)
) -> Any:
    """
    Login endpoint for staff and patients using user_id and password.

    - **user_id**: User ID (FLS-XXXX, DOC-XXXX, or PAT-XXXX)
    - **password**: Password

    Returns JWT access token and user information.
    If is_first_login is True, user MUST change password before proceeding.
    """
    user = AuthService.authenticate_user(
        db, credentials.user_id, credentials.password)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    access_token_expires = timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return LoginResponse(
        access_token=security.create_access_token(
            user.id, expires_delta=access_token_expires),
        token_type="bearer",
        user_id=user.user_id,
        full_name=user.full_name,
        role=user.role.value,
        is_first_login=user.is_first_login
    )


@router.post(
    "/change-password",
    response_model=dict,
    summary="Change Password",
    description="Change user password (must be called on first login)"
)
def change_password(
    change_pwd: ChangePasswordRequest,
    current_user: DBUser = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Change user password.

    - **old_password**: Current password
    - **new_password**: New password (must meet strength requirements)

    Password must have:
    - Minimum 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character (!@#$%^&*)

    Sets is_first_login to False after successful change.
    """
    return AuthService.change_password(db, current_user.user_id, change_pwd.old_password, change_pwd.new_password)
