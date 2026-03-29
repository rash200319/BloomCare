"""
BloomCare – Pydantic Schemas
All request / response models for the API.
"""

from datetime import datetime, date
from typing import Optional, List, Any
from pydantic import BaseModel, Field, field_validator
import re


# ── Shared Utilities ──────────────────────────────────────────────────────────
class OrmBase(BaseModel):
    model_config = {"from_attributes": True}


# ── Auth / Registration ───────────────────────────────────────────────────────
class UserRegister(BaseModel):
    """
    Fields a new user must submit when creating an account.
    """
    username:   str = Field(..., min_length=3, max_length=64, examples=["kamala.nurse"])
    password:   str = Field(..., min_length=8, examples=["Str0ngPass!"])
    full_name:  str = Field(..., min_length=2, max_length=200, examples=["Kamala Perera"])
    birthday:   date = Field(..., examples=["1990-05-15"])
    address:    str = Field(..., min_length=5, examples=["123 Galle Road, Colombo 03"])
    telephone:  str = Field(..., examples=["0771234567"])
    nic_number: str = Field(..., examples=["901234567V"])
    role: str = Field(
        ...,
        examples=["patient"],
        description="One of: admin | doctor | frontline | patient",
    )

    @field_validator("telephone")
    @classmethod
    def validate_telephone(cls, v: str) -> str:
        digits = re.sub(r"\D", "", v)
        if len(digits) < 9 or len(digits) > 15:
            raise ValueError("Telephone must have 9–15 digits.")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        allowed = {"admin", "doctor", "frontline", "patient"}
        if v.lower() not in allowed:
            raise ValueError(f"Role must be one of: {', '.join(allowed)}")
        return v.lower()


class UserLogin(BaseModel):
    username: str = Field(..., examples=["kamala.nurse"])
    password: str = Field(..., examples=["Str0ngPass!"])


class TokenResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserPublic(OrmBase):
    """Safe user info returned after registration/login — no password exposed."""
    id:         int
    user_id:    str
    username:   str
    full_name:  str
    birthday:   date
    address:    str
    telephone:  str
    nic_number: str
    role:       str
    is_active:  bool
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None


class LoginResponse(BaseModel):
    user:          UserPublic
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"


class RegisterResponse(BaseModel):
    message:       str
    user_id:       str   # e.g. "PAT-0042"
    username:      str
    role:          str
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"


# ── Vitals ────────────────────────────────────────────────────────────────────
class VitalsCreate(BaseModel):
    patient_id:             int
    age:                    Optional[float] = None
    bmi:                    Optional[float] = None
    systolic:               Optional[float] = None
    diastolic:              Optional[float] = None
    heart_rate:             Optional[float] = None
    blood_sugar:            Optional[float] = None
    body_temperature:       Optional[float] = None
    hemoglobin:             Optional[float] = None
    pcos:                   Optional[int] = None
    previous_complications: Optional[int] = None
    preexisting_diabetes:   Optional[int] = None
    mental_health:          Optional[int] = None
    sleep_pattern:          Optional[int] = None
    exercise:               Optional[int] = None
    education:              Optional[int] = None
    synced_from_offline:    bool = False
    offline_id:             Optional[str] = None


class VitalsOut(OrmBase):
    id:                     int
    patient_id:             int
    age:                    Optional[float]
    bmi:                    Optional[float]
    systolic:               Optional[float]
    diastolic:              Optional[float]
    heart_rate:             Optional[float]
    blood_sugar:            Optional[float]
    body_temperature:       Optional[float]
    hemoglobin:             Optional[float]
    pcos:                   Optional[int]
    previous_complications: Optional[int]
    preexisting_diabetes:   Optional[int]
    mental_health:          Optional[int]
    sleep_pattern:          Optional[int]
    exercise:               Optional[int]
    education:              Optional[int]
    synced_from_offline:    bool
    created_at:             datetime
    updated_at:             datetime


# ── Patient ───────────────────────────────────────────────────────────────────
class PatientCreate(BaseModel):
    user_id:            int
    blood_group:        Optional[str] = None
    gestational_week:   Optional[int] = None
    due_date:           Optional[date] = None
    pregnancy_status:   Optional[str] = None
    assigned_doctor_id: Optional[int] = None


class PatientUpdate(BaseModel):
    blood_group:        Optional[str] = None
    gestational_week:   Optional[int] = None
    due_date:           Optional[date] = None
    pregnancy_status:   Optional[str] = None
    current_risk_level: Optional[str] = None
    assigned_doctor_id: Optional[int] = None


class PatientOut(OrmBase):
    id:                 int
    blood_group:        Optional[str]
    gestational_week:   Optional[int]
    due_date:           Optional[date]
    pregnancy_status:   Optional[str]
    current_risk_level: Optional[str]
    created_at:         datetime
    updated_at:         datetime
    user:               Optional[UserPublic] = None


