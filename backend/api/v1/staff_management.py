"""
Staff Management API Endpoints
Admin-only endpoints for creating and managing staff members
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from backend.core.deps import get_db
from backend.models.user import UserRole
from backend.schemas.staff import CreateStaffRequest, TemporaryPasswordResponse, StaffResponse
from backend.services.staff_patient_service import StaffService

router = APIRouter()


@router.post(
    "/create-staff",
    response_model=TemporaryPasswordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Staff Member",
    description="Create a new staff member (FRONTLINE_STAFF or CLINICAL_SPECIALIST). Returns temporary password."
)
def create_staff(
    staff_data: CreateStaffRequest,
    db: Session = Depends(get_db)
):
    """
    Create a new staff member with auto-generated user_id and temporary password.

    - **full_name**: Staff member's full name
    - **nic**: National Identity Card number
    - **telephone**: Contact telephone number
    - **birthday**: Date of birth (optional)
    - **email**: Email address (must be unique)
    - **role**: FRONTLINE_STAFF or CLINICAL_SPECIALIST
    - **specialization**: Medical specialization (required for CLINICAL_SPECIALIST)

    Returns:
    - **user_id**: Auto-generated ID (FLS-XXXX or DOC-XXXX)
    - **temporary_password**: Initial password (user must change on first login)
    """
    return StaffService.create_staff(db, staff_data)


@router.get(
    "/staff",
    response_model=list[StaffResponse],
    summary="Get Staff Members",
    description="Retrieve staff members with optional filters"
)
def get_staff(
    full_name: str = Query(
        None, description="Filter by full name (partial match)"),
    user_id: str = Query(None, description="Filter by user ID"),
    nic: str = Query(None, description="Filter by NIC"),
    role: UserRole = Query(None, description="Filter by role"),
    db: Session = Depends(get_db)
):
    """
    Retrieve staff members with optional filters.

    Query Parameters:
    - **full_name**: Partial match on staff member's name
    - **user_id**: Exact match on user ID (FLS-XXXX, DOC-XXXX)
    - **nic**: Exact match on NIC
    - **role**: Filter by role (FRONTLINE_STAFF, CLINICAL_SPECIALIST)
    """
    staff = StaffService.get_staff(db, full_name, user_id, nic, role)
    
    # If any filter is provided and no results found, return 404
    if not staff and any([full_name, user_id, nic, role]):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No staff members found matching the provided filters"
        )
    
    return staff


@router.get(
    "/by-name/{name}",
    response_model=list[StaffResponse],
    summary="Get Staff by Name",
    description="Search staff members by name (partial match)"
)
def get_staff_by_name(
    name: str,
    db: Session = Depends(get_db)
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
    "/by-id/{user_id}",
    response_model=list[StaffResponse],
    summary="Get Staff by User ID",
    description="Get staff member details by user ID"
)
def get_staff_by_user_id(
    user_id: str,
    db: Session = Depends(get_db)
):
    """
    Get staff member details by user ID.
    
    - **user_id**: Staff member's user ID (e.g., DOC-0001, FLS-0001)
    
    Returns the matching staff member if found.
    """
    staff = StaffService.get_staff(db, user_id=user_id)
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Staff member with user ID '{user_id}' not found"
        )
    return staff
