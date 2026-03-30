import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, DECIMAL, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from db.base import Base


class ScreeningReport(Base):
    __tablename__ = "screening_reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)

    # Core Stage 1 outcomes for longitudinal trend tracking.
    general_risk_flag = Column(String(10), nullable=False)  # "High" | "Low"
    probability_score = Column(DECIMAL(6, 5), nullable=False)
    triggers = Column(JSONB, nullable=False)

    screened_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True)
    recorded_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    patient = relationship("Patient", backref="screening_reports")
    recorder = relationship("User", backref="screening_reports_recorded")
