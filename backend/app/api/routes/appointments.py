"""
Appointment Routes
POST /api/v1/appointments         → Book appointment
GET  /api/v1/appointments         → List appointments
GET  /api/v1/appointments/{id}    → Get single
PUT  /api/v1/appointments/{id}    → Update / cancel
"""

from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user, require_any_staff
from app.models.models import User, Appointment, AppointmentStatus
from app.schemas.schemas import AppointmentCreate, AppointmentUpdate, AppointmentOut

router = APIRouter(prefix="/appointments", tags=["Appointments"])


@router.post("/", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def book_appointment(
    body: AppointmentCreate,
    current_user: Annotated[User, Depends(require_any_staff)],
    db: Annotated[Session, Depends(get_db)],
):
    appt = Appointment(**body.model_dump())
    db.add(appt)
    db.commit()
    db.refresh(appt)
    return appt


@router.get("/", response_model=List[AppointmentOut])
def list_appointments(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    patient_id: int | None = Query(None),
    appt_status: str | None = Query(None, alias="status"),
    skip: int = 0,
    limit: int = 50,
):
    query = db.query(Appointment)
    if patient_id:
        query = query.filter(Appointment.patient_id == patient_id)
    if appt_status:
        try:
            query = query.filter(Appointment.status == AppointmentStatus(appt_status.lower()))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid status.")
    return query.order_by(Appointment.appointment_date.asc()).offset(skip).limit(limit).all()


@router.get("/{appt_id}", response_model=AppointmentOut)
def get_appointment(
    appt_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    appt = db.query(Appointment).filter(Appointment.id == appt_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    return appt


@router.put("/{appt_id}", response_model=AppointmentOut)
def update_appointment(
    appt_id: int,
    body: AppointmentUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    appt = db.query(Appointment).filter(Appointment.id == appt_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    for field, value in body.model_dump(exclude_none=True).items():
        if field == "status":
            try:
                value = AppointmentStatus(value.lower())
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid status.")
        setattr(appt, field, value)

    db.commit()
    db.refresh(appt)
    return appt
