"""
Staff, Patient, and Auth services.
"""
from sqlalchemy import String, cast
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import secrets
import string

from backend.models.user import User, UserRole
from backend.models.patient import Patient
from backend.core.security import get_password_hash, verify_password
from backend.schemas.staff import CreateStaffRequest, StaffResponse, TemporaryPasswordResponse
from backend.schemas.patient import CreatePatientRequest, PatientManagementResponse


def generate_temporary_password(length: int = 16) -> str:
    """Generate a strong random password used for pre-activation accounts."""
    characters = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(characters) for _ in range(length))


def validate_password_strength(password: str) -> bool:
    """Validate password strength."""
    if len(password) < 8:
        return False
    if not any(char.isupper() for char in password):
        return False
    if not any(char.islower() for char in password):
        return False
    if not any(char.isdigit() for char in password):
        return False
    if not any(char in "!@#$%^&*" for char in password):
        return False
    return True


class StaffService:
    """Service for staff management."""

    @staticmethod
    def create_staff(db: Session, staff_data: CreateStaffRequest) -> TemporaryPasswordResponse:
        """Create a staff member (FRONTLINE_STAFF or CLINICAL_SPECIALIST)."""
        if staff_data.role not in [UserRole.FRONTLINE_STAFF, UserRole.CLINICAL_SPECIALIST]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role must be FRONTLINE_STAFF or CLINICAL_SPECIALIST",
            )

        if db.query(User).filter(User.email == staff_data.email).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

        placeholder_password = generate_temporary_password()
        new_user = User(
            email=staff_data.email,
            phone_number=staff_data.phone_number,
            full_name=staff_data.full_name,
            hashed_password=get_password_hash(placeholder_password),
            role=staff_data.role,
            specialization=staff_data.specialization if staff_data.role == UserRole.CLINICAL_SPECIALIST else None,
            first_time_login=True,
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return TemporaryPasswordResponse(
            id=str(new_user.id),
            full_name=new_user.full_name,
            email=new_user.email,
            role=new_user.role.value,
            is_first_login=new_user.first_time_login,
        )

    @staticmethod
    def get_staff(
        db: Session,
        full_name: str = None,
        user_pk: str = None,
        email: str = None,
        role: UserRole = None,
    ) -> list[StaffResponse]:
        """Retrieve staff members with optional filters."""
        query = db.query(User).filter(
            User.role.in_([UserRole.FRONTLINE_STAFF, UserRole.CLINICAL_SPECIALIST])
        )

        if full_name:
            query = query.filter(User.full_name.ilike(f"%{full_name}%"))
        if user_pk:
            query = query.filter(User.id == user_pk)
        if email:
            query = query.filter(User.email == email)
        if role:
            query = query.filter(User.role == role)

        staff = query.all()
        return [
            StaffResponse(
                id=str(s.id),
                full_name=s.full_name,
                email=s.email,
                phone_number=s.phone_number,
                role=s.role.value,
                specialization=s.specialization,
                is_active=s.is_active,
            )
            for s in staff
        ]


class PatientService:
    """Service for patient management."""

    @staticmethod
    def create_patient(db: Session, patient_data: CreatePatientRequest) -> PatientManagementResponse:
        """Create a patient account in patients table."""
        existing_patient = db.query(Patient).filter(
            Patient.national_id == patient_data.national_id
        ).first()
        if existing_patient:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Patient with this national ID already exists",
            )

        placeholder_password = generate_temporary_password()

        new_patient = Patient(
            national_id=patient_data.national_id,
            full_name=patient_data.full_name,
            age=patient_data.age,
            due_date=patient_data.due_date,
            contact_number=patient_data.contact_number,
            hashed_password=get_password_hash(placeholder_password),
            emergency_contact=patient_data.emergency_contact,
            blood_group=patient_data.blood_group,
            first_time_login=True,
        )

        db.add(new_patient)
        db.commit()
        db.refresh(new_patient)

        return PatientManagementResponse(
            id=str(new_patient.id),
            full_name=new_patient.full_name,
            national_id=new_patient.national_id,
            due_date=new_patient.due_date,
            age=new_patient.age,
            contact_number=new_patient.contact_number,
            emergency_contact=new_patient.emergency_contact,
            blood_group=new_patient.blood_group,
        )

    @staticmethod
    def get_patients(db: Session, full_name: str = None, patient_id: str = None) -> list[PatientManagementResponse]:
        """Retrieve patients with optional filters."""
        query = db.query(Patient)

        if full_name:
            query = query.filter(Patient.full_name.ilike(f"%{full_name}%"))
        if patient_id:
            query = query.filter(Patient.id == patient_id)

        patients = query.all()
        return [
            PatientManagementResponse(
                id=str(p.id),
                full_name=p.full_name,
                national_id=p.national_id,
                due_date=p.due_date,
                age=p.age,
                contact_number=p.contact_number,
                emergency_contact=p.emergency_contact,
                blood_group=p.blood_group,
            )
            for p in patients
        ]


