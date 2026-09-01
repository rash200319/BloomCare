"""
Staff Management API Endpoints
Admin-only endpoints for creating and managing staff members
+ Staff profile management for authentication purposes
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from backend.core.deps import get_db, get_current_user, get_current_admin
from backend.models.user import User, UserRole
from backend.schemas.staff import CreateStaffRequest, TemporaryPasswordResponse, StaffResponse
from backend.schemas.user import UserUpdate, UserDetailResponse
from backend.services.staff_patient_service import StaffService

router = APIRouter()


@router.post(
    "/create-staff",
    response_model=TemporaryPasswordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Staff Member",
    description="Admin only. Create a new staff member (FRONTLINE_STAFF or CLINICAL_SPECIALIST).",
)
def create_staff(
    staff_data: CreateStaffRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """
    Create a new staff member account.

    - **full_name**: Staff member's full name
    - **email**: Email address (must be unique)
    - **phone_number**: Contact number (optional)
    - **role**: FRONTLINE_STAFF or CLINICAL_SPECIALIST
    - **specialization**: Medical specialization (required for CLINICAL_SPECIALIST)

    Returns:
    - **id**: User primary key
    - **is_first_login**: Always true for new staff accounts
    """
    return StaffService.create_staff(db, staff_data)


@router.get(
    "/staff",
    response_model=list[StaffResponse],
    summary="Get Staff Members",
    description="Admin only. Retrieve staff members with optional filters.",
)
def get_staff(
    full_name: str = Query(
        None, description="Filter by full name (partial match)"),
    id: str = Query(None, description="Filter by user primary key"),
    email: str = Query(None, description="Filter by email"),
    role: UserRole = Query(None, description="Filter by role"),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """
    Retrieve staff members with optional filters.

    Query Parameters:
    - **full_name**: Partial match on staff member's name
    - **id**: Exact match on user primary key
    - **email**: Exact match on email
    - **role**: Filter by role (FRONTLINE_STAFF, CLINICAL_SPECIALIST)
    """
    staff = StaffService.get_staff(db, full_name, id, email, role)

    if not staff and any([full_name, id, email, role]):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No staff members found matching the provided filters"
        )

    return staff


@router.get(
    "/by-name/{name}",
    response_model=list[StaffResponse],
    summary="Get Staff by Name",
    description="Admin only. Search staff members by name (partial match).",
)
def get_staff_by_name(
    name: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """
    Get staff member details by name.

    - **name**: Staff member's name (partial match, case-insensitive)

    Returns a list of matching staff members.
    """
    staff = StaffService.get_staff(db, full_name=name)
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No staff members found with name containing '{name}'"
        )
    return staff


@router.get(
    "/by-id/{id}",
    response_model=list[StaffResponse],
    summary="Get Staff by ID",
    description="Admin only. Get staff member details by user primary key.",
)
def get_staff_by_id(
    id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """
    Get staff member details by ID.

    - **id**: Staff member user primary key

    Returns the matching staff member if found.
    """
    staff = StaffService.get_staff(db, user_pk=id)
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Staff member with id '{id}' not found"
        )
    return staff


# ==================== AUTHENTICATED USER ENDPOINTS ====================
# These endpoints allow staff to manage their own profile information


@router.get(
    "/profile/me",
    response_model=UserDetailResponse,
    summary="Get Current User Details",
    description="Get the current authenticated user's details",
)
def get_current_user_details(
    current_user: User = Depends(get_current_user),
):
    """Get current user details"""
    return current_user


@router.patch(
    "/profile/me/update",
    response_model=UserDetailResponse,
    summary="Update Current User Details",
    description="Update current staff user contact number and full name. Other fields cannot be updated through this endpoint.",
)
def update_user_details(
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update user details (phone_number and full_name)
    
    - **phone_number**: Optional - Must be in +94XXXXXXXXX or 0XXXXXXXXX format
    - **full_name**: Optional - User's full name
    """
    print(f"[UPDATE-USER] Updating user {current_user.id}")
    
    # Update only the provided fields
    if user_update.full_name is not None:
        print(f"[UPDATE-USER] Setting full_name: {user_update.full_name}")
        current_user.full_name = user_update.full_name
    
    if user_update.phone_number is not None:
        print(f"[UPDATE-USER] Setting phone_number: {user_update.phone_number}")
        current_user.phone_number = user_update.phone_number
    
    try:
        db.commit()
        db.refresh(current_user)
        print(f"[UPDATE-USER] Successfully updated user {current_user.id}")
        return current_user
    except Exception as e:
        db.rollback()
        print(f"[UPDATE-USER-ERROR] Failed to update user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user details: {str(e)}"
        )


@router.get(
    "/profile/{user_id}",
    response_model=UserDetailResponse,
    summary="Get User Details by ID",
    description="Get user details by user ID. Admin and clinic staff users can view other users.",
)
def get_user_by_id(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get user details by ID"""
    print(f"[GET-USER] Fetching user {user_id}")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        print(f"[GET-USER] User {user_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    print(f"[GET-USER] Found user {user_id}")
    return user
