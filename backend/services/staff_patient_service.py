"""
Staff & Patient Management Service
Handles staff/patient creation, retrieval, and validation
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from fastapi import HTTPException, status
import secrets
import string
from backend.models.user import User, UserRole
from backend.models.patient import Patient
from backend.core.security import get_password_hash, verify_password
from backend.schemas.staff import CreateStaffRequest, StaffResponse, TemporaryPasswordResponse
from backend.schemas.patient import CreatePatientRequest, PatientManagementResponse
from backend.schemas.auth import LoginResponse


def generate_temporary_password(length: int = 12) -> str:
    """Generate a strong temporary password"""
    characters = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(characters) for _ in range(length))


def validate_password_strength(password: str) -> bool:
    """Validate password strength"""
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
    """Service for staff management"""

    @staticmethod
    def create_staff(db: Session, staff_data: CreateStaffRequest) -> TemporaryPasswordResponse:
        """Create a staff member (FRONTLINE_STAFF or CLINICAL_SPECIALIST)"""

        # Validate role
        if staff_data.role not in [UserRole.FRONTLINE_STAFF, UserRole.CLINICAL_SPECIALIST]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role must be FRONTLINE_STAFF or CLINICAL_SPECIALIST"
            )

        # Check if email already exists
        existing_email = db.query(User).filter(
            User.email == staff_data.email).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

        # Check if NIC already exists
        existing_nic = db.query(User).filter(
            User.nic == staff_data.nic).first()
        if existing_nic:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="NIC already registered"
            )

        # Generate temporary password
        temp_password = generate_temporary_password()

        # Create user
        new_user = User(
            email=staff_data.email,
            nic=staff_data.nic,
            telephone=staff_data.telephone,
            full_name=staff_data.full_name,
            birthday=staff_data.birthday,
            hashed_password=get_password_hash(temp_password),
            role=staff_data.role,
            specialization=staff_data.specialization if staff_data.role == UserRole.CLINICAL_SPECIALIST else None,
            is_first_login=True
        )

        db.add(new_user)
        db.flush()  # Get the auto-generated user_id

        # Commit transaction
        db.commit()
        db.refresh(new_user)

        return TemporaryPasswordResponse(
            user_id=new_user.user_id,
            temporary_password=temp_password,
            full_name=new_user.full_name,
            email=new_user.email,
            role=new_user.role.value
        )

    @staticmethod
    def get_staff(
        db: Session,
        full_name: str = None,
        user_id: str = None,
        nic: str = None,
        role: UserRole = None
    ) -> list:
        """Retrieve staff members with optional filters"""

        query = db.query(User).filter(
            User.role.in_([UserRole.FRONTLINE_STAFF,
                          UserRole.CLINICAL_SPECIALIST])
        )

        if full_name:
            query = query.filter(User.full_name.ilike(f"%{full_name}%"))
        if user_id:
            query = query.filter(User.user_id == user_id)
        if nic:
            query = query.filter(User.nic == nic)
        if role:
            query = query.filter(User.role == role)

        staff = query.all()
        return [
            StaffResponse(
                id=str(s.id),
                user_id=s.user_id,
                full_name=s.full_name,
                nic=s.nic,
                telephone=s.telephone,
                email=s.email,
                birthday=s.birthday,
                role=s.role.value,
                specialization=s.specialization,
                is_active=s.is_active
            )
            for s in staff
        ]


class PatientService:
    """Service for patient management"""

    @staticmethod
    def create_patient(db: Session, patient_data: CreatePatientRequest) -> tuple:
        """Create a patient (generates user_id and temporary password)"""

        # Check if national_id already exists (if provided)
        if patient_data.national_id:
            existing_patient = db.query(Patient).filter(
                Patient.national_id == patient_data.national_id).first()
            if existing_patient:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Patient with this national ID already exists"
                )

        # Generate temporary password
        temp_password = generate_temporary_password()

        # Create user entry for patient
        new_user = User(
            # Auto-generated email
            email=f"patient_{secrets.token_hex(4)}@bloomcare.local",
            nic="PAT_" + secrets.token_hex(8),  # Placeholder NIC for patients
            telephone="",  # Will be updated if needed
            full_name=patient_data.full_name,
            birthday=patient_data.date_of_birth,
            hashed_password=get_password_hash(temp_password),
            role=UserRole.PATIENT,
            is_first_login=True
        )

        db.add(new_user)
        db.flush()  # Get the auto-generated user_id
        db.refresh(new_user)  # Refresh to load the auto-generated user_id

        # Create patient entry
        new_patient = Patient(
            user_id=new_user.user_id,
            national_id=patient_data.national_id,
            full_name=patient_data.full_name,
            age=patient_data.age,
            date_of_birth=patient_data.date_of_birth,
            due_date=patient_data.due_date,
            contact_number=patient_data.contact_number,
            emergency_contact=patient_data.emergency_contact,
            blood_group=patient_data.blood_group,
            hashed_password=get_password_hash(temp_password)
        )

        db.add(new_patient)
        db.commit()
        db.refresh(new_patient)

        return new_patient, temp_password

    @staticmethod
    def get_patients(
        db: Session,
        full_name: str = None,
        user_id: str = None
    ) -> list:
        """Retrieve patients with optional filters"""

        query = db.query(Patient)

        if full_name:
            query = query.filter(Patient.full_name.ilike(f"%{full_name}%"))
        if user_id:
            query = query.filter(Patient.user_id == user_id)

        patients = query.all()
        return [
            PatientManagementResponse(
                id=p.id,
                user_id=p.user_id,
                full_name=p.full_name,
                national_id=p.national_id,
                date_of_birth=p.date_of_birth,
                age=p.age,
                contact_number=p.contact_number,
                emergency_contact=p.emergency_contact,
                blood_group=p.blood_group,
            )
            for p in patients
        ]


class AuthService:
    """Service for authentication and password management"""

    @staticmethod
    def authenticate_user(db: Session, user_id: str, password: str):
        """Authenticate user by user_id and password"""

        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return user

    @staticmethod
    def change_password(db: Session, user_id: str, old_password: str, new_password: str) -> dict:
        """Change user password"""

        # Validate new password strength
        if not validate_password_strength(new_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters with uppercase, lowercase, digit, and special character"
            )

        # Find user
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Verify old password
        if not verify_password(old_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Current password is incorrect"
            )

        # Update password and set is_first_login to False
        user.hashed_password = get_password_hash(new_password)
        user.is_first_login = False
        db.commit()

        return {"message": "Password changed successfully"}