class AuthService:
    """Service for authentication and password management."""

    @staticmethod
    def _validate_password_setup(password: str, confirm_password: str) -> None:
        if password != confirm_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password and confirm password do not match",
            )
        if not validate_password_strength(password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters with uppercase, lowercase, digit, and special character",
            )

    @staticmethod
    def authenticate_patient(db: Session, national_id: str, password: str) -> Patient:
        """Authenticate patient using national_id + password from patients table."""
        patient = db.query(Patient).filter(Patient.national_id == national_id).first()
        if not patient or not verify_password(password, patient.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return patient

    @staticmethod
    def authenticate_staff(db: Session, email: str, password: str) -> User:
        """Authenticate frontline staff or doctor using email + password."""
        user = db.query(User).filter(
            User.email == email,
            cast(User.role, String).in_(["FRONTLINE_STAFF", "CLINICAL_SPECIALIST", "DOCTOR", "ADMIN"]),
        ).first()
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user

    @staticmethod
    def setup_patient_first_login_password(
        db: Session, national_id: str, password: str, confirm_password: str
    ) -> dict:
        """Set first-login password for patient using national ID."""
        patient = db.query(Patient).filter(Patient.national_id == national_id).first()
        if not patient:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient account not found")
        if not patient.first_time_login:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password already set")

        AuthService._validate_password_setup(password, confirm_password)
        patient.hashed_password = get_password_hash(password)
        patient.first_time_login = False
        db.commit()
        return {"message": "Password set successfully"}

    @staticmethod
    def setup_staff_first_login_password(
        db: Session, email: str, password: str, confirm_password: str
    ) -> dict:
        """Set first-login password for staff/doctor using email."""
        user = db.query(User).filter(
            User.email == email,
            cast(User.role, String).in_(["FRONTLINE_STAFF", "CLINICAL_SPECIALIST", "DOCTOR", "ADMIN"]),
        ).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff account not found")
        if not user.first_time_login:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password already set")

        AuthService._validate_password_setup(password, confirm_password)
        user.hashed_password = get_password_hash(password)
        user.first_time_login = False
        db.commit()
        return {"message": "Password set successfully"}

    @staticmethod
    def change_password(db: Session, user_pk: str, old_password: str, new_password: str) -> dict:
        """Change password for an authenticated user."""
        if not validate_password_strength(new_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters with uppercase, lowercase, digit, and special character",
            )

        user = db.query(User).filter(User.id == user_pk).first()
        if user:
            if not verify_password(old_password, user.hashed_password):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")

            user.hashed_password = get_password_hash(new_password)
            user.first_time_login = False
            db.commit()
            return {"message": "Password changed successfully"}

        patient = db.query(Patient).filter(Patient.id == user_pk).first()
        if not patient:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        if not verify_password(old_password, patient.hashed_password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")

        patient.hashed_password = get_password_hash(new_password)
        patient.first_time_login = False
        db.commit()
        return {"message": "Password changed successfully"}