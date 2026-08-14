"""Seed demo accounts into the active SQLAlchemy session (SQLite or Postgres).

Idempotent: upserts by email / national_id. Safe to call on every startup for SQLite.
"""
from __future__ import annotations

import logging
import uuid
from datetime import date, timedelta

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

DEMO_PASSWORD = "rash2003"


def ensure_demo_seeds(db: Session) -> None:
    """Upsert the interview demo staff + patients used by the login page."""
    from backend.core.security import get_password_hash
    from backend.models.patient import Patient
    from backend.models.user import User, UserRole

    password_hash = get_password_hash(DEMO_PASSWORD)

    staff = [
        {
            "email": "frontline.staff@bloomcare.health",
            "full_name": "Frontline Staff Demo",
            "role": UserRole.FRONTLINE_STAFF,
            "specialization": None,
        },
        {
            "email": "hospitaladmin@bloomcare.health",
            "full_name": "Hospital Admin Demo",
            "role": UserRole.ADMIN,
            "specialization": None,
        },
        {
            "email": "obsertitian@bloomcare.health",
            "full_name": "Obstetrician Demo",
            "role": UserRole.CLINICAL_SPECIALIST,
            "specialization": "Obstetrics",
        },
    ]

    for item in staff:
        user = db.query(User).filter(User.email == item["email"]).first()
        if user is None:
            user = User(
                id=str(uuid.uuid4()),
                email=item["email"],
                full_name=item["full_name"],
                hashed_password=password_hash,
                role=item["role"],
                specialization=item["specialization"],
                is_active=True,
                first_time_login=False,
            )
            db.add(user)
            logger.info("Seeded demo user %s", item["email"])
        else:
            user.full_name = item["full_name"]
            user.hashed_password = password_hash
            user.role = item["role"]
            user.specialization = item["specialization"]
            user.is_active = True
            user.first_time_login = False

    db.flush()

    frontline = (
        db.query(User)
        .filter(User.email == "frontline.staff@bloomcare.health")
        .first()
    )
    worker_id = frontline.id if frontline else None

    patients = [
        {
            "national_id": "NIC-900000001V",
            "full_name": "Nimalka Fernando",
            "age": 28,
            "blood_group": "O+",
        },
        {
            "national_id": "199912345678",
            "full_name": "Patient Demo",
            "age": 27,
            "blood_group": "A+",
        },
    ]

    for item in patients:
        patient = (
            db.query(Patient)
            .filter(Patient.national_id == item["national_id"])
            .first()
        )
        if patient is None:
            patient = Patient(
                id=str(uuid.uuid4()),
                national_id=item["national_id"],
                full_name=item["full_name"],
                age=item["age"],
                blood_group=item["blood_group"],
                hashed_password=password_hash,
                due_date=date.today() + timedelta(weeks=12),
                assigned_worker_id=worker_id,
                is_active=True,
                first_time_login=False,
            )
            db.add(patient)
            logger.info("Seeded demo patient %s", item["national_id"])
        else:
            patient.full_name = item["full_name"]
            patient.age = item["age"]
            patient.blood_group = item["blood_group"]
            patient.hashed_password = password_hash
            patient.is_active = True
            patient.first_time_login = False
            if worker_id and not patient.assigned_worker_id:
                patient.assigned_worker_id = worker_id

    db.commit()
    logger.info("Demo seed ensure complete (password=%s)", DEMO_PASSWORD)


def seed_sqlite_if_needed(engine, SessionLocal) -> None:
    if engine.dialect.name != "sqlite":
        return
    db = SessionLocal()
    try:
        ensure_demo_seeds(db)
    except Exception as exc:
        db.rollback()
        logger.warning("SQLite demo seed failed: %s", exc)
    finally:
        db.close()
