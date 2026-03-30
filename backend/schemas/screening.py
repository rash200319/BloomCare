from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime

class RiskTier(str, Enum):
    ROUTINE_CARE = "routine_care"
    ESCALATE     = "escalate"

class ConditionType(str, Enum):
    PREECLAMPSIA_EARLY_ONSET  = "preeclampsia_early_onset"
    PREECLAMPSIA_LATE_ONSET   = "preeclampsia_late_onset"
    PREECLAMPSIA_SEVERE       = "preeclampsia_severe"
    GDM                       = "gestational_diabetes_mellitus"
    PRETERM_BIRTH             = "preterm_birth"

class BloodPressureReading(BaseModel):
    systolic: int = Field(..., ge=60, le=220)
    diastolic: int = Field(..., ge=40, le=140)

    @field_validator("diastolic")
    @classmethod
    def diastolic_below_systolic(cls, v: int, info: Any) -> int:
        systolic = info.data.get("systolic")
        if systolic is not None and v >= systolic:
            raise ValueError("Diastolic pressure must be lower than systolic pressure.")
        return v

    @property
    def map(self) -> float:
        return round((self.systolic + 2 * self.diastolic) / 3, 2)

class TriageInput(BaseModel):
    patient_id: str
    encounter_id: Optional[str] = None
    gestational_age_weeks: int = Field(..., ge=4, le=42)
    collected_at: Optional[str] = None
    age: int = Field(..., ge=10, le=60)
    blood_pressure: BloodPressureReading
    bmi: Optional[float] = None
    heart_rate: int = Field(..., ge=30, le=200)
    temperature: float = Field(..., ge=35.0, le=42.0)
    
    # Additional fields
    blood_sugar: Optional[float] = Field(None, alias="bs")
    hemoglobin: Optional[float] = None
    pcos: Optional[bool] = None
    previous_complications: Optional[bool] = None
    preexisting_diabetes: Optional[bool] = None
    mental_health: Optional[float] = None
    sleep_pattern: Optional[float] = None
    exercise: Optional[float] = None
    education: Optional[int] = None
    
    # Overall risk classification
    edge_risk_classification: RiskTier
    edge_risk_score: float = Field(..., ge=0.0, le=1.0)
    
    device_id: Optional[str] = None

    model_config = {"populate_by_name": True}

class BatchedTriageSyncInput(BaseModel):
    items: List[TriageInput]

class TriageSyncResponse(BaseModel):
    screening_id: Optional[str] = None
    patient_id: str
    encounter_id: Optional[str]
    server_risk_tier: RiskTier
    synced_at: str
    triage_flags: List[str] = Field(default_factory=list)
    recommended_action: str
    escalation_required: bool
    stage2_priority: Optional[Dict[str, Any]] = None

class DopplerData(BaseModel):
    uterine_artery_pi: Optional[float] = None
    umbilical_artery_ri: Optional[float] = None
    middle_cerebral_artery_pi: Optional[float] = None
    cerebroplacental_ratio: Optional[float] = None
    end_diastolic_flow: Optional[str] = None

class MetabolomicsPanel(BaseModel):
    glucose_fasting: Optional[float] = None
    insulin_fasting: Optional[float] = None
    hba1c: Optional[float] = None
    triglycerides: Optional[float] = None
    hdl_cholesterol: Optional[float] = None
    ldl_cholesterol: Optional[float] = None
    creatinine: Optional[float] = None
    uric_acid: Optional[float] = None
    lactate: Optional[float] = None

class DiagnoseInput(BaseModel):
    patient_id: str
    encounter_id: Optional[str] = None
    gestational_age_weeks: int = Field(..., ge=4, le=42)
    primary_disease_to_check: Optional[str] = None  # e.g., "preeclampsia", "gdm", "preterm"
    model_override: Optional[str] = None  # doctor-selected model file, e.g., stage2_preterm_support_ehg.pkl
    stage1_screening_id: Optional[str] = None  # Link to stage 1 results
    sflt1_plgf_ratio: Optional[float] = None
    plgf_absolute: Optional[float] = None
    papp_a: Optional[float] = None
    papp_a_absolute: Optional[float] = None
    metabolomics: Optional[MetabolomicsPanel] = None
    doppler: Optional[DopplerData] = None
    cervical_length_mm: Optional[float] = None
    nt_pro_bnp: Optional[float] = None
    fibronectin: Optional[float] = None
    # Disease-specific inputs (variable structure based on disease)
    disease_specific_inputs: Optional[Dict[str, Any]] = None

    @model_validator(mode="after")
    def at_least_one_biomarker_present(self) -> "DiagnoseInput":
        has_data = any([
            self.sflt1_plgf_ratio is not None,
            self.papp_a is not None,
            self.metabolomics is not None,
            self.doppler is not None,
            self.cervical_length_mm is not None,
        ])
        if not has_data:
            raise ValueError("At least one biomarker field must be provided.")
        return self

class ClusterProfile(BaseModel):
    cluster_id: int
    cluster_label: str
    cluster_confidence: float
    dominant_features: List[str]

class ConditionProbability(BaseModel):
    condition: ConditionType
    probability: float
    confidence_lower: float
    confidence_upper: float
    risk_category: str
    contributing_features: Dict[str, float] = Field(default_factory=dict)

class DiagnoseMLOutput(BaseModel):
    patient_id: str
    encounter_id: Optional[str]
    processed_at: str
    cluster_profile: ClusterProfile
    condition_probabilities: List[ConditionProbability]
    overall_severity_score: float
    dominant_condition: ConditionType
    imputed_features: List[str] = Field(default_factory=list)
    data_quality_score: float

class DiagnoseResponse(BaseModel):
    status: str = "success"
    ml_output: DiagnoseMLOutput
    recommended_specialist_referral: str
    urgent: bool

class AssistantRequest(BaseModel):
    ml_output: DiagnoseMLOutput
    requester_role: str = "frontline_health_worker"
    preferred_language: Optional[str] = None

class LanguageExplanation(BaseModel):
    language_code: str
    language_name: str
    summary: str
    risk_statement: str
    clinical_next_steps: List[str]
    patient_advice: str

class AssistantResponse(BaseModel):
    patient_id: str
    dominant_condition: str


class Stage2RecommendationResponse(BaseModel):
    patient_id: str
    stage1_screening_id: str
    primary_disease_to_check: str
    model_to_use: Optional[str] = None
    clinical_notes: Optional[str] = None
    created_at: str


class PatientReportRequest(BaseModel):
    stage1_screening_id: str
    report_type: str = Field(..., pattern="^(stage1|stage2|combined)$")
    title: Optional[str] = None


class PatientReportResponse(BaseModel):
    id: str
    patient_id: str
    report_type: str
    report_title: str
    file_path: Optional[str] = None
    generated_at: str
    download_url: Optional[str] = None
    expires_at: Optional[str] = None


class Stage1ScreeningReportData(BaseModel):
    """Data structure for Stage 1 screening report"""
    patient_name: str
    gestational_age: int
    screening_date: str
    vitals: Dict[str, Any]
    contributing_factors: Dict[str, float]  # Feature importance
    risk_score: float
    risk_classification: str
    recommendations: List[str]
    next_steps: str
    overall_severity_score: float
    explanations: List[LanguageExplanation]
    generated_at: str
    model_used: str
    disclaimer: str

class Stage1ScreeningInDBBase(BaseModel):
    id: str
    patient_id: str
    collected_at: datetime
    model_config = {"from_attributes": True}

class Stage2DiagnosticInDBBase(BaseModel):
    id: str
    patient_id: str
    evaluated_at: datetime
    model_config = {"from_attributes": True}
