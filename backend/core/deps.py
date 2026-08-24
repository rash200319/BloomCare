from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy.orm import Session

from backend.core import security
from backend.core.config import settings
from backend.db.session import SessionLocal
from backend.models.user import User, UserRole
from backend.models.patient import Patient
from backend.schemas.auth import TokenPayload

security_scheme = HTTPBearer(
    description="Enter your JWT token here. Get it by calling /auth/login/staff or /auth/login/patient."
)


def get_db() -> Generator:
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()


def get_current_user(
    db: Session = Depends(get_db), credentials: HTTPAuthorizationCredentials = Depends(security_scheme)
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user = db.query(User).filter(User.id == token_data.sub).first()
    if user:
        return user

    patient = db.query(Patient).filter(Patient.id == token_data.sub).first()
    if patient:
        # Patients are managed in patients table, but protected routes expect role/full_name attrs.
        class PatientPrincipal:
            pass

        principal = PatientPrincipal()
        principal.id = patient.id
        principal.full_name = patient.full_name
        principal.role = UserRole.PATIENT
        principal.is_active = True
        principal.national_id = patient.national_id
        return principal

    raise HTTPException(status_code=404, detail="User not found")


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def get_current_admin(
    current_user: User = Depends(get_current_active_user),
) -> User:
    role_name = current_user.role.value if hasattr(
        current_user.role, "value") else str(current_user.role)
    if role_name != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges"
        )
    return current_user


def get_current_clinic_staff(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Frontline, clinical specialist, or admin — for patient management routes."""
    role_name = current_user.role.value if hasattr(
        current_user.role, "value") else str(current_user.role)
    if role_name not in {"ADMIN", "FRONTLINE_STAFF", "CLINICAL_SPECIALIST"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clinic staff privileges required",
        )
    return current_user


def _role_name(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def can_access_patient(db: Session, current_user: User, patient_id: str) -> bool:
    """
    Least-privilege patient access (aligned with patients.py history/detail):
    - ADMIN / CLINICAL_SPECIALIST: any patient
    - PATIENT: own id only
    - FRONTLINE_STAFF: assigned_worker_id match only
    """
    role = _role_name(current_user)
    if role in {"ADMIN", "CLINICAL_SPECIALIST"}:
        return True
    if role == "PATIENT":
        return str(current_user.id) == str(patient_id)
    if role == "FRONTLINE_STAFF":
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            return False
        return str(getattr(patient, "assigned_worker_id", "") or "") == str(current_user.id)
    return False


def require_patient_access(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> User:
    """FastAPI dependency: 403 unless current_user may access patient_id."""
    if not can_access_patient(db, current_user, patient_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this patient",
        )
    return current_user
