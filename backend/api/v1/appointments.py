from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ...core.deps import get_db, get_current_active_user
from ...schemas.appointment import Appointment, AppointmentCreate
from ...models.appointment import Appointment as DBAppointment
from ...models.user import User
import uuid

router = APIRouter()

@router.get("/", response_model=List[Appointment])
def read_appointments(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    # Basic RBAC logic check
    if current_user.role.value == "ADMIN" or current_user.role.value == "CLINICAL_SPECIALIST":
        appointments = db.query(DBAppointment).offset(skip).limit(limit).all()
    else:
        # Frontline might only see appointments for their assigned patients
        # Simplifying for demo
        appointments = db.query(DBAppointment).offset(skip).limit(limit).all()
    return appointments

@router.post("/", response_model=Appointment)
def create_appointment(
    *,
    db: Session = Depends(get_db),
    appointment_in: AppointmentCreate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    db_appointment = DBAppointment(
        id=str(uuid.uuid4()),
        patient_id=appointment_in.patient_id,
        specialist_id=appointment_in.specialist_id,
        appointment_date=appointment_in.appointment_date,
        status=appointment_in.status,
        notes=appointment_in.notes
    )
    db.add(db_appointment)
    db.commit()
    db.refresh(db_appointment)
    return db_appointment