# ── Stage 1 Prediction ────────────────────────────────────────────────────────
class Stage1Input(BaseModel):
    """Matches the frontend VitalsInput interface in frontline-triage-dashboard.tsx"""
    patient_name:           str     = Field(..., examples=["Nimalka Fernando"])
    age:                    float   = Field(..., ge=10, le=65)
    bmi:                    float   = Field(..., ge=10, le=60)
    systolic:               float   = Field(..., ge=50, le=250)
    diastolic:              float   = Field(..., ge=30, le=160)
    heart_rate:             float   = Field(..., ge=30, le=200)
    bs:                     float   = Field(..., ge=40, le=400, description="Blood sugar mg/dL")
    temperature:            float   = Field(..., ge=34, le=42, description="Body temperature °C")
    hemoglobin:             float   = Field(..., ge=4, le=20)
    pcos:                   int     = Field(0, ge=0, le=1)
    previous_complications: int     = Field(0, ge=0, le=1)
    preexisting_diabetes:   int     = Field(0, ge=0, le=1)
    mental_health:          int     = Field(3, ge=1, le=10)
    sleep_pattern:          int     = Field(7, ge=0, le=12)
    exercise:               int     = Field(3, ge=0, le=7)
    education:              int     = Field(4, ge=0, le=5)

    # Optional: computed by frontend but also accepted
    map: Optional[float] = None

    def computed_map(self) -> float:
        if self.map is not None:
            return self.map
        return (self.systolic + 2 * self.diastolic) / 3


class GeneralRiskResult(BaseModel):
    probability: float
    risk:        str   # "High" | "Low"
    threshold:   float


class Stage1Response(BaseModel):
    general_risk: GeneralRiskResult


# ── Stage 2 Predictions ───────────────────────────────────────────────────────
class Stage2PreeclampsiaInput(BaseModel):
    age:         float
    gest_age:    float = Field(..., description="Gestational age in weeks")
    height:      float
    weight:      float
    bmi:         float
    sysbp:       float
    diabp:       float
    hb:          float
    pcv:         float
    tsh:         float
    platelet:    float
    creatinine:  float
    plgfsflt:    float = Field(..., description="sFlt-1/PlGF ratio")
    seng:        float
    cysc:        float
    pp_13:       float
    glycerides:  float
    htn:         int   = Field(0, ge=0, le=1)
    diabetes:    int   = Field(0, ge=0, le=1)
    fam_htn:     int   = Field(0, ge=0, le=1)
    sp_art:      int   = Field(0, ge=0, le=1)
    occupation:  int   = Field(1, ge=0, le=5)
    diet:        int   = Field(2, ge=0, le=5)
    activity:    int   = Field(2, ge=0, le=5)
    sleep:       int   = Field(7, ge=0, le=12)


class Stage2GDMInput(BaseModel):
    age:           float
    no_of_pregnancy: float
    bmi:           float
    hdl:           float
    sys_bp:        float
    dia_bp:        float
    ogtt:          float
    hemoglobin:    float


class Stage2PretermInput(BaseModel):
    age_of_mother:  float
    bmi:            float
    hemoglobin:     float
    pcos:           int = Field(0, ge=0, le=1)
    miscarriage_history: int = Field(0, ge=0, le=1)
    exercise:       int = Field(3, ge=0, le=7)
    outside_food:   int = Field(2, ge=0, le=5)
    pollution:      int = Field(2, ge=0, le=5)
    sleep_pattern:  int = Field(7, ge=0, le=12)
    stress:         int = Field(3, ge=0, le=10)
    family_support: int = Field(3, ge=0, le=5)
    work_hours:     int = Field(8, ge=0, le=18)


class Stage2Response(BaseModel):
    condition:   str
    probability: float
    risk:        str        # "High" | "Low"
    threshold:   float
    is_mock:     bool = False


# ── Risk Records ──────────────────────────────────────────────────────────────
class RiskRecordOut(OrmBase):
    id:              int
    patient_id:      int
    stage:           str
    condition:       Optional[str]
    probability:     float
    risk_level:      str
    recommendations: Optional[List[str]]
    is_mock:         bool
    model_version:   Optional[str]
    created_at:      datetime


# ── Appointments ──────────────────────────────────────────────────────────────
class AppointmentCreate(BaseModel):
    patient_id:       int
    doctor_id:        Optional[int] = None
    appointment_type: str
    appointment_date: date
    appointment_time: str = Field(..., examples=["10:30"])
    location:         Optional[str] = None
    notes:            Optional[str] = None


class AppointmentUpdate(BaseModel):
    appointment_type: Optional[str] = None
    appointment_date: Optional[date] = None
    appointment_time: Optional[str] = None
    location:         Optional[str] = None
    notes:            Optional[str] = None
    status:           Optional[str] = None


class AppointmentOut(OrmBase):
    id:               int
    patient_id:       int
    doctor_id:        Optional[int]
    appointment_type: str
    appointment_date: date
    appointment_time: str
    location:         Optional[str]
    notes:            Optional[str]
    status:           str
    created_at:       datetime
    updated_at:       datetime


# ── Offline Sync ──────────────────────────────────────────────────────────────
class SyncRecord(BaseModel):
    id:         str   = Field(..., description="Offline-generated unique ID")
    created_at: str   = Field(..., description="ISO timestamp from the device")
    vitals:     dict  = Field(..., description="VitalsInput payload")


class SyncQueueRequest(BaseModel):
    records: List[SyncRecord]


class SyncQueueResponse(BaseModel):
    status:            str
    total_received:    int
    synced_records:    int
    conflicts_skipped: int
    failed_records:    int


# ── Admin / User Management ───────────────────────────────────────────────────
class UserRoleUpdate(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        allowed = {"admin", "doctor", "frontline", "patient"}
        if v.lower() not in allowed:
            raise ValueError(f"Role must be one of: {', '.join(allowed)}")
        return v.lower()


class AdminActivityItem(BaseModel):
    id:         int
    event_type: str               # "screening" | "escalation" | "resolved"
    patient:    Optional[str]
    clinic:     Optional[str]
    timestamp:  datetime
    details:    Optional[str]


# ── Generic ───────────────────────────────────────────────────────────────────
class MessageResponse(BaseModel):
    message: str
    detail:  Optional[Any] = None
