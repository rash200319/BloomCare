from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class ScreeningSubmissionRequest(BaseModel):
    patient_unique_id: Optional[str] = None
    phone: Optional[str] = None
    name: str
    age: int = Field(..., ge=10, le=60)
    contact: Optional[str] = None
    gestational_age_weeks: int = Field(default=20, ge=4, le=42)

    general_risk_flag: str = Field(..., pattern="^(High|Low)$")
    probability_score: float = Field(..., ge=0.0, le=1.0)
    triggers: List[Any] = Field(default_factory=list)

    # Stage 1 vitals and risk context persisted for longitudinal/clinical review.
    systolic: int = Field(..., ge=50, le=260)
    diastolic: int = Field(..., ge=30, le=180)
    bmi: float = Field(..., ge=10.0, le=80.0)
    heart_rate: int = Field(..., ge=20, le=240)
    blood_sugar: float = Field(..., ge=20.0, le=600.0)
    temperature: float = Field(..., ge=30.0, le=45.0)
    hemoglobin: float = Field(..., ge=2.0, le=25.0)
    pcos: int = Field(..., ge=0, le=1)
    previous_complications: int = Field(..., ge=0, le=1)
    preexisting_diabetes: int = Field(..., ge=0, le=1)
    mental_health: int = Field(..., ge=0, le=10)
    sleep_pattern: int = Field(..., ge=0, le=24)
    exercise: int = Field(..., ge=0, le=24)
    education: int = Field(..., ge=0, le=10)
    map: float = Field(..., ge=20.0, le=200.0)
    bp_status: str = Field(..., min_length=1)
    observation: str = Field(..., min_length=1)

    screened_at: Optional[datetime] = None


class SubmitScreeningResponse(BaseModel):
    patient_id: str
    stage1_screening_id: str
    patient_report_id: str
    report_id: str
    created_patient: bool
    general_risk_flag: str
    probability_score: float
    screened_at: datetime


class ScreeningHistoryItem(BaseModel):
    report_id: str
    screened_at: datetime
    general_risk_flag: str
    probability_score: float
    triggers: List[Any]


class TrendSummary(BaseModel):
    total_reports: int
    high_risk_reports: int
    high_risk_ratio: float
    average_probability: float
    latest_risk_flag: Optional[str] = None


class PatientHistoryResponse(BaseModel):
    patient_id: str
    patient_name: str
    age: Optional[int] = None
    contact: Optional[str] = None
    summary: TrendSummary
    reports: List[ScreeningHistoryItem]
