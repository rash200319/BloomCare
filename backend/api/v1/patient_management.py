"""
Patient Management API Endpoints
Admin-only endpoints for creating and managing patients
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from backend.core.deps import get_db
from backend.schemas.patient import CreatePatientRequest, PatientManagementResponse
from backend.schemas.staff import TemporaryPasswordResponse
from backend.services.staff_patient_service import PatientService

router = APIRouter()


@router.post(
    "/create-patient",
    response_model=TemporaryPasswordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Patient",
    description="Create a new patient with auto-generated user_id and temporary password"
)
def create_patient(
    patient_data: CreatePatientRequest,
    db: Session = Depends(get_db)
):
    """
    Create a new patient with auto-generated PAT-XXXX user_id and temporary password.

    - **full_name**: Patient's full name
    - **national_id**: National ID (optional)
    - **date_of_birth**: Date of birth (optional)
    - **age**: Age in years (optional)
    - **contact_number**: Contact phone number (optional)
    - **emergency_contact**: Emergency contact phone (optional)
    - **blood_group**: Blood group type (optional)

    Returns:
    - **user_id**: Auto-generated patient ID (PAT-XXXX)
    - **temporary_password**: Initial password (patient must change on first login)
    - **full_name**: Patient's name
    - **email**: Auto-generated placeholder email
    - **role**: Always "PATIENT"
    """
    patient, temp_password = PatientService.create_patient(db, patient_data)

    return TemporaryPasswordResponse(
        user_id=patient.user_id,
        temporary_password=temp_password,
        full_name=patient.full_name,
        email=f"patient_{patient.user_id}@bloomcare.local",
        role="PATIENT"
    )


@router.get(
    "/patients",
    response_model=list[PatientManagementResponse],
    summary="Get Patients",
    description="Retrieve patients with optional filters"
)
def get_patients(
    full_name: str = Query(
        None, description="Filter by full name (partial match)"),
    user_id: str = Query(
        None, description="Filter by patient user ID (PAT-XXXX)"),
    db: Session = Depends(get_db)
):
    """
    Retrieve patients with optional filters.

    Query Parameters:
    - **full_name**: Partial match on patient's name
    - **user_id**: Exact match on patient user ID (PAT-XXXX)
    """
    patients = PatientService.get_patients(db, full_name, user_id)
    
    # If any filter is provided and no results found, return 404
    if not patients and any([full_name, user_id]):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No patients found matching the provided filters"
        )
    
    return patients


@router.get(
    "/by-name/{name}",
    response_model=list[PatientManagementResponse],
    summary="Get Patient by Name",
    description="Search patients by name (partial match)"
)
def get_patient_by_name(
    name: str,
    db: Session = Depends(get_db)
):
    """
    Get patient details by name.
    
    - **name**: Patient's name (partial match, case-insensitive)
    
    Returns a list of matching patients.
    """
    patients = PatientService.get_patients(db, full_name=name)
    if not patients:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No patients found with name containing '{name}'"
        )
    return patients


@router.get(
    "/by-id/{user_id}",
    response_model=list[PatientManagementResponse],
    summary="Get Patient by User ID",
    description="Get patient details by user ID"
)
def get_patient_by_user_id(
    user_id: str,
    db: Session = Depends(get_db)
):
    """
    Get patient details by user ID.
    
    - **user_id**: Patient's user ID (e.g., PAT-0001)
    
    Returns the matching patient if found.
    """
    patients = PatientService.get_patients(db, user_id=user_id)
    if not patients:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with user ID '{user_id}' not found"
        )
    return patients
