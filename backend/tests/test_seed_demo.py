"""Demo-seed checks against the active runtime DB (SQLite fallback or Postgres)."""

from backend.db.seed_demo import DEMO_PASSWORD, ensure_demo_seeds
from backend.db.session import SessionLocal
from backend.models.patient import Patient
from backend.models.user import User, UserRole


def test_ensure_demo_seeds_creates_expected_accounts():
    db = SessionLocal()
    try:
        ensure_demo_seeds(db)

        emails = {u.email for u in db.query(User).all()}
        assert "frontline.staff@bloomcare.health" in emails
        assert "hospitaladmin@bloomcare.health" in emails
        assert "obstetrician@bloomcare.health" in emails

        doctor = (
            db.query(User)
            .filter(User.email == "obstetrician@bloomcare.health")
            .one()
        )
        assert doctor.role == UserRole.CLINICAL_SPECIALIST
        assert doctor.first_time_login is False

        nics = {p.national_id for p in db.query(Patient).all()}
        assert "NIC-900000001V" in nics
        assert "199912345678" in nics
        assert DEMO_PASSWORD == "rash2003"
    finally:
        db.close()


def test_ensure_demo_seeds_is_idempotent():
    db = SessionLocal()
    try:
        ensure_demo_seeds(db)
        before = {
            u.email: (u.role, u.hashed_password)
            for u in db.query(User)
            .filter(
                User.email.in_(
                    [
                        "frontline.staff@bloomcare.health",
                        "hospitaladmin@bloomcare.health",
                        "obstetrician@bloomcare.health",
                    ]
                )
            )
            .all()
        }
        ensure_demo_seeds(db)
        after = {
            u.email: (u.role, u.hashed_password)
            for u in db.query(User)
            .filter(User.email.in_(list(before.keys())))
            .all()
        }
        assert set(before.keys()) == set(after.keys())
        assert len(after) == 3
    finally:
        db.close()
