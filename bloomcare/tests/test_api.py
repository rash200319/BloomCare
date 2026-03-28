"""
BloomCare – API Integration Tests
===================================
Run with:  pytest bloomcare/tests/test_api.py -v
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from bloomcare.main import app

client = TestClient(app)

# ─────────────────────────────────────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────────────────────────────────────

def test_root_health():
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


def test_detailed_health():
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    data = r.json()
    assert "components" in data


# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 – Triage Sync
# ─────────────────────────────────────────────────────────────────────────────

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


def test_triage_sync_success():
    r = client.post("/api/v1/triage/sync", json=TRIAGE_PAYLOAD)
    assert r.status_code == 201
    data = r.json()
    assert data["patient_id"] == "TEST-001"
    assert data["escalation_required"] is True
    assert isinstance(data["triage_flags"], list)


def test_triage_sync_low_risk():
    low_payload = {**TRIAGE_PAYLOAD,
                   "blood_pressure": {"systolic": 118, "diastolic": 74},
                   "edge_risk_classification": "routine_care",
                   "edge_risk_score": 0.12}
    r = client.post("/api/v1/triage/sync", json=low_payload)
    assert r.status_code == 201
    assert r.json()["escalation_required"] is False


def test_triage_invalid_bp():
    bad = {**TRIAGE_PAYLOAD, "blood_pressure": {"systolic": 80, "diastolic": 90}}
    r = client.post("/api/v1/triage/sync", json=bad)
    assert r.status_code == 422  # Validation error


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 – Diagnose
# ─────────────────────────────────────────────────────────────────────────────

DIAGNOSE_PAYLOAD = {
    "patient_id": "TEST-001",
    "encounter_id": "ENC-TEST-001",
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


def test_diagnose_full_panel():
    r = client.post("/api/v1/diagnose", json=DIAGNOSE_PAYLOAD)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "success"
    ml = data["ml_output"]
    assert 0.0 <= ml["overall_severity_score"] <= 1.0
    assert len(ml["condition_probabilities"]) == 5
    assert "cluster_profile" in ml


def test_diagnose_minimal_biomarkers():
    """Should work with only sFlt-1/PlGF present."""
    minimal = {
        "patient_id": "TEST-002",
        "gestational_age_weeks": 32,
        "sflt1_plgf_ratio": 85.0,
    }
    r = client.post("/api/v1/diagnose", json=minimal)
    assert r.status_code == 200


def test_diagnose_missing_all_biomarkers():
    """Should fail validation when no biomarkers are present."""
    empty = {"patient_id": "TEST-003", "gestational_age_weeks": 32}
    r = client.post("/api/v1/diagnose", json=empty)
    assert r.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 – Assistant Explain
# ─────────────────────────────────────────────────────────────────────────────

def test_assistant_explain_mock():
    """Test with mock LLM (no OpenAI key required)."""
    # First get ML output from /diagnose
    diag_r = client.post("/api/v1/diagnose", json=DIAGNOSE_PAYLOAD)
    assert diag_r.status_code == 200
    ml_output = diag_r.json()["ml_output"]

    explain_payload = {
        "ml_output": ml_output,
        "requester_role": "frontline_health_worker",
    }
    r = client.post("/api/v1/assistant/explain", json=explain_payload)
    assert r.status_code == 200
    data = r.json()
    assert len(data["explanations"]) == 3
    langs = {e["language_code"] for e in data["explanations"]}
    assert langs == {"en", "si", "ta"}
    # All fields present
    for explanation in data["explanations"]:
        assert explanation["summary"]
        assert isinstance(explanation["clinical_next_steps"], list)
        assert explanation["patient_advice"]
    assert data["disclaimer"]
