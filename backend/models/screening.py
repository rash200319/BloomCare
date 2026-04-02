import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Boolean, Enum, DECIMAL
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from backend.db.base import Base


class RiskTier(str, enum.Enum):
    routine_care = "routine_care"
    escalate = "escalate"


class Stage1Screening(Base):
    __tablename__ = "stage1_screenings"

    id = Column(String(36), primary_key=True,
                default=lambda: str(uuid.uuid4()))
    patient_id = Column(String(36), ForeignKey(
        "patients.id", ondelete="CASCADE"))
    worker_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    encounter_id = Column(String)
    gestational_age_weeks = Column(Integer, nullable=False)

    # Vitals
    age = Column(Integer)
    systolic = Column(Integer)
    diastolic = Column(Integer)
    bmi = Column(DECIMAL(5, 2))
    heart_rate = Column(Integer)
    temperature = Column(DECIMAL(4, 1))

    # Additional screening data
    Blood_sugar = Column("blood_sugar", DECIMAL(5, 2))
    hemoglobin = Column(DECIMAL(4, 2))
    pcos = Column(Boolean)
    previous_complications = Column(Boolean)
    preexisting_diabetes = Column(Boolean)
    mental_health = Column(Integer)
    sleep_pattern = Column(Integer)
    exercise = Column(Integer)
    education = Column(Integer)

    # ML Output
    edge_risk_classification = Column(Enum(RiskTier))
    edge_risk_score = Column(DECIMAL(4, 3))

    # Contributing factors that led to high risk (feature importance from model)
    # e.g., {"systolic": 0.25, "bmi": 0.20, "age": 0.15}
    contributing_factors = Column(JSONB)
    # Stage 2 routing context built from Stage 1 findings
    stage2_priority = Column(JSONB)

    device_id = Column(String)

    # Sync Meta
    collected_at = Column(DateTime(timezone=True))
    synced_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True),
                        default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient", backref="stage1_screenings")
    worker = relationship("User", backref="screenings")


class Stage2Diagnostic(Base):
    __tablename__ = "stage2_diagnostics"

    id = Column(String(36), primary_key=True,
                default=lambda: str(uuid.uuid4()))
    patient_id = Column(String(36), ForeignKey(
        "patients.id", ondelete="CASCADE"))
    specialist_id = Column(String(36), ForeignKey(
        "users.id", ondelete="SET NULL"))
    stage1_screening_id = Column(String(36), ForeignKey(
        "stage1_screenings.id", ondelete="SET NULL"))
    gestational_age_weeks = Column(Integer, nullable=False)

    # Disease being checked (from stage 1 high risk)
    # e.g., "preeclampsia", "gdm", "preterm"
    primary_disease_checked = Column(String(50))
    model_used = Column(String(100))  # e.g., "stage2_gdm_diagnostic.pkl"

    # Biomarkers
    sflt1_plgf_ratio = Column(DECIMAL(8, 2))
    plgf_absolute = Column(DECIMAL(8, 2))
    papp_a = Column(DECIMAL(8, 2))
    cervical_length_mm = Column(DECIMAL(5, 2))

    # Arrays/JSON
    metabolomics = Column(JSONB)
    doppler = Column(JSONB)

    # Disease-specific inputs
    disease_specific_inputs = Column(JSONB)

    # ML
    cluster_profile = Column(JSONB)
    condition_probabilities = Column(JSONB)
    explainability_data = Column(JSONB)
    input_snapshot = Column(JSONB)
    overall_severity_score = Column(DECIMAL(4,3))
    dominant_condition = Column(String)

    evaluated_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    patient = relationship("Patient", backref="stage2_diagnostics")
    specialist = relationship("User", backref="diagnostics")
    stage1_screening = relationship(
        "Stage1Screening", backref="stage2_diagnostics")


class Stage2Recommendation(Base):
    __tablename__ = "stage2_recommendations"

    id = Column(String(36), primary_key=True,
                default=lambda: str(uuid.uuid4()))
    patient_id = Column(String(36), ForeignKey(
        "patients.id", ondelete="CASCADE"))
    stage1_screening_id = Column(String(36), ForeignKey(
        "stage1_screenings.id", ondelete="CASCADE"))

    # Disease selected by doctor to check
    # e.g., "preeclampsia", "gdm", "preterm"
    primary_disease_to_check = Column(String(50), nullable=False)
    model_to_use = Column(String(100))

    # Clinical reasoning from doctor
    clinical_notes = Column(String)

    created_by = Column(String(36), ForeignKey(
        "users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    expires_at = Column(DateTime(timezone=True))

    patient = relationship("Patient", backref="stage2_recommendations")
    stage1_screening = relationship(
        "Stage1Screening", backref="stage2_recommendations")
    created_by_user = relationship("User", backref="created_recommendations")


class PatientReport(Base):
    __tablename__ = "patient_reports"

    id = Column(String(36), primary_key=True,
                default=lambda: str(uuid.uuid4()))
    patient_id = Column(String(36), ForeignKey(
        "patients.id", ondelete="CASCADE"))
    stage1_screening_id = Column(String(36), ForeignKey(
        "stage1_screenings.id", ondelete="CASCADE"))
    stage2_diagnostic_id = Column(String(36), ForeignKey(
        "stage2_diagnostics.id", ondelete="SET NULL"))

    # Report type
    # "stage1", "stage2", "combined"
    report_type = Column(String(50), nullable=False)
    report_title = Column(String(255))

    # Report content
    content_type = Column(String(50))  # "pdf", "json", "html"
    report_content = Column(JSONB)

    # File metadata
    file_path = Column(String(500))  # S3 or local path
    file_size = Column(Integer)

    generated_by = Column(String(36), ForeignKey(
        "users.id", ondelete="SET NULL"))
    generated_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    expires_at = Column(DateTime(timezone=True))

    patient = relationship("Patient", backref="reports")
    stage1_screening = relationship("Stage1Screening", backref="reports")
    stage2_diagnostic = relationship("Stage2Diagnostic", backref="reports")
    generated_by_user = relationship("User", backref="generated_reports")
