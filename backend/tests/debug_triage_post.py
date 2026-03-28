import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[2]))
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

TRIAGE_PAYLOAD = {
    "patient_id": "TEST-001",
    "encounter_id": "ENC-TEST-001",
    "gestational_age_weeks": 28,
    "collected_at": "2026-03-28T07:00:00+05:30",
    "age": 31,
    "blood_pressure": {"systolic": 148, "diastolic": 96},
    "bmi": 29.4,
    "heart_rate": 88,
    "temperature": 37.1,
    "edge_risk_classification": "escalate",
    "edge_risk_score": 0.83,
    "device_id": "BLOOMCARE-MOB-001",
}

r = client.post("/api/v1/triage/sync", json=TRIAGE_PAYLOAD)
print('STATUS', r.status_code)
try:
    print('JSON', r.json())
except Exception as e:
    print('TEXT', r.text)
    print('ERR', e)
