from tests.unit.test_scoring_profiles import normalized

from app.domain.scoring import calculate_score


def test_every_known_profile_is_stable_across_repeated_evaluations() -> None:
    expected = {
        "low": (835, "riesgo_bajo", "evaluada"),
        "medium": (634, "riesgo_medio", "revision_manual"),
        "high": (385, "riesgo_alto", "evaluada"),
    }

    for profile, decision in expected.items():
        results = [calculate_score(normalized(profile)) for _ in range(100)]
        assert all(result == results[0] for result in results)
        assert (
            results[0]["score"],
            results[0]["riskBand"],
            results[0]["status"],
        ) == decision
