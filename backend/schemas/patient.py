import re
from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from uuid import UUID


NIC_PATTERN = re.compile(r"^(?:\d{9}[VvXx]|\d{12})$")
PHONE_PATTERN = re.compile(r"^(?:\+94\d{9}|0\d{9})$")
ALLOWED_BLOOD_GROUPS = {"A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"}


class PatientBase(BaseModel):
    national_id: Optional[str] = None
    full_name: str
    due_date: Optional[date] = None
    emergency_contact: Optional[str] = None
    blood_group: Optional[str] = None
    contact_number: Optional[str] = None
    age: Optional[int] = None


class PatientCreate(PatientBase):
    @field_validator("national_id")
    @classmethod
    def validate_national_id(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            return None
        if not NIC_PATTERN.match(normalized):
            raise ValueError("national_id must match Sri Lankan NIC format")
        return normalized.upper()

    @field_validator("contact_number", "emergency_contact")
    @classmethod
    def validate_phone(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().replace(" ", "")
        if not normalized:
            return None
        if not PHONE_PATTERN.match(normalized):
            raise ValueError(
                "phone number must be in +94XXXXXXXXX or 0XXXXXXXXX format")
        return normalized

    @field_validator("blood_group")
    @classmethod
    def validate_blood_group(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().upper()
        if not normalized:
            return None
        if normalized not in ALLOWED_BLOOD_GROUPS:
            raise ValueError(
                "blood_group must be one of A+, A-, B+, B-, AB+, AB-, O+, O-")
        return normalized

    @field_validator("age")
    @classmethod
    def validate_age(cls, value: Optional[int]) -> Optional[int]:
        if value is None:
            return None
        if value < 0 or value > 120:
            raise ValueError("age must be between 0 and 120")
        return value

    @model_validator(mode="after")
    def validate_age_alignment(self) -> "PatientBase":
        return self


class PatientUpdate(BaseModel):
    """Schema for partial updates to patient details"""
    full_name: Optional[str] = None
    contact_number: Optional[str] = None
    emergency_contact: Optional[str] = None
    age: Optional[int] = None
    due_date: Optional[date] = None
    blood_group: Optional[str] = None

    @field_validator("contact_number", "emergency_contact")
    @classmethod
    def validate_phone(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().replace(" ", "")
        if not normalized:
            return None
        if not PHONE_PATTERN.match(normalized):
            raise ValueError(
                "phone number must be in +94XXXXXXXXX or 0XXXXXXXXX format")
        return normalized

    @field_validator("blood_group")
    @classmethod
    def validate_blood_group(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().upper()
        if not normalized:
            return None
        if normalized not in ALLOWED_BLOOD_GROUPS:
            raise ValueError(
                "blood_group must be one of A+, A-, B+, B-, AB+, AB-, O+, O-")
        return normalized

    @field_validator("age")
    @classmethod
    def validate_age(cls, value: Optional[int]) -> Optional[int]:
        if value is None:
            return None
        if value < 0 or value > 120:
            raise ValueError("age must be between 0 and 120")
        return value


class PatientInDBBase(PatientBase):
    id: UUID
    registered_at: datetime
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
    specialist_id: Optional[str] = None
    stage1_screening_id: Optional[str] = None
    overall_severity_score: Optional[float] = None
    dominant_condition: Optional[str] = None
    biomarkers: Dict[str, Any] = {}
    condition_probabilities: Dict[str, Any] = {}
    explainability_data: Dict[str, Any] = {}
    input_snapshot: Dict[str, Any] = {}
    stage1: Stage1VitalsSnapshot


class PatientHistoryResponse(BaseModel):
    patient_id: str
    patient_name: Optional[str] = None
    diagnostics: List[Stage2WithStage1Context] = []


# ============== NEW SCHEMAS FOR STAFF & PATIENT MANAGEMENT ==============

class CreatePatientRequest(BaseModel):
    """Request schema for admin to create patients"""
    full_name: str
    national_id: str
    due_date: Optional[date] = None
    age: Optional[int] = None
    contact_number: Optional[str] = None
    emergency_contact: Optional[str] = None
    blood_group: Optional[str] = None


class PatientManagementResponse(BaseModel):
    """Response schema for patient in management context"""
    id: str
    full_name: str
    national_id: Optional[str]
    due_date: Optional[date]
    age: Optional[int]
    contact_number: Optional[str]
    emergency_contact: Optional[str]
    blood_group: Optional[str]

    model_config = {"from_attributes": True}


class PatientFilterRequest(BaseModel):
    """Request schema for filtering patients"""
    full_name: Optional[str] = None
    id: Optional[str] = None
