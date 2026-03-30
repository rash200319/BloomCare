from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from uuid import UUID

class PatientBase(BaseModel):
    national_id: Optional[UUID] = None
    full_name: str
    date_of_birth: Optional[date] = None
    contact_number: Optional[str] = None

class PatientCreate(PatientBase):
    pass

class PatientUpdate(PatientBase):
    pass

class PatientInDBBase(PatientBase):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

class Patient(PatientInDBBase):
    pass


class Stage1VitalsSnapshot(BaseModel):
    screening_id: Optional[str] = None
    encounter_id: Optional[str] = None
    collected_at: Optional[datetime] = None
    gestational_age_weeks: Optional[int] = None
    systolic: Optional[int] = None
    diastolic: Optional[int] = None
    bmi: Optional[float] = None
    heart_rate: Optional[int] = None
    temperature: Optional[float] = None
    blood_sugar: Optional[float] = None
    hemoglobin: Optional[float] = None
    edge_risk_score: Optional[float] = None
    edge_risk_classification: Optional[str] = None
    stage2_priority: Optional[Dict[str, Any]] = None


class Stage2WithStage1Context(BaseModel):
    stage2_diagnostic_id: str
    evaluated_at: datetime
    primary_disease_checked: Optional[str] = None
    model_used: Optional[str] = None
    overall_severity_score: Optional[float] = None
    dominant_condition: Optional[str] = None
    biomarkers: Dict[str, Any] = {}
    stage1: Stage1VitalsSnapshot


class PatientHistoryResponse(BaseModel):
    patient_id: str
    patient_name: Optional[str] = None
    diagnostics: List[Stage2WithStage1Context] = []
