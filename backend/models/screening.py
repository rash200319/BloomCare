import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Boolean, Enum, DECIMAL
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..db.base import Base

class RiskTier(str, enum.Enum):
    routine_care = "routine_care"
    escalate = "escalate"

class Stage1Screening(Base):
    __tablename__ = "stage1_screenings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"))
    worker_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    encounter_id = Column(String)
    gestational_age_weeks = Column(Integer, nullable=False)
    
    # Vitals
    age = Column(Integer)
    systolic = Column(Integer)
    diastolic = Column(Integer)
    bmi = Column(DECIMAL(5,2))
    heart_rate = Column(Integer)
    temperature = Column(DECIMAL(4,1))
    
    # ML Output
    edge_risk_classification = Column(Enum(RiskTier))
    edge_risk_score = Column(DECIMAL(4,3))
    device_id = Column(String)
    
    # Sync Meta
    collected_at = Column(DateTime(timezone=True))
    synced_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    patient = relationship("Patient", backref="stage1_screenings")
    worker = relationship("User", backref="screenings")


class Stage2Diagnostic(Base):
    __tablename__ = "stage2_diagnostics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"))
    specialist_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    gestational_age_weeks = Column(Integer, nullable=False)
    
    # Biomarkers
    sflt1_plgf_ratio = Column(DECIMAL(8,2))
    plgf_absolute = Column(DECIMAL(8,2))
    papp_a = Column(DECIMAL(8,2))
    cervical_length_mm = Column(DECIMAL(5,2))
    
    # Arrays/JSON
    metabolomics = Column(JSONB)
    doppler = Column(JSONB)
    
    # ML
    cluster_profile = Column(JSONB)
    condition_probabilities = Column(JSONB)
    overall_severity_score = Column(DECIMAL(4,3))
    dominant_condition = Column(String)
    
    evaluated_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    patient = relationship("Patient", backref="stage2_diagnostics")
    specialist = relationship("User", backref="diagnostics")
