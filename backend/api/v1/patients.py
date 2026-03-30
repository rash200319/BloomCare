from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import String, cast
from sqlalchemy.orm import Session
from core.deps import get_db, get_current_active_user
from schemas.patient import (
    Patient,
    PatientCreate,
    PatientHistoryResponse,
    Stage2WithStage1Context,
    Stage1VitalsSnapshot,
)
from models.patient import Patient as DBPatient
from models.screening import Stage1Screening, Stage2Diagnostic
from models.user import User
import uuid

router = APIRouter()


def _role_name(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)

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
            .filter(cast(DBPatient.assigned_worker_id, String) == str(current_user.id))
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
    patient = db.query(DBPatient).filter(DBPatient.national_id == patient_in.national_id).first()
    if patient and patient_in.national_id:
        raise HTTPException(status_code=400, detail="Patient with this ID already exists")
    db_patient = DBPatient(
        id=str(uuid.uuid4()),
        national_id=patient_in.national_id,
        full_name=patient_in.full_name,
        date_of_birth=patient_in.date_of_birth,
        contact_number=patient_in.contact_number,
        assigned_worker_id=current_user.id
    )
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient


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

    # RBAC: admin/clinical specialist full access; frontline only assigned patients
    if _role_name(current_user) not in ["ADMIN", "CLINICAL_SPECIALIST"]:
        if str(getattr(patient, "assigned_worker_id", "")) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Not authorized to view this patient history")

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
            screening_id=getattr(stage1, "id", None),
            encounter_id=getattr(stage1, "encounter_id", None),
            collected_at=getattr(stage1, "collected_at", None),
            gestational_age_weeks=getattr(stage1, "gestational_age_weeks", None),
            systolic=getattr(stage1, "systolic", None),
            diastolic=getattr(stage1, "diastolic", None),
            bmi=float(stage1.bmi) if getattr(stage1, "bmi", None) is not None else None,
            heart_rate=getattr(stage1, "heart_rate", None),
            temperature=float(stage1.temperature) if getattr(stage1, "temperature", None) is not None else None,
            blood_sugar=float(stage1.Blood_sugar) if getattr(stage1, "Blood_sugar", None) is not None else None,
            hemoglobin=float(stage1.hemoglobin) if getattr(stage1, "hemoglobin", None) is not None else None,
            edge_risk_score=float(stage1.edge_risk_score) if getattr(stage1, "edge_risk_score", None) is not None else None,
            edge_risk_classification=(
                stage1.edge_risk_classification.value
                if getattr(stage1, "edge_risk_classification", None) is not None
                else None
            ),
            stage2_priority=getattr(stage1, "stage2_priority", None),
        )

        diagnostics.append(
            Stage2WithStage1Context(
                stage2_diagnostic_id=stage2.id,
                evaluated_at=stage2.evaluated_at,
                primary_disease_checked=stage2.primary_disease_checked,
                model_used=stage2.model_used,
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
                stage1=stage1_snapshot,
            )
        )

    return PatientHistoryResponse(
        patient_id=str(patient.id),
        patient_name=patient.full_name,
        diagnostics=diagnostics,
    )
