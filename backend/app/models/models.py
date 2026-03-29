"""
BloomCare – ORM Models
All tables include created_at / updated_at timestamps.
"""

from datetime import datetime, date, timezone
from sqlalchemy import (
    String, Integer, Float, Boolean, Date, DateTime,
    ForeignKey, Text, JSON, Enum as SAEnum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum
from app.core.database import Base


# ── Enumerations ─────────────────────────────────────────────────────────────
class UserRole(str, enum.Enum):
    admin     = "admin"
    doctor    = "doctor"
    frontline = "frontline"
    patient   = "patient"


class RiskLevel(str, enum.Enum):
    low      = "low"
    moderate = "moderate"
    high     = "high"


class AppointmentStatus(str, enum.Enum):
    pending   = "pending"
    confirmed = "confirmed"
    completed = "completed"
    cancelled = "cancelled"


# ── Timestamp Mixin ───────────────────────────────────────────────────────────
class TimestampMixin:
    """Adds created_at and updated_at to every model that inherits it."""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# ── User ──────────────────────────────────────────────────────────────────────
class User(TimestampMixin, Base):
    """
    Core authentication & identity model.
    Every staff member and patient has a User record.
    The `user_id` is the human-readable role-prefixed ID (e.g. PAT-0001).
    """
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # ── Role-Based ID (visible to users) ─────────────────────────────────────
    user_id: Mapped[str] = mapped_column(String(16), unique=True, nullable=False, index=True)

    # ── Auth Fields ───────────────────────────────────────────────────────────
    username: Mapped[str]  = mapped_column(String(64), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(256), nullable=False)

    # ── Personal Info (Registration) ─────────────────────────────────────────
    full_name:    Mapped[str]          = mapped_column(String(200), nullable=False)
    birthday:     Mapped[date]         = mapped_column(Date, nullable=False)
    address:      Mapped[str]          = mapped_column(Text, nullable=False)
    telephone:    Mapped[str]          = mapped_column(String(20), nullable=False)
    nic_number:   Mapped[str]          = mapped_column(String(20), unique=True, nullable=False, index=True)

    # ── Role & Status ─────────────────────────────────────────────────────────
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="userrole"), nullable=False
    )
    is_active:  Mapped[bool] = mapped_column(Boolean, default=True)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    patient_profile: Mapped["Patient | None"] = relationship(
        "Patient", back_populates="user", uselist=False, foreign_keys="Patient.user_id"
    )

    def __repr__(self) -> str:
        return f"<User {self.user_id} ({self.role.value})>"


