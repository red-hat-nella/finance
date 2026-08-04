from fastapi.testclient import TestClient

from app.main import app
from app.settings import get_settings

EVALUATION_ID = "20000000-0000-4000-8000-000000000004"


def headers() -> dict[str, str]:
    return {
        "X-Request-Id": "50000000-0000-4000-8000-000000000004",
        "X-Evaluation-Id": EVALUATION_ID,
        "X-Scoring-Service-Token": get_settings().scoring_service_token or "",
    }


def manual_payload() -> dict:
    return {
        "evaluationId": EVALUATION_ID,
        "criteriaVersion": "SCORING-MVP-1.0.0",
        "inputSchemaVersion": "1.0.0",
        "inputHash": f"sha256:{'b' * 64}",
        "income": {"availability": "unavailable", "reasonCode": "DATA_NOT_AVAILABLE"},
        "utilities": {"availability": "unavailable", "reasonCode": "PERIOD_NOT_AVAILABLE"},
        "mobile": {
            "availability": "unavailable",
            "reasonCode": "APPLICANT_COULD_NOT_PROVIDE_DATA",
        },
    }


def test_manual_review_has_no_invented_score_or_band() -> None:
    response = TestClient(app).post("/internal/v1/scores", json=manual_payload(), headers=headers())
    assert response.status_code == 200
    body = response.json()
    assert body["resultType"] == "manual_review"
    assert body["status"] == "revision_manual"
    assert body["score"] is None and body["riskBand"] is None and body["factors"] == []
    assert [reason["code"] for reason in body["manualReviewReasons"]] == [
        "MISSING_UTILITY_DATA",
        "MISSING_MOBILE_DATA",
        "MISSING_INCOME",
    ]


def test_unknown_criteria_version_is_a_contractual_conflict() -> None:
    payload = manual_payload()
    payload["criteriaVersion"] = "SCORING-MVP-9.9.9"
    response = TestClient(app).post("/internal/v1/scores", json=payload, headers=headers())
    assert response.status_code == 409
    assert response.json()["code"] == "CRITERIA_VERSION_UNAVAILABLE"


def test_invalid_shape_extra_properties_and_nested_pii_are_rejected_safely() -> None:
    for mutation in ("extra", "nested-pii", "invalid-range"):
        payload = manual_payload()
        if mutation == "extra":
            payload["unknown"] = True
        elif mutation == "nested-pii":
            payload["mobile"]["documentNumber"] = "1001032"
        else:
            payload["mobile"] = {
                "availability": "provided",
                "mode": "prepaid",
                "tenureMonths": -1,
                "observedMonths": 0,
                "regularMonths": 14,
            }
        response = TestClient(app).post("/internal/v1/scores", json=payload, headers=headers())
        assert response.status_code == 422
        assert response.headers["content-type"].startswith("application/problem+json")
        assert "1001032" not in response.text
