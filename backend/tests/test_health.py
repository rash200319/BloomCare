"""Health and OpenAPI smoke tests."""


def test_root_health(client):
    response = client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert body.get("status") == "healthy"
    assert "BloomCare" in body.get("service", "")


def test_openapi_docs_available(client):
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert schema.get("info", {}).get("title")
    paths = schema.get("paths", {})
    assert "/api/v1/auth/login/staff" in paths
    assert "/api/v1/auth/login/patient" in paths