# ── Patient ───────────────────────────────────────────────────────────────────
class Patient(TimestampMixin, Base):
    """
    Extended maternal health record — linked 1-to-1 with a User (role=patient).
    """
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    # ── Clinical Profile ──────────────────────────────────────────────────────
    blood_group:        Mapped[str | None]   = mapped_column(String(5))
    gestational_week:   Mapped[int | None]   = mapped_column(Integer)
    due_date:           Mapped[date | None]  = mapped_column(Date)
    pregnancy_status:   Mapped[str | None]   = mapped_column(String(100))
    current_risk_level: Mapped[RiskLevel | None] = mapped_column(
        SAEnum(RiskLevel, name="risklevel"), nullable=True
    )
    assigned_doctor_id: Mapped[int | None]   = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    user:         Mapped["User"]          = relationship("User", back_populates="patient_profile", foreign_keys=[user_id])
    vitals:       Mapped[list["Vitals"]]  = relationship("Vitals", back_populates="patient", cascade="all, delete-orphan")
    risk_records: Mapped[list["RiskRecord"]] = relationship("RiskRecord", back_populates="patient", cascade="all, delete-orphan")
    appointments: Mapped[list["Appointment"]] = relationship("Appointment", back_populates="patient", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Patient patient_id={self.id}>"


# ── Vitals ────────────────────────────────────────────────────────────────────
class Vitals(TimestampMixin, Base):
    """
    A single vitals measurement session for a patient.
    Recorded by frontline staff during triage.
    """
    __tablename__ = "vitals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recorded_by_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    # ── Measurements ─────────────────────────────────────────────────────────
    age:                    Mapped[float | None] = mapped_column(Float)
    bmi:                    Mapped[float | None] = mapped_column(Float)
    systolic:               Mapped[float | None] = mapped_column(Float)
    diastolic:              Mapped[float | None] = mapped_column(Float)
    heart_rate:             Mapped[float | None] = mapped_column(Float)
    blood_sugar:            Mapped[float | None] = mapped_column(Float)
    body_temperature:       Mapped[float | None] = mapped_column(Float)
    hemoglobin:             Mapped[float | None] = mapped_column(Float)
    pcos:                   Mapped[int | None]   = mapped_column(Integer)   # 0/1
    previous_complications: Mapped[int | None]   = mapped_column(Integer)   # 0/1
    preexisting_diabetes:   Mapped[int | None]   = mapped_column(Integer)   # 0/1
    mental_health:          Mapped[int | None]   = mapped_column(Integer)   # 1-10
    sleep_pattern:          Mapped[int | None]   = mapped_column(Integer)   # hrs
    exercise:               Mapped[int | None]   = mapped_column(Integer)   # 0-5
    education:              Mapped[int | None]   = mapped_column(Integer)   # 0-5

    # ── Offline Sync Flag ────────────────────────────────────────────────────
    synced_from_offline: Mapped[bool] = mapped_column(Boolean, default=False)
    offline_id:          Mapped[str | None] = mapped_column(String(64), nullable=True)

    patient: Mapped["Patient"] = relationship("Patient", back_populates="vitals")

    def __repr__(self) -> str:
        return f"<Vitals patient_id={self.patient_id} created_at={self.created_at}>"


# ── Risk Record ───────────────────────────────────────────────────────────────
class RiskRecord(TimestampMixin, Base):
    """
    AI prediction result — stored every time Stage 1 or Stage 2 is run.
    """
    __tablename__ = "risk_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vitals_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("vitals.id"), nullable=True
    )

    stage:       Mapped[str]       = mapped_column(String(10), nullable=False)   # "stage1" | "stage2"
    condition:   Mapped[str | None] = mapped_column(String(50))                   # None / "preeclampsia" / "gdm" / "preterm"
    probability: Mapped[float]      = mapped_column(Float, nullable=False)
    risk_level:  Mapped[RiskLevel]  = mapped_column(
        SAEnum(RiskLevel, name="risklevel_rec"), nullable=False
    )
    threshold:       Mapped[float | None]  = mapped_column(Float)
    recommendations: Mapped[list | None]   = mapped_column(JSON)

    # Source of the prediction
    is_mock:         Mapped[bool]   = mapped_column(Boolean, default=False)
    model_version:   Mapped[str | None] = mapped_column(String(50))

    patient: Mapped["Patient"] = relationship("Patient", back_populates="risk_records")

    def __repr__(self) -> str:
        return f"<RiskRecord patient_id={self.patient_id} stage={self.stage} risk={self.risk_level}>"


# ── Appointment ───────────────────────────────────────────────────────────────
class Appointment(TimestampMixin, Base):
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    doctor_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    appointment_type: Mapped[str]  = mapped_column(String(100), nullable=False)
    appointment_date: Mapped[date] = mapped_column(Date, nullable=False)
    appointment_time: Mapped[str]  = mapped_column(String(10), nullable=False)   # e.g. "10:30"
    location:         Mapped[str | None] = mapped_column(String(200))
    notes:            Mapped[str | None] = mapped_column(Text)
    status: Mapped[AppointmentStatus] = mapped_column(
        SAEnum(AppointmentStatus, name="appointmentstatus"),
        default=AppointmentStatus.pending,
    )

    patient: Mapped["Patient"] = relationship("Patient", back_populates="appointments")

    def __repr__(self) -> str:
        return f"<Appointment id={self.id} patient_id={self.patient_id} date={self.appointment_date}>"


# ── Sync Queue ────────────────────────────────────────────────────────────────
class SyncQueueItem(TimestampMixin, Base):
    """
    Persists batched offline records sent by the PWA for deduplication.
    """
    __tablename__ = "sync_queue"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    offline_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    payload:    Mapped[dict] = mapped_column(JSON, nullable=False)
    synced_at:  Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_synced:  Mapped[bool] = mapped_column(Boolean, default=False)

    def __repr__(self) -> str:
        return f"<SyncQueueItem offline_id={self.offline_id} synced={self.is_synced}>"
