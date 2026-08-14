"""Demo authentication flows used in interviews."""

import pytest

DEMO_STAFF = [
    ("frontline.staff@bloomcare.health", "FRONTLINE_STAFF"),
    ("hospitaladmin@bloomcare.health", "ADMIN"),
    ("obsertitian@bloomcare.health", "CLINICAL_SPECIALIST"),
]


@pytest.mark.parametrize("email,expected_role", DEMO_STAFF)
def test_staff_demo_login(client, demo_password, email, expected_role):
    response = client.post(
        "/api/v1/auth/login/staff",
        json={"email": email, "password": demo_password},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["role"] == expected_role
    assert body.get("access_token")
    assert body.get("is_first_login") is False


def test_staff_login_rejects_bad_password(client):
    response = client.post(
        "/api/v1/auth/login/staff",
        json={
            "email": "frontline.staff@bloomcare.health",
            "password": "wrong-password",
        },
    )
    assert response.status_code in {400, 401, 403}


@pytest.mark.parametrize(
    "national_id",
    ["NIC-900000001V", "199912345678"],
)
def test_patient_demo_login(client, demo_password, national_id):
    response = client.post(
        "/api/v1/auth/login/patient",
        json={"national_id": national_id, "password": demo_password},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["role"] == "PATIENT"
    assert body.get("access_token")


def test_doctor_dashboard_requires_auth(client):
    response = client.get("/api/v1/dashboard/doctor/dashboard")
    assert response.status_code in {401, 403}


def test_doctor_dashboard_with_specialist_token(client, demo_password):
    login = client.post(
        "/api/v1/auth/login/staff",
        json={
            "email": "obsertitian@bloomcare.health",
            "password": demo_password,
        },
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    response = client.get(
        "/api/v1/dashboard/doctor/dashboard",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, response.text


def test_frontline_cannot_access_admin_dashboard(client, demo_password):
    login = client.post(
        "/api/v1/auth/login/staff",
        json={
            "email": "frontline.staff@bloomcare.health",
            "password": demo_password,
        },
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    response = client.get(
        "/api/v1/dashboard/admin/dashboard",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
