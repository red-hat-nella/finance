from app.domain.scoring import calculate_score


def normalized(profile: str) -> dict:
    fixtures = {
        "low": (4_000_000, 48, 250_000, 12, 12, 48, 12, 12),
        "medium": (2_400_000, 14, 500_000, 12, 9, 18, 12, 10),
        "high": (1_200_000, 3, 600_000, 12, 5, 4, 10, 4),
    }
    income, stability, amount, obligations, on_time, tenure, observed, regular = fixtures[profile]
    return {
        "income": {
            "availability": "provided",
            "monthlyIncomeCop": str(income),
            "stabilityMonths": stability,
        },
        "utilities": {
            "availability": "provided",
            "references": [
                {
                    "serviceType": "water",
                    "observedMonths": 12,
                    "totalObligations": obligations,
                    "onTimeCount": on_time,
                    "lateCount": obligations - on_time,
                    "missedCount": 0,
                    "averageMonthlyAmountCop": str(amount),
                }
            ],
        },
        "mobile": {
            "availability": "provided",
            "tenureMonths": tenure,
            "observedMonths": observed,
            "regularMonths": regular,
        },
    }


def test_known_profiles_are_exact() -> None:
    expected = {
        "low": (835, "riesgo_bajo", "evaluada"),
        "medium": (634, "riesgo_medio", "revision_manual"),
        "high": (385, "riesgo_alto", "evaluada"),
    }
    for name, decision in expected.items():
        result = calculate_score(normalized(name))
        assert (result["score"], result["riskBand"], result["status"]) == decision
        assert len(result["factors"]) == 3


def test_same_input_is_deterministic() -> None:
    first = calculate_score(normalized("low"))
    assert all(calculate_score(normalized("low")) == first for _ in range(100))
