from fastapi.testclient import TestClient

from app.main import app


def test_health_does_not_expose_topology() -> None:
    response = TestClient(app).get(
        "/health/live", headers={"X-Request-Id": "c594ca64-2d99-4db7-9d9b-41507075ee45"}
    )
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "scoring", "version": "1.0.0"}
    assert response.headers["x-request-id"] == "c594ca64-2d99-4db7-9d9b-41507075ee45"


def test_score_requires_service_token() -> None:
    response = TestClient(app).post("/internal/v1/scores", json={})
    assert response.status_code == 401
    assert response.headers["content-type"].startswith("application/problem+json")


def test_readiness_confirms_loaded_criteria_checksum() -> None:
    response = TestClient(app).get("/health/ready")
    assert response.status_code == 200
    assert response.json()["criteriaVersion"] == "SCORING-MVP-1.0.0"
    assert len(response.json()["criteriaChecksum"]) == 64
