from hypothesis import given, settings
from hypothesis import strategies as st

from app.domain.scoring import calculate_score


@settings(max_examples=1_000, deadline=None)
@given(
    income=st.integers(min_value=100_000, max_value=999_999_999),
    stability=st.integers(min_value=0, max_value=600),
    total=st.integers(min_value=1, max_value=12),
    on_time=st.integers(min_value=0, max_value=12),
    amount=st.integers(min_value=1, max_value=50_000_000),
    tenure=st.integers(min_value=0, max_value=600),
    observed=st.integers(min_value=6, max_value=12),
    regular=st.integers(min_value=0, max_value=12),
)
def test_score_is_bounded_and_deterministic_for_complete_inputs(
    income: int,
    stability: int,
    total: int,
    on_time: int,
    amount: int,
    tenure: int,
    observed: int,
    regular: int,
) -> None:
    on_time = min(on_time, total)
    regular = min(regular, observed)
    data = {
        "income": {
            "availability": "provided",
            "monthlyIncomeCop": f"{income}.00",
            "stabilityMonths": stability,
        },
        "utilities": {
            "availability": "provided",
            "references": [
                {
                    "totalObligations": total,
                    "onTimeCount": on_time,
                    "lateCount": total - on_time,
                    "missedCount": 0,
                    "observedMonths": max(6, total),
                    "averageMonthlyAmountCop": f"{amount}.00",
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
    first = calculate_score(data)
    assert first == calculate_score(data)
    assert first["score"] is not None
    assert 300 <= first["score"] <= 850
    assert len(first["factors"]) == 3
