from uuid import UUID

from fastapi.testclient import TestClient

from app.criteria.loader import load_criteria
from app.main import app
from app.settings import get_settings

EVALUATION_ID = "20000000-0000-4000-8000-000000000001"
REQUEST_ID = "50000000-0000-4000-8000-000000000001"
INPUT_HASH = f"sha256:{'a' * 64}"


def request_payload() -> dict:
    return {
        "evaluationId": EVALUATION_ID,
        "criteriaVersion": "SCORING-MVP-1.0.0",
        "inputSchemaVersion": "1.0.0",
        "inputHash": INPUT_HASH,
        "income": {
            "availability": "provided",
            "monthlyIncomeCop": "4000000.00",
            "stabilityMonths": 48,
        },
        "utilities": {
            "availability": "provided",
            "references": [
                {
                    "serviceType": "electricity",
                    "periodStart": "2025-08-01",
                    "periodEnd": "2026-07-31",
                    "observedMonths": 12,
                    "totalObligations": 12,
                    "onTimeCount": 12,
                    "lateCount": 0,
                    "missedCount": 0,
                    "averageMonthlyAmountCop": "250000.00",
                }
            ],
        },
        "mobile": {
            "availability": "provided",
            "mode": "postpaid",
            "tenureMonths": 48,
            "observedMonths": 12,
            "regularMonths": 12,
        },
    }


def headers() -> dict[str, str]:
    return {
        "X-Request-Id": REQUEST_ID,
        "X-Evaluation-Id": EVALUATION_ID,
        "X-Scoring-Service-Token": get_settings().scoring_service_token or "",
    }


def test_calculate_score_returns_contractual_explainable_result() -> None:
    response = TestClient(app).post(
        "/internal/v1/scores", json=request_payload(), headers=headers()
    )
    assert response.status_code == 200
    body = response.json()
    assert UUID(body["evaluationId"]) == UUID(EVALUATION_ID)
    assert body["inputHash"] == INPUT_HASH
    assert body["criteriaVersion"] == "SCORING-MVP-1.0.0"
    assert (body["score"], body["riskBand"], body["status"]) == (
        835,
        "riesgo_bajo",
        "evaluada",
    )
    assert len(body["factors"]) == 3
    assert [factor["rank"] for factor in body["factors"]] == [1, 2, 3]
    assert response.headers["x-evaluation-id"] == EVALUATION_ID
    assert response.headers["x-request-id"] == REQUEST_ID
    assert response.headers["x-criteria-checksum"] == load_criteria()[1]


def test_rejects_recursively_nested_pii_and_extra_properties() -> None:
    payload = request_payload()
    payload["income"]["applicant"] = {"documentNumber": "1001032"}
    response = TestClient(app).post("/internal/v1/scores", json=payload, headers=headers())
    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")
    assert "1001032" not in response.text
