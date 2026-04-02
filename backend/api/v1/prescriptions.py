from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import cast, String
from sqlalchemy.orm import Session

from backend.core.deps import get_db, get_current_active_user
from backend.models.user import User
from backend.models.patient import Patient
from backend.models.prescription import Prescription
from backend.schemas.prescription import PrescriptionCreate, PrescriptionResponse

router = APIRouter()


def _role_name(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def _serialize_prescription(
    row: Prescription,
    doctor_full_name: str | None = None,
    doctor_specialization: str | None = None,
) -> PrescriptionResponse:
    return PrescriptionResponse(
        id=str(row.id),
        patient_id=str(row.patient_id),
        specialist_id=str(row.specialist_id) if row.specialist_id is not None else None,
        doctor_full_name=doctor_full_name,
        doctor_specialization=doctor_specialization,
        stage2_diagnostic_id=str(row.stage2_diagnostic_id) if row.stage2_diagnostic_id is not None else None,
        medication_name=row.medication_name,
        dosage=row.dosage,
        frequency=row.frequency,
        route=row.route,
        instructions=row.instructions,
        start_date=row.start_date,
        end_date=row.end_date,
        is_active=bool(row.is_active),
        created_at=row.created_at,
    )


@router.get("/patient/{patient_id}", response_model=List[PrescriptionResponse])
def list_patient_prescriptions(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    role = _role_name(current_user)

    if role == "PATIENT" and str(current_user.id) != str(patient.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    if role == "FRONTLINE_STAFF" and str(getattr(patient, "assigned_worker_id", "")) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    rows = (
        db.query(Prescription)
        .filter(cast(Prescription.patient_id, String) == str(patient_id))
        .order_by(Prescription.created_at.desc())
        .all()
    )
    specialist_ids = {
        str(row.specialist_id)
        for row in rows
        if row.specialist_id is not None
    }
    specialist_profiles_by_id = {
        str(user.id): {
            "full_name": user.full_name,
            "specialization": user.specialization,
        }
        for user in db.query(User).filter(cast(User.id, String).in_(specialist_ids)).all()
    } if specialist_ids else {}

    return [
        _serialize_prescription(
            row,
            specialist_profiles_by_id.get(str(row.specialist_id), {}).get("full_name"),
            specialist_profiles_by_id.get(str(row.specialist_id), {}).get("specialization"),
        )
        for row in rows
    ]


@router.post("/", response_model=PrescriptionResponse, status_code=201)
def create_prescription(
    payload: PrescriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    role = _role_name(current_user)
    if role not in ["CLINICAL_SPECIALIST", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only clinical specialists or admins can issue prescriptions",
        )

    patient = db.query(Patient).filter(Patient.id == payload.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    row = Prescription(
        patient_id=payload.patient_id,
        specialist_id=str(current_user.id),
        stage2_diagnostic_id=payload.stage2_diagnostic_id,
        medication_name=payload.medication_name,
        dosage=payload.dosage,
        frequency=payload.frequency,
        route=payload.route,
        instructions=payload.instructions,
        start_date=payload.start_date,
        end_date=payload.end_date,
        is_active=payload.is_active,
    )

    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_prescription(row, current_user.full_name, current_user.specialization)
