from app.domain.scoring import calculate_score


def test_unavailable_dimension_requires_manual_review_without_score() -> None:
    result = calculate_score(
        {
            "income": {"availability": "unavailable", "reason": "No cuenta con soporte"},
            "utilities": {"availability": "unavailable", "reason": "No tiene referencias"},
            "mobile": {"availability": "unavailable", "reason": "Sin información móvil"},
        }
    )
    assert result["status"] == "revision_manual"
    assert result["score"] is None and result["riskBand"] is None
    assert [reason["code"] for reason in result["manualReviewReasons"]] == [
        "MISSING_UTILITY_DATA",
        "MISSING_MOBILE_DATA",
        "MISSING_INCOME",
    ]


def test_short_contradictory_and_zero_denominator_data_is_manual() -> None:
    result = calculate_score(
        {
            "income": {
                "availability": "provided",
                "monthlyIncomeCop": "2000000.00",
                "stabilityMonths": 12,
            },
            "utilities": {
                "availability": "provided",
                "references": [
                    {
                        "periodStart": "2026-01-01",
                        "periodEnd": "2026-04-30",
                        "observedMonths": 4,
                        "totalObligations": 0,
                        "onTimeCount": 0,
                        "lateCount": 0,
                        "missedCount": 0,
                        "averageMonthlyAmountCop": "0.00",
                    }
                ],
            },
            "mobile": {
                "availability": "provided",
                "tenureMonths": 12,
                "observedMonths": 4,
                "regularMonths": 5,
            },
        }
    )
    assert result["resultType"] == "manual_review"
    assert result["score"] is None and result["factors"] == []
    assert [reason["code"] for reason in result["manualReviewReasons"]] == [
        "UTILITY_PERIOD_TOO_SHORT",
        "UTILITY_COUNTS_INCONSISTENT",
        "ZERO_OR_MISSING_UTILITY_AMOUNT",
        "MOBILE_PERIOD_TOO_SHORT",
        "MOBILE_COUNTS_INCONSISTENT",
    ]


def test_overlapping_periods_have_a_stable_reason_order() -> None:
    reference = {
        "observedMonths": 6,
        "totalObligations": 6,
        "onTimeCount": 6,
        "lateCount": 0,
        "missedCount": 0,
        "averageMonthlyAmountCop": "100000.00",
    }
    result = calculate_score(
        {
            "income": {
                "availability": "provided",
                "monthlyIncomeCop": "2000000.00",
                "stabilityMonths": 12,
            },
            "utilities": {
                "availability": "provided",
                "references": [
                    {**reference, "periodStart": "2025-01-01", "periodEnd": "2025-06-30"},
                    {**reference, "periodStart": "2025-06-01", "periodEnd": "2025-11-30"},
                ],
            },
            "mobile": {
                "availability": "provided",
                "tenureMonths": 12,
                "observedMonths": 6,
                "regularMonths": 6,
            },
        }
    )
    assert [reason["code"] for reason in result["manualReviewReasons"]] == [
        "UTILITY_PERIODS_OVERLAP"
    ]
