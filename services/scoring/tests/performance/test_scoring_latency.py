from time import perf_counter

from app.domain.scoring import calculate_score


def complete_input() -> dict:
    return {
        "income": {
            "availability": "provided",
            "monthlyIncomeCop": "4000000.00",
            "stabilityMonths": 48,
        },
        "utilities": {
            "availability": "provided",
            "references": [
                {
                    "totalObligations": 12,
                    "onTimeCount": 12,
                    "lateCount": 0,
                    "missedCount": 0,
                    "observedMonths": 12,
                    "averageMonthlyAmountCop": "250000.00",
                }
            ],
        },
        "mobile": {
            "availability": "provided",
            "tenureMonths": 48,
            "observedMonths": 12,
            "regularMonths": 12,
        },
    }


def test_scoring_p95_is_under_500_ms() -> None:
    durations: list[float] = []
    payload = complete_input()
    for _ in range(1_000):
        started = perf_counter()
        calculate_score(payload)
        durations.append((perf_counter() - started) * 1_000)
    durations.sort()
    p95 = durations[int(len(durations) * 0.95) - 1]
    assert p95 < 500
