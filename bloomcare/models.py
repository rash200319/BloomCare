"""
BloomCare – Pydantic Data Schemas
==================================
Defines all request/response models used across the API.

Stage 1  → Frontline triage vitals (BP, Age, BMI, HR, Temp)
Stage 2  → Clinical biomarkers (sFlt-1/PlGF, PAPP-A, Metabolomics, Doppler)
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ─────────────────────────────────────────────
# Shared enumerations
# ─────────────────────────────────────────────

class RiskTier(str, Enum):
    ROUTINE_CARE = "routine_care"
    ESCALATE     = "escalate"


class ConditionType(str, Enum):
    PREECLAMPSIA_EARLY_ONSET  = "preeclampsia_early_onset"
    PREECLAMPSIA_LATE_ONSET   = "preeclampsia_late_onset"
    PREECLAMPSIA_SEVERE       = "preeclampsia_severe"
    GDM                       = "gestational_diabetes_mellitus"
    PRETERM_BIRTH             = "preterm_birth"


# ─────────────────────────────────────────────
# Stage 1 – Triage (Edge Device Sync)
# ─────────────────────────────────────────────

class BloodPressureReading(BaseModel):
    """Structured blood pressure reading with validation."""

    systolic: int = Field(..., ge=60, le=220, description="Systolic pressure (mmHg)")
    diastolic: int = Field(..., ge=40, le=140, description="Diastolic pressure (mmHg)")

    @field_validator("diastolic")
    @classmethod
    def diastolic_below_systolic(cls, v: int, info: Any) -> int:
        systolic = info.data.get("systolic")
        if systolic is not None and v >= systolic:
            raise ValueError("Diastolic pressure must be lower than systolic pressure.")
        return v

    @property
    def map(self) -> float:
        """Mean Arterial Pressure (mmHg)."""
        return round((self.systolic + 2 * self.diastolic) / 3, 2)

    @property
    def pulse_pressure(self) -> int:
        return self.systolic - self.diastolic


class TriageInput(BaseModel):
    """
    Stage 1 – Frontline Triage Vitals
    ----------------------------------
    Collected at point-of-care (community health worker / mobile device).
    The lightweight on-device MLP produces a binary risk classification
    locally; this endpoint syncs that result along with the raw vitals.
    """

    # Patient identifiers (de-identified for FHIR R4 compatibility)
    patient_id: str = Field(..., description="Unique patient identifier (UUID / EHR ID)")
    encounter_id: Optional[str] = Field(None, description="Encounter / visit reference ID")
    gestational_age_weeks: int = Field(..., ge=4, le=42, description="Gestational age in weeks")
    collected_at: Optional[str] = Field(
        None,
        description="ISO-8601 timestamp of vitals collection at edge device",
    )

    # Core vitals
    age: int = Field(..., ge=10, le=60, description="Patient age in years")
    blood_pressure: BloodPressureReading
    bmi: Optional[float] = Field(
        None,
        ge=10.0,
        le=65.0,
        description="Body Mass Index kg/m² (optional – may be imputed server-side)",
    )
    heart_rate: int = Field(..., ge=30, le=200, description="Resting heart rate (bpm)")
    temperature: float = Field(..., ge=35.0, le=42.0, description="Body temperature (°C)")

    # Edge device ML output (synced from TFLite / PyTorch Mobile)
    edge_risk_classification: RiskTier = Field(
        ...,
        description="Binary risk classification produced by the on-device MLP",
    )
    edge_risk_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score [0,1] output by the edge MLP",
    )
    device_id: Optional[str] = Field(None, description="Mobile device identifier for audit trail")

    model_config = {"json_schema_extra": {
        "example": {
            "patient_id": "PAT-0001-LK",
            "encounter_id": "ENC-2026-03-28-001",
            "gestational_age_weeks": 28,
            "collected_at": "2026-03-28T07:45:00+05:30",
            "age": 31,
            "blood_pressure": {"systolic": 148, "diastolic": 96},
            "bmi": 29.4,
            "heart_rate": 92,
            "temperature": 37.1,
            "edge_risk_classification": "escalate",
            "edge_risk_score": 0.83,
            "device_id": "BLOOMCARE-MOB-007",
        }
    }}


class TriageSyncResponse(BaseModel):
    """Response returned after a successful Stage-1 triage sync."""

    patient_id: str
    encounter_id: Optional[str]
    server_risk_tier: RiskTier
    synced_at: str
    triage_flags: List[str] = Field(default_factory=list)
    recommended_action: str
    escalation_required: bool


# ─────────────────────────────────────────────
# Stage 2 – Detailed Diagnosis Biomarkers
# ─────────────────────────────────────────────

class DopplerData(BaseModel):
    """
    Uterine & umbilical Doppler indices.
    All indices are dimensionless waveform ratios measured via ultrasound.
    """

    uterine_artery_pi: Optional[float] = Field(
        None, ge=0.0, le=5.0,
        description="Uterine artery pulsatility index (bilateral mean)"
    )
    umbilical_artery_ri: Optional[float] = Field(
        None, ge=0.0, le=1.5,
        description="Umbilical artery resistance index"
    )
    middle_cerebral_artery_pi: Optional[float] = Field(
        None, ge=0.0, le=5.0,
        description="Middle cerebral artery pulsatility index (MCA-PI)"
    )
    cerebroplacental_ratio: Optional[float] = Field(
        None, ge=0.0, le=5.0,
        description="Cerebroplacental ratio = MCA-PI / UA-PI"
    )
    end_diastolic_flow: Optional[str] = Field(
        None,
        description="Qualitative end-diastolic flow status: 'present' | 'absent' | 'reversed'",
    )


class MetabolomicsPanel(BaseModel):
    """
    Plasma metabolomics biomarkers.
    Units: mmol/L unless otherwise noted.
    """

    glucose_fasting: Optional[float] = Field(None, ge=1.0, le=30.0, description="Fasting glucose (mmol/L)")
    insulin_fasting: Optional[float] = Field(None, ge=0.0, le=300.0, description="Fasting insulin (pmol/L)")
    hba1c: Optional[float] = Field(None, ge=3.0, le=15.0, description="HbA1c (%)")
    triglycerides: Optional[float] = Field(None, ge=0.0, le=20.0, description="Triglycerides (mmol/L)")
    hdl_cholesterol: Optional[float] = Field(None, ge=0.0, le=5.0, description="HDL-C (mmol/L)")
    ldl_cholesterol: Optional[float] = Field(None, ge=0.0, le=10.0, description="LDL-C (mmol/L)")
    creatinine: Optional[float] = Field(None, ge=0.0, le=1000.0, description="Serum creatinine (µmol/L)")
    uric_acid: Optional[float] = Field(None, ge=0.0, le=800.0, description="Uric acid (µmol/L)")
    lactate: Optional[float] = Field(None, ge=0.0, le=20.0, description="Lactate (mmol/L)")


class DiagnoseInput(BaseModel):
    """
    Stage 2 – High-Risk Clinical Biomarker Panel
    ---------------------------------------------
    Required after Stage 1 escalation. Combines placental biomarkers,
    metabolomics, and Doppler indices for multi-condition phenotyping.
    """

    patient_id: str = Field(..., description="Must match the Stage-1 patient_id")
    encounter_id: Optional[str] = None
    gestational_age_weeks: int = Field(..., ge=4, le=42)

    # ── Placental Biomarkers ───────────────────
    sflt1_plgf_ratio: Optional[float] = Field(
        None,
        ge=0.0,
        le=1000.0,
        description=(
            "sFlt-1 / PlGF ratio — elevated (>38 at ≤34 wks, >110 at >34 wks) "
            "strongly predicts preeclampsia within 4 weeks"
        ),
    )
    plgf_absolute: Optional[float] = Field(
        None, ge=0.0, le=5000.0,
        description="Absolute PlGF concentration (pg/mL)"
    )
    papp_a: Optional[float] = Field(
        None,
        ge=0.0,
        le=20.0,
        description=(
            "Pregnancy-Associated Plasma Protein-A (MoM). "
            "Low PAPP-A (<0.4 MoM at 11–13 wks) predicts adverse pregnancy outcomes."
        ),
    )
    papp_a_absolute: Optional[float] = Field(
        None, ge=0.0, le=100000.0,
        description="Absolute PAPP-A concentration (mIU/L)"
    )

    # ── Metabolomics ───────────────────────────
    metabolomics: Optional[MetabolomicsPanel] = None

    # ── Doppler Ultrasound ─────────────────────
    doppler: Optional[DopplerData] = None

    # ── Supplementary Biomarkers ───────────────
    cervical_length_mm: Optional[float] = Field(
        None, ge=0.0, le=60.0,
        description="Cervical length (mm) by transvaginal ultrasound — short CL <25mm signals preterm risk"
    )
    nt_pro_bnp: Optional[float] = Field(
        None, ge=0.0, le=50000.0,
        description="NT-proBNP (pg/mL) — cardiac load marker"
    )
    fibronectin: Optional[float] = Field(
        None, ge=0.0, le=1000.0,
        description="Fetal fibronectin (ng/mL)"
    )

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
            raise ValueError(
                "At least one biomarker field must be provided for Stage-2 diagnosis."
            )
        return self

    model_config = {"json_schema_extra": {
        "example": {
            "patient_id": "PAT-0001-LK",
            "encounter_id": "ENC-2026-03-28-001",
            "gestational_age_weeks": 28,
            "sflt1_plgf_ratio": 52.3,
            "plgf_absolute": 38.7,
            "papp_a": 0.31,
            "metabolomics": {
                "glucose_fasting": 6.8,
                "hba1c": 6.2,
                "triglycerides": 3.1,
                "hdl_cholesterol": 1.1,
                "creatinine": 85.0,
                "uric_acid": 380.0,
            },
            "doppler": {
                "uterine_artery_pi": 1.72,
                "umbilical_artery_ri": 0.79,
                "middle_cerebral_artery_pi": 1.45,
                "cerebroplacental_ratio": 0.84,
                "end_diastolic_flow": "present",
            },
            "cervical_length_mm": 22.0,
        }
    }}


# ─────────────────────────────────────────────
# Stage 2 – ML Output Schemas
# ─────────────────────────────────────────────

class ClusterProfile(BaseModel):
    """Unsupervised Weighted K-Means cluster assignment."""

    cluster_id: int
    cluster_label: str = Field(..., description="Human-readable cluster name (e.g. 'Hypertensive-Metabolic')")
    cluster_confidence: float = Field(..., ge=0.0, le=1.0)
    dominant_features: List[str]


class ConditionProbability(BaseModel):
    """Probability and confidence interval for a single condition."""

    condition: ConditionType
    probability: float = Field(..., ge=0.0, le=1.0)
    confidence_lower: float = Field(..., ge=0.0, le=1.0)
    confidence_upper: float = Field(..., ge=0.0, le=1.0)
    risk_category: str = Field(..., description="'low' | 'moderate' | 'high' | 'critical'")
    contributing_features: Dict[str, float] = Field(
        default_factory=dict,
        description="SHAP-style feature importance scores for top contributing factors",
    )


class DiagnoseMLOutput(BaseModel):
    """Structured ML output from the Stage-2 Multi-Condition Phenotyping Engine."""

    patient_id: str
    encounter_id: Optional[str]
    processed_at: str

    # Unsupervised layer
    cluster_profile: ClusterProfile

    # Supervised layer
    condition_probabilities: List[ConditionProbability]
    overall_severity_score: float = Field(..., ge=0.0, le=1.0)
    dominant_condition: ConditionType
    imputed_features: List[str] = Field(
        default_factory=list,
        description="Feature names that were imputed via Cross-Dataset Synthetic Imputation",
    )
    data_quality_score: float = Field(
        ..., ge=0.0, le=1.0,
        description="Completeness and confidence score for input data (1.0 = fully observed)"
    )


class DiagnoseResponse(BaseModel):
    """Full API response for POST /api/v1/diagnose."""

    status: str = "success"
    ml_output: DiagnoseMLOutput
    recommended_specialist_referral: str
    urgent: bool


# ─────────────────────────────────────────────
# GenAI Assistant Schemas
# ─────────────────────────────────────────────

class AssistantRequest(BaseModel):
    """
    Input to the GenAI explanation endpoint.
    Accepts the structured ML output JSON so the LLM can
    translate it into actionable clinical guidance.
    """

    ml_output: DiagnoseMLOutput
    requester_role: str = Field(
        default="frontline_health_worker",
        description="Role context: 'frontline_health_worker' | 'physician' | 'patient'",
    )
    preferred_language: Optional[str] = Field(
        None,
        description="Primary language for explanation ('en' | 'si' | 'ta'). All three always included.",
    )


class LanguageExplanation(BaseModel):
    """Explanation in a single language."""

    language_code: str        # ISO 639-1
    language_name: str
    summary: str
    risk_statement: str
    clinical_next_steps: List[str]
    patient_advice: str


class AssistantResponse(BaseModel):
    """Response from POST /api/v1/assistant/explain."""

    patient_id: str
    dominant_condition: str
    overall_severity_score: float
    explanations: List[LanguageExplanation]   # English, Sinhala, Tamil
    generated_at: str
    model_used: str
    disclaimer: str = (
        "This AI-generated explanation is a clinical decision support tool. "
        "Final medical decisions must be made by a qualified healthcare professional."
    )
