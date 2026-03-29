"""
Patient Routes
POST   /api/v1/patients                    → Create patient record
GET    /api/v1/patients                    → List all patients
GET    /api/v1/patients/{id}               → Get single patient
PUT    /api/v1/patients/{id}               → Update patient
POST   /api/v1/patients/{id}/vitals        → Submit vitals
GET    /api/v1/patients/{id}/vitals        → Get vitals history
GET    /api/v1/patients/{id}/risk-history  → Risk prediction history
GET    /api/v1/patients/escalated          → Get high-risk escalated patients
"""

from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user, require_any_staff, require_frontline
from app.models.models import User, Patient, Vitals, RiskRecord, RiskLevel
from app.schemas.schemas import (
    PatientCreate, PatientUpdate, PatientOut,
    VitalsCreate, VitalsOut, RiskRecordOut, MessageResponse
)

router = APIRouter(prefix="/patients", tags=["Patients"])


# ── Create Patient ─────────────────────────────────────────────────────────────
@router.post("/", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
def create_patient(
    body: PatientCreate,
    current_user: Annotated[User, Depends(require_any_staff)],
    db: Annotated[Session, Depends(get_db)],
):
    if db.query(Patient).filter(Patient.user_id == body.user_id).first():
        raise HTTPException(status_code=409, detail="Patient profile already exists for this user.")
    patient = Patient(**body.model_dump())
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


# ── List Patients ──────────────────────────────────────────────────────────────
@router.get("/", response_model=List[PatientOut])
def list_patients(
    current_user: Annotated[User, Depends(require_any_staff)],
    db: Annotated[Session, Depends(get_db)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    risk_level: str | None = Query(None, description="Filter by risk_level: low|moderate|high"),
):
    query = db.query(Patient)
    if risk_level:
        try:
            query = query.filter(Patient.current_risk_level == RiskLevel(risk_level.lower()))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid risk_level. Use: low|moderate|high")
    return query.offset(skip).limit(limit).all()


# ── Escalated Patients (High Risk — for Clinical Dashboard) ────────────────────
@router.get("/escalated", response_model=List[PatientOut])
def get_escalated_patients(
    current_user: Annotated[User, Depends(require_any_staff)],
    db: Annotated[Session, Depends(get_db)],
    skip: int = 0,
    limit: int = 50,
):
    return (
        db.query(Patient)
        .filter(Patient.current_risk_level == RiskLevel.high)
        .order_by(Patient.updated_at.desc())
        .offset(skip).limit(limit).all()
    )


# ── Get Single Patient ─────────────────────────────────────────────────────────
@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(
    patient_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    # Patients can only see their own record
    if current_user.role.value == "patient" and patient.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")

    return patient


# ── Update Patient ─────────────────────────────────────────────────────────────
@router.put("/{patient_id}", response_model=PatientOut)
def update_patient(
    patient_id: int,
    body: PatientUpdate,
    current_user: Annotated[User, Depends(require_any_staff)],
    db: Annotated[Session, Depends(get_db)],
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(patient, field, value)

    db.commit()
    db.refresh(patient)
    return patient


# ── Submit Vitals ──────────────────────────────────────────────────────────────
@router.post("/{patient_id}/vitals", response_model=VitalsOut, status_code=status.HTTP_201_CREATED)
def submit_vitals(
    patient_id: int,
    body: VitalsCreate,
    current_user: Annotated[User, Depends(require_frontline)],
    db: Annotated[Session, Depends(get_db)],
):
    if not db.query(Patient).filter(Patient.id == patient_id).first():
        raise HTTPException(status_code=404, detail="Patient not found.")

    vitals = Vitals(
        patient_id=patient_id,
        recorded_by_id=current_user.id,
        **{k: v for k, v in body.model_dump().items() if k != "patient_id"},
    )
    db.add(vitals)
    db.commit()
    db.refresh(vitals)
    return vitals


# ── Get Vitals History ─────────────────────────────────────────────────────────
@router.get("/{patient_id}/vitals", response_model=List[VitalsOut])
def get_vitals(
    patient_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    skip: int = 0,
    limit: int = 50,
):
    if not db.query(Patient).filter(Patient.id == patient_id).first():
        raise HTTPException(status_code=404, detail="Patient not found.")

    return (
        db.query(Vitals)
        .filter(Vitals.patient_id == patient_id)
        .order_by(Vitals.created_at.desc())
        .offset(skip).limit(limit).all()
    )


# ── Risk History ───────────────────────────────────────────────────────────────
@router.get("/{patient_id}/risk-history", response_model=List[RiskRecordOut])
def get_risk_history(
    patient_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    skip: int = 0,
    limit: int = 50,
):
    if not db.query(Patient).filter(Patient.id == patient_id).first():
        raise HTTPException(status_code=404, detail="Patient not found.")

    return (
        db.query(RiskRecord)
        .filter(RiskRecord.patient_id == patient_id)
        .order_by(RiskRecord.created_at.desc())
        .offset(skip).limit(limit).all()
    )
