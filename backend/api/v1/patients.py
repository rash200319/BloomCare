from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.deps import get_db, get_current_active_user
from schemas.patient import Patient, PatientCreate
from models.patient import Patient as DBPatient
from models.user import User
import uuid

router = APIRouter()

@router.get("/", response_model=List[Patient])
def read_patients(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    if current_user.role.value == "ADMIN" or current_user.role.value == "CLINICAL_SPECIALIST":
        patients = db.query(DBPatient).offset(skip).limit(limit).all()
    else:
        patients = db.query(DBPatient).filter(DBPatient.assigned_worker_id == current_user.id).offset(skip).limit(limit).all()
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
