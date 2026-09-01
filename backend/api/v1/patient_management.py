"""
Patient Management API Endpoints
Clinic-staff endpoints for creating and managing patients
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from backend.core.deps import get_db, get_current_clinic_staff
from backend.models.user import User
from backend.schemas.patient import CreatePatientRequest, PatientManagementResponse
from backend.services.staff_patient_service import PatientService

router = APIRouter()


@router.post(
    "/create-patient",
    response_model=PatientManagementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Patient",
    description="Create a new patient account with first-login required (clinic staff only)",
)
def create_patient(
    patient_data: CreatePatientRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_clinic_staff),
):
    """
    Create a new patient.

    - **full_name**: Patient's full name
    - **national_id**: National ID (required)
    - **age**: Age in years (optional)
    - **contact_number**: Contact phone number (optional)
    - **emergency_contact**: Emergency contact phone (optional)
    - **blood_group**: Blood group type (optional)

    Returns patient management record with patient `id`.
    """
    return PatientService.create_patient(db, patient_data)


@router.get(
    "/patients",
    response_model=list[PatientManagementResponse],
    summary="Get Patients",
    description="Retrieve patients with optional filters (clinic staff only)",
)
def get_patients(
    full_name: str = Query(
        None, description="Filter by full name (partial match)"),
    id: str = Query(
        None, description="Filter by patient primary key"),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_clinic_staff),
):
    """
    Retrieve patients with optional filters.

    Query Parameters:
    - **full_name**: Partial match on patient's name
    - **id**: Exact match on patient primary key
    """
    patients = PatientService.get_patients(db, full_name, id)

    if not patients and any([full_name, id]):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No patients found matching the provided filters"
        )

    return patients


@router.get(
    "/by-name/{name}",
    response_model=list[PatientManagementResponse],
    summary="Get Patient by Name",
    description="Search patients by name (partial match) (clinic staff only)",
)
def get_patient_by_name(
    name: str,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_clinic_staff),
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
    "/by-id/{id}",
    response_model=list[PatientManagementResponse],
    summary="Get Patient by ID",
    description="Get patient details by patient primary key (clinic staff only)",
)
def get_patient_by_id(
    id: str,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_clinic_staff),
):
    """
    Get patient details by patient ID.

    - **id**: Patient primary key

    Returns the matching patient if found.
    """
    patients = PatientService.get_patients(db, patient_id=id)
    if not patients:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with id '{id}' not found"
        )
    return patients
