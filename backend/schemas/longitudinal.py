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
    systolic: Optional[int] = Field(default=None, ge=50, le=260)
    diastolic: Optional[int] = Field(default=None, ge=30, le=180)
    bmi: Optional[float] = Field(default=None, ge=10.0, le=80.0)
    heart_rate: Optional[int] = Field(default=None, ge=20, le=240)
    blood_sugar: Optional[float] = Field(default=None, ge=20.0, le=600.0)
    temperature: Optional[float] = Field(default=None, ge=30.0, le=45.0)
    hemoglobin: Optional[float] = Field(default=None, ge=2.0, le=25.0)
    pcos: Optional[int] = Field(default=None, ge=0, le=1)
    previous_complications: Optional[int] = Field(default=None, ge=0, le=1)
    preexisting_diabetes: Optional[int] = Field(default=None, ge=0, le=1)
    mental_health: Optional[int] = Field(default=None, ge=0, le=10)
    sleep_pattern: Optional[int] = Field(default=None, ge=0, le=24)
    exercise: Optional[int] = Field(default=None, ge=0, le=24)
    education: Optional[int] = Field(default=None, ge=0, le=10)
    map: Optional[float] = Field(default=None, ge=20.0, le=200.0)
    bp_status: Optional[str] = None
    observation: Optional[str] = None

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
