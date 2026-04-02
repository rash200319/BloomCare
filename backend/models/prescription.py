import uuid
from sqlalchemy import Column, String, Date, DateTime, Boolean, ForeignKey, func
from backend.db.base import Base


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    specialist_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    stage2_diagnostic_id = Column(String(36), ForeignKey("stage2_diagnostics.id", ondelete="SET NULL"), nullable=True)

    medication_name = Column(String(255), nullable=False)
    dosage = Column(String(100), nullable=True)
    frequency = Column(String(100), nullable=True)
    route = Column(String(50), nullable=True)
    instructions = Column(String, nullable=True)

    start_date = Column(Date, server_default=func.current_date())
    end_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
