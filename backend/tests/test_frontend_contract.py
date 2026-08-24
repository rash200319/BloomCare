"""Contract checks: frontend demo credentials stay aligned with backend seeds."""

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
API_TS = REPO_ROOT / "frontend" / "lib" / "api.ts"


def test_frontend_demo_credentials_match_seeded_accounts():
    text = API_TS.read_text(encoding="utf-8")
    for needle in [
        "frontline.staff@bloomcare.health",
        "obstetrician@bloomcare.health",
        "NIC-900000001V",
        "199912345678",
        "rash2003",
        "127.0.0.1:8001",
        "DEMO_LOGIN_ENABLED",
    ]:
        assert needle in text, f"Missing expected demo/API constant: {needle}"
    # Admin credentials must not be autofilled on the public login UI
    assert "hospitaladmin@bloomcare.health" not in text
