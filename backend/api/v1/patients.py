from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import String, cast
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
import secrets
import string
import logging
from backend.core.deps import get_db, get_current_active_user
from backend.core.security import get_password_hash
from backend.schemas.patient import (
    Patient,
    PatientCreate,
    PatientUpdate,
    PatientHistoryResponse,
    Stage2WithStage1Context,
    Stage1VitalsSnapshot,
)
from backend.models.patient import Patient as DBPatient
from backend.models.screening import Stage1Screening, Stage2Diagnostic
from backend.models.longitudinal import ScreeningReport
from backend.models.user import User
import uuid

router = APIRouter()
logger = logging.getLogger(__name__)


def _role_name(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def _as_str(value: Any) -> str:
    return str(value) if value is not None else ""


def _as_str_or_none(value: Any) -> str | None:
    return str(value) if value is not None else None


def _generate_internal_password(length: int = 16) -> str:
    characters = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(characters) for _ in range(length))


@router.get("/me/latest-screenings")
def get_my_latest_screenings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Return latest records from stage2_diagnostics, stage1_screenings, and
    screening_reports for the authenticated patient.
    """
    role = _role_name(current_user)
    if role != "PATIENT":
        raise HTTPException(status_code=403, detail="Only patients can access this endpoint")

    patient_id = str(current_user.id)
    patient = db.query(DBPatient).filter(cast(DBPatient.id, String) == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    latest_stage2 = (
        db.query(Stage2Diagnostic)
        .filter(cast(Stage2Diagnostic.patient_id, String) == patient_id)
        .order_by(Stage2Diagnostic.evaluated_at.desc())
        .first()
    )

    latest_stage1 = (
        db.query(Stage1Screening)
        .filter(cast(Stage1Screening.patient_id, String) == patient_id)
        .order_by(Stage1Screening.collected_at.desc(), Stage1Screening.updated_at.desc())
        .first()
    )

    latest_report = (
        db.query(ScreeningReport)
        .filter(cast(ScreeningReport.patient_id, String) == patient_id)
        .order_by(ScreeningReport.screened_at.desc())
        .first()
    )

    return {
        "patient_id": patient_id,
        "latest_stage2": (
            {
                "id": _as_str(latest_stage2.id),
                "evaluated_at": latest_stage2.evaluated_at,
                "primary_disease_checked": latest_stage2.primary_disease_checked,
                "dominant_condition": latest_stage2.dominant_condition,
                "overall_severity_score": (
                    float(latest_stage2.overall_severity_score)
                    if latest_stage2.overall_severity_score is not None
                    else None
                ),
                "explainability_data": latest_stage2.explainability_data or {},
                "condition_probabilities": latest_stage2.condition_probabilities or {},
                "stage1_screening_id": _as_str_or_none(latest_stage2.stage1_screening_id),
            }
            if latest_stage2
            else None
        ),
        "latest_stage1": (
            {
                "id": _as_str(latest_stage1.id),
                "collected_at": latest_stage1.collected_at,
                "systolic": latest_stage1.systolic,
                "diastolic": latest_stage1.diastolic,
                "bmi": float(latest_stage1.bmi) if latest_stage1.bmi is not None else None,
                "heart_rate": latest_stage1.heart_rate,
                "temperature": float(latest_stage1.temperature) if latest_stage1.temperature is not None else None,
                "blood_sugar": float(latest_stage1.Blood_sugar) if latest_stage1.Blood_sugar is not None else None,
                "hemoglobin": float(latest_stage1.hemoglobin) if latest_stage1.hemoglobin is not None else None,
                "edge_risk_score": float(latest_stage1.edge_risk_score) if latest_stage1.edge_risk_score is not None else None,
                "contributing_factors": latest_stage1.contributing_factors or {},
            }
            if latest_stage1
            else None
        ),
        "latest_screening_report": (
            {
                "id": _as_str(latest_report.id),
                "screened_at": latest_report.screened_at,
                "general_risk_flag": latest_report.general_risk_flag,
                "probability_score": float(latest_report.probability_score),
                "triggers": latest_report.triggers or [],
            }
            if latest_report
            else None
        ),
    }

@router.get("/", response_model=List[Patient])
def read_patients(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    role = _role_name(current_user)
    if role == "ADMIN" or role == "CLINICAL_SPECIALIST":
        patients = db.query(DBPatient).offset(skip).limit(limit).all()
    else:
        patients = (
            db.query(DBPatient)
            .filter(DBPatient.assigned_worker_id == str(current_user.id))
            .offset(skip)
            .limit(limit)
            .all()
        )
    return patients


@router.post("/", response_model=Patient)
def create_patient(
    *,
    db: Session = Depends(get_db),
    patient_in: PatientCreate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    normalized_nic = patient_in.national_id.strip().upper() if patient_in.national_id else None
    patient = None
    if normalized_nic:
        patient = db.query(DBPatient).filter(DBPatient.national_id == normalized_nic).first()

    default_hashed_password = get_password_hash(_generate_internal_password())

    if patient and normalized_nic:
        patient.full_name = patient_in.full_name
        patient.age = patient_in.age
        patient.due_date = patient_in.due_date
        patient.contact_number = patient_in.contact_number
        patient.emergency_contact = patient_in.emergency_contact
        patient.blood_group = patient_in.blood_group
        if not patient.hashed_password:
            patient.hashed_password = default_hashed_password
            patient.first_time_login = True
        if not patient.assigned_worker_id:
            patient.assigned_worker_id = current_user.id
        db.commit()
        db.refresh(patient)
        return patient

    db_patient = DBPatient(
        id=str(uuid.uuid4()),
        national_id=normalized_nic,
        full_name=patient_in.full_name,
        age=patient_in.age,
        due_date=patient_in.due_date,
        contact_number=patient_in.contact_number,
        hashed_password=default_hashed_password,
        emergency_contact=patient_in.emergency_contact,
        blood_group=patient_in.blood_group,
        first_time_login=True,
        assigned_worker_id=current_user.id
    )
    db.add(db_patient)
    try:
        db.commit()
        db.refresh(db_patient)
        return db_patient
    except IntegrityError as exc:
        db.rollback()

        if normalized_nic:
            existing = db.query(DBPatient).filter(DBPatient.national_id == normalized_nic).first()
            if existing:
                existing.full_name = patient_in.full_name
                existing.age = patient_in.age
                existing.due_date = patient_in.due_date
                existing.contact_number = patient_in.contact_number
                existing.emergency_contact = patient_in.emergency_contact
                existing.blood_group = patient_in.blood_group
                if not existing.assigned_worker_id:
                    existing.assigned_worker_id = current_user.id
                if not existing.hashed_password:
                    existing.hashed_password = default_hashed_password
                    existing.first_time_login = True
                db.commit()
                db.refresh(existing)
                logger.info("create_patient deduplicated by national_id=%s", normalized_nic)
                return existing

        logger.exception("create_patient failed")
        raise HTTPException(status_code=500, detail="Unable to create patient") from exc


@router.get("/{patient_id}/history", response_model=PatientHistoryResponse)
def get_patient_history(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Return Stage-2 diagnostics joined with Stage-1 vitals so doctors can view
    original screening context (BP, BMI, etc.) alongside advanced biomarkers.
    """
    patient = db.query(DBPatient).filter(DBPatient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # RBAC:
    # - ADMIN / CLINICAL_SPECIALIST: full access
    # - PATIENT: only own history
    # - Others (e.g. frontline staff): only assigned patients
    current_role = _role_name(current_user)
    if current_role not in ["ADMIN", "CLINICAL_SPECIALIST"]:
        is_patient_self = current_role == "PATIENT" and str(current_user.id) == str(patient_id)
        is_assigned_staff = str(getattr(patient, "assigned_worker_id", "")) == str(current_user.id)

        if not (is_patient_self or is_assigned_staff):
            raise HTTPException(
                status_code=403, detail="Not authorized to view this patient history")

    # JOIN Stage-2 with Stage-1 via stage1_screening_id, keeping stage2 rows even if stage1 is missing.
    rows = (
        db.query(Stage2Diagnostic, Stage1Screening)
        .outerjoin(
            Stage1Screening,
            Stage2Diagnostic.stage1_screening_id == Stage1Screening.id,
        )
        .filter(cast(Stage2Diagnostic.patient_id, String) == str(patient_id))
        .order_by(Stage2Diagnostic.evaluated_at.desc())
        .all()
    )

    diagnostics: List[Stage2WithStage1Context] = []
    for stage2, stage1 in rows:
        stage1_snapshot = Stage1VitalsSnapshot(
            screening_id=_as_str_or_none(getattr(stage1, "id", None)),
            encounter_id=getattr(stage1, "encounter_id", None),
            collected_at=getattr(stage1, "collected_at", None),
            gestational_age_weeks=getattr(
                stage1, "gestational_age_weeks", None),
            systolic=getattr(stage1, "systolic", None),
            diastolic=getattr(stage1, "diastolic", None),
            bmi=float(stage1.bmi) if getattr(
                stage1, "bmi", None) is not None else None,
            heart_rate=getattr(stage1, "heart_rate", None),
            temperature=float(stage1.temperature) if getattr(
                stage1, "temperature", None) is not None else None,
            blood_sugar=float(stage1.Blood_sugar) if getattr(
                stage1, "Blood_sugar", None) is not None else None,
            hemoglobin=float(stage1.hemoglobin) if getattr(
                stage1, "hemoglobin", None) is not None else None,
            edge_risk_score=float(stage1.edge_risk_score) if getattr(
                stage1, "edge_risk_score", None) is not None else None,
            edge_risk_classification=(
                stage1.edge_risk_classification.value
                if getattr(stage1, "edge_risk_classification", None) is not None
                else None
            ),
            stage2_priority=getattr(stage1, "stage2_priority", None),
        )

        diagnostics.append(
            Stage2WithStage1Context(
                stage2_diagnostic_id=_as_str(stage2.id),
                evaluated_at=stage2.evaluated_at,
                primary_disease_checked=stage2.primary_disease_checked,
                model_used=stage2.model_used,
                specialist_id=_as_str_or_none(stage2.specialist_id),
                stage1_screening_id=_as_str_or_none(stage2.stage1_screening_id),
                overall_severity_score=(
                    float(stage2.overall_severity_score)
                    if stage2.overall_severity_score is not None
                    else None
                ),
                dominant_condition=stage2.dominant_condition,
                biomarkers={
                    "sflt1_plgf_ratio": float(stage2.sflt1_plgf_ratio) if stage2.sflt1_plgf_ratio is not None else None,
                    "plgf_absolute": float(stage2.plgf_absolute) if stage2.plgf_absolute is not None else None,
                    "papp_a": float(stage2.papp_a) if stage2.papp_a is not None else None,
                    "cervical_length_mm": float(stage2.cervical_length_mm) if stage2.cervical_length_mm is not None else None,
                    "metabolomics": stage2.metabolomics,
                    "doppler": stage2.doppler,
                },
                condition_probabilities=stage2.condition_probabilities or {},
                explainability_data=stage2.explainability_data or {},
                input_snapshot=stage2.input_snapshot or {},
                stage1=stage1_snapshot,
            )
        )

    return PatientHistoryResponse(
        patient_id=str(patient.id),
        patient_name=patient.full_name,
        diagnostics=diagnostics,
    )


@router.get(
    "/me/profile",
    response_model=Patient,
    summary="Get Current Patient Profile",
    description="Get the current authenticated patient's profile information",
)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get current patient's profile"""
    role = _role_name(current_user)
    if role != "PATIENT":
        raise HTTPException(status_code=403, detail="Only patients can access this endpoint")

    patient = db.query(DBPatient).filter(cast(DBPatient.id, String) == str(current_user.id)).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    return patient


@router.patch(
    "/me/update",
    response_model=Patient,
    summary="Update Patient Profile",
    description="Update patient contact number and other details",
)
def update_my_profile(
    patient_update: PatientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Update patient profile details.
    
    - **contact_number**: Optional - Phone number in +94XXXXXXXXX or 0XXXXXXXXX format
    - **emergency_contact**: Optional - Emergency contact number
    - **full_name**: Optional - Patient's full name
    - **age**: Optional - Patient's age (0-120)
    - **due_date**: Optional - Expected due date
    - **blood_group**: Optional - One of A+, A-, B+, B-, AB+, AB-, O+, O-
    """
    role = _role_name(current_user)
    if role != "PATIENT":
        raise HTTPException(status_code=403, detail="Only patients can update their profile")

    patient = db.query(DBPatient).filter(cast(DBPatient.id, String) == str(current_user.id)).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    print(f"[UPDATE-PATIENT] Updating patient {patient.id}")

    # Update only the provided fields
    update_data = patient_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            print(f"[UPDATE-PATIENT] Setting {field}: {value}")
            setattr(patient, field, value)

    try:
        db.commit()
        db.refresh(patient)
        print(f"[UPDATE-PATIENT] Successfully updated patient {patient.id}")
        return patient
    except Exception as e:
        db.rollback()
        print(f"[UPDATE-PATIENT-ERROR] Failed to update patient: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update patient profile: {str(e)}"
        )


@router.get(
    "/{patient_id}/details",
    response_model=Patient,
    summary="Get Patient Details",
    description="Get patient details by ID. Staff can view assigned patients, admin can view any patient.",
)
def get_patient_details(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get patient details by ID"""
    print(f"[GET-PATIENT] Fetching patient {patient_id}")

    patient = db.query(DBPatient).filter(cast(DBPatient.id, String) == patient_id).first()
    if not patient:
        print(f"[GET-PATIENT] Patient {patient_id} not found")
        raise HTTPException(status_code=404, detail="Patient not found")

    # Access control
    current_role = _role_name(current_user)
    if current_role not in ["ADMIN", "CLINICAL_SPECIALIST"]:
        is_patient_self = current_role == "PATIENT" and str(current_user.id) == str(patient_id)
        is_assigned_staff = str(getattr(patient, "assigned_worker_id", "")) == str(current_user.id)

        if not (is_patient_self or is_assigned_staff):
            raise HTTPException(status_code=403, detail="Not authorized to view this patient")

    print(f"[GET-PATIENT] Found patient {patient_id}")
    return patient


@router.patch(
    "/{patient_id}/update",
    response_model=Patient,
    summary="Update Patient Details (Admin/Staff)",
    description="Update patient details by ID. Only admin and assigned staff can update.",
)
def update_patient_details(
    patient_id: str,
    patient_update: PatientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Update patient details by ID (admin or assigned staff only).
    
    - **contact_number**: Optional - Phone number in +94XXXXXXXXX or 0XXXXXXXXX format
    - **emergency_contact**: Optional - Emergency contact number
    - **full_name**: Optional - Patient's full name
    - **age**: Optional - Patient's age (0-120)
    - **due_date**: Optional - Expected due date
    - **blood_group**: Optional - One of A+, A-, B+, B-, AB+, AB-, O+, O-
    """
    print(f"[UPDATE-PATIENT] Admin/Staff updating patient {patient_id}")

    patient = db.query(DBPatient).filter(cast(DBPatient.id, String) == patient_id).first()
    if not patient:
        print(f"[UPDATE-PATIENT] Patient {patient_id} not found")
        raise HTTPException(status_code=404, detail="Patient not found")

    # Access control
    current_role = _role_name(current_user)
    if current_role not in ["ADMIN", "CLINICAL_SPECIALIST"]:
        is_assigned_staff = str(getattr(patient, "assigned_worker_id", "")) == str(current_user.id)
        if not is_assigned_staff:
            raise HTTPException(status_code=403, detail="Not authorized to update this patient")

    # Update only the provided fields
    update_data = patient_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            print(f"[UPDATE-PATIENT] Setting {field}: {value}")
            setattr(patient, field, value)

    try:
        db.commit()
        db.refresh(patient)
        print(f"[UPDATE-PATIENT] Successfully updated patient {patient_id}")
        return patient
    except Exception as e:
        db.rollback()
        print(f"[UPDATE-PATIENT-ERROR] Failed to update patient: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update patient details: {str(e)}"
        )
