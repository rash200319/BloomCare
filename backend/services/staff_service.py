"""Staff management service."""
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from backend.models.user import User, UserRole
from backend.core.security import get_password_hash
from backend.schemas.staff import CreateStaffRequest, StaffResponse, TemporaryPasswordResponse
from backend.services.password_helpers import generate_temporary_password


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
            User.role.in_([UserRole.FRONTLINE_STAFF.value,
                          UserRole.CLINICAL_SPECIALIST.value])
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
