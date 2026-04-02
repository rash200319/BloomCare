from pydantic import BaseModel, Field


class DifferentialEvaluationRequest(BaseModel):
    patient_id: str = Field(..., min_length=1)
    stage1_screening_id: str | None = None
    gestational_age_weeks: int | None = Field(default=None, ge=4, le=42)

    # Shared vitals
    age: int = Field(..., ge=10, le=60)
    bmi: float = Field(..., ge=10.0, le=80.0)
    systolic_bp: int = Field(..., ge=50, le=260)
    diastolic_bp: int = Field(..., ge=30, le=180)
    heart_rate: int = Field(..., ge=20, le=240)
    blood_sugar: float = Field(..., ge=20.0, le=600.0)
    temperature: float = Field(..., ge=30.0, le=45.0)

    # PE specific
    sflt1_plgf_ratio: float = Field(..., ge=0.0)
    serum_creatinine: float = Field(..., ge=0.0)
    platelet_count: float = Field(..., ge=0.0)

    # GDM specific
    hba1c: float = Field(..., ge=0.0)
    ogtt_1hr: float = Field(..., ge=0.0)
    ogtt_2hr: float = Field(..., ge=0.0)
    pregnancies_count: int = Field(..., ge=0, le=20)

    # Preterm specific
    cervical_length_mm: float = Field(..., ge=0.0)
    ffn_result: bool
    mean_pulse_pressure: float = Field(..., ge=0.0)


class ConditionResult(BaseModel):
    risk_level: str
    probability: float


class ExplainabilityFeature(BaseModel):
    feature: str
    importance: float
    contribution: float
    direction: str
    value: str
    status: str
    clinical_hint: str


class DifferentialEvaluationResponse(BaseModel):
    stage2_diagnostic_id: str | None = None
    preeclampsia: ConditionResult
    gdm: ConditionResult
    preterm_birth: ConditionResult
    primary_risk: str
    explainability_model: str
    explainability: list[ExplainabilityFeature] = Field(default_factory=list)
