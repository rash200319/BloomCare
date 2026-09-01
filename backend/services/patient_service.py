"""Patient management service (clinic staff)."""
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from backend.models.patient import Patient
from backend.core.security import get_password_hash
from backend.schemas.patient import CreatePatientRequest, PatientManagementResponse
from backend.services.password_helpers import generate_temporary_password


class PatientService:
    """Service for patient management."""

    @staticmethod
    def create_patient(db: Session, patient_data: CreatePatientRequest) -> PatientManagementResponse:
        """Create a patient account in patients table."""
        existing_patient = db.query(Patient).filter(
            Patient.national_id == patient_data.national_id
        ).first()
        if existing_patient:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Patient with this national ID already exists",
            )

        placeholder_password = generate_temporary_password()

        new_patient = Patient(
            national_id=patient_data.national_id,
            full_name=patient_data.full_name,
            age=patient_data.age,
            due_date=patient_data.due_date,
            contact_number=patient_data.contact_number,
            hashed_password=get_password_hash(placeholder_password),
            emergency_contact=patient_data.emergency_contact,
            blood_group=patient_data.blood_group,
            first_time_login=True,
        )

        db.add(new_patient)
        db.commit()
        db.refresh(new_patient)

        return PatientManagementResponse(
            id=str(new_patient.id),
            full_name=new_patient.full_name,
            national_id=new_patient.national_id,
            due_date=new_patient.due_date,
            age=new_patient.age,
            contact_number=new_patient.contact_number,
            emergency_contact=new_patient.emergency_contact,
            blood_group=new_patient.blood_group,
        )

    @staticmethod
    def get_patients(db: Session, full_name: str = None, patient_id: str = None) -> list[PatientManagementResponse]:
        """Retrieve patients with optional filters."""
        query = db.query(Patient)

        if full_name:
            query = query.filter(Patient.full_name.ilike(f"%{full_name}%"))
        if patient_id:
            query = query.filter(Patient.id == patient_id)

        patients = query.all()
        return [
            PatientManagementResponse(
                id=str(p.id),
                full_name=p.full_name,
                national_id=p.national_id,
                due_date=p.due_date,
                age=p.age,
                contact_number=p.contact_number,
                emergency_contact=p.emergency_contact,
                blood_group=p.blood_group,
            )
            for p in patients
        ]
