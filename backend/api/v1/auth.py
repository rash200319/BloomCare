from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.core import security
from backend.core.config import settings
from backend.core.deps import get_db, get_current_user
from backend.schemas.auth import (
    PatientLoginRequest,
    StaffLoginRequest,
    FirstLoginPatientSetupRequest,
    FirstLoginStaffSetupRequest,
    LoginResponse,
    ChangePasswordRequest,
    PatientPasswordResetRequest,
    PatientPasswordResetOTPVerify,
    StaffPasswordResetRequest,
    StaffPasswordResetOTPVerify,
    PasswordResetResponse,
)
from backend.models.user import User as DBUser
from backend.services.staff_patient_service import AuthService

router = APIRouter()


# ============== AUTH ENDPOINTS FOR STAFF & PATIENT MANAGEMENT ==============

@router.post(
    "/login/patient",
    response_model=LoginResponse,
    summary="Patient Login",
    description="Login using national_id and password"
)
def login_patient(
    credentials: PatientLoginRequest,
    db: Session = Depends(get_db)
) -> Any:
    user = AuthService.authenticate_patient(
        db, credentials.national_id, credentials.password)

    if not getattr(user, "is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    access_token_expires = timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return LoginResponse(
        access_token=security.create_access_token(
            str(user.id), expires_delta=access_token_expires),
        token_type="bearer",
        id=str(user.id),
        full_name=user.full_name,
        role="PATIENT",
        is_first_login=user.first_time_login
    )


@router.post(
    "/login/staff",
    response_model=LoginResponse,
    summary="Staff/Doctor Login",
    description="Login using email and password"
)
def login_staff(
    credentials: StaffLoginRequest,
    db: Session = Depends(get_db)
) -> Any:
    user = AuthService.authenticate_staff(
        db, credentials.email, credentials.password)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    access_token_expires = timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return LoginResponse(
        access_token=security.create_access_token(
            str(user.id), expires_delta=access_token_expires),
        token_type="bearer",
        id=str(user.id),
        full_name=user.full_name,
        role=user.role.value,
        is_first_login=user.first_time_login
    )


@router.post(
    "/first-login/patient",
    response_model=dict,
    summary="Patient First Login Password Setup",
    description="Set password on first login using national ID"
)
def setup_patient_first_login_password(
    payload: FirstLoginPatientSetupRequest,
    db: Session = Depends(get_db)
) -> Any:
    return AuthService.setup_patient_first_login_password(
        db,
        payload.national_id,
        payload.password,
        payload.confirm_password,
    )


@router.post(
    "/first-login/staff",
    response_model=dict,
    summary="Staff/Doctor First Login Password Setup",
    description="Set password on first login using email"
)
def setup_staff_first_login_password(
    payload: FirstLoginStaffSetupRequest,
    db: Session = Depends(get_db)
) -> Any:
    return AuthService.setup_staff_first_login_password(
        db,
        payload.email,
        payload.password,
        payload.confirm_password,
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
    return AuthService.change_password(db, current_user.id, change_pwd.old_password, change_pwd.new_password)


# ============== PASSWORD RESET ENDPOINTS ==============

@router.post(
    "/forgot-password/patient/request",
    response_model=PasswordResetResponse,
    summary="Request Password Reset for Patient",
    description="Request OTP for patient password reset using national ID"
)
def request_patient_password_reset(
    payload: PatientPasswordResetRequest,
    db: Session = Depends(get_db)
) -> Any:
    """
    Request password reset OTP for patient.

    - **national_id**: Patient's national ID

    Returns masked phone number where OTP will be sent.
    """
    return AuthService.request_patient_password_reset(db, payload.national_id)


@router.post(
    "/forgot-password/patient/verify-otp",
    response_model=PasswordResetResponse,
    summary="Verify OTP and Reset Patient Password",
    description="Verify OTP code and set new password for patient"
)
def verify_and_reset_patient_password(
    payload: PatientPasswordResetOTPVerify,
    db: Session = Depends(get_db)
) -> Any:
    """
    Verify OTP and reset patient password.

    - **national_id**: Patient's national ID
    - **otp_code**: 6-digit OTP code (sent via SMS)
    - **new_password**: New password (must meet strength requirements)
    - **confirm_password**: Confirm new password

    Password must have:
    - Minimum 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character (!@#$%^&*)
    """
    return AuthService.verify_and_reset_patient_password(
        db,
        payload.national_id,
        payload.otp_code,
        payload.new_password,
        payload.confirm_password
    )


@router.post(
    "/forgot-password/staff/request",
    response_model=PasswordResetResponse,
    summary="Request Password Reset for Staff",
    description="Request OTP for staff password reset using email"
)
def request_staff_password_reset(
    payload: StaffPasswordResetRequest,
    db: Session = Depends(get_db)
) -> Any:
    """
    Request password reset OTP for staff.

    - **email**: Staff member's email

    Returns masked email where OTP will be sent.
    """
    return AuthService.request_staff_password_reset(db, payload.email)


@router.post(
    "/forgot-password/staff/verify-otp",
    response_model=PasswordResetResponse,
    summary="Verify OTP and Reset Staff Password",
    description="Verify OTP code and set new password for staff"
)
def verify_and_reset_staff_password(
    payload: StaffPasswordResetOTPVerify,
    db: Session = Depends(get_db)
) -> Any:
    """
    Verify OTP and reset staff password.

    - **email**: Staff member's email
    - **otp_code**: 6-digit OTP code (sent via email)
    - **new_password**: New password (must meet strength requirements)
    - **confirm_password**: Confirm new password

    Password must have:
    - Minimum 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character (!@#$%^&*)
    """
    return AuthService.verify_and_reset_staff_password(
        db,
        payload.email,
        payload.otp_code,
        payload.new_password,
        payload.confirm_password
    )
