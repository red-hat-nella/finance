from decimal import Decimal

from app.domain.dimensions import coverage_index, ratio_index, stability_index, tenure_index
from app.domain.scoring import classify_score, score_from_weighted_index


def test_bucket_boundaries() -> None:
    assert ratio_index(Decimal("1")) == Decimal(100)
    assert ratio_index(Decimal(".9")) == Decimal(85)
    assert ratio_index(Decimal(".75")) == Decimal(65)
    assert ratio_index(Decimal(".5")) == Decimal(40)
    assert ratio_index(Decimal(".499")) == Decimal(10)
    assert tenure_index(60) == 100 and tenure_index(6) == 30 and tenure_index(5) == 10
    assert stability_index(36) == 100 and stability_index(6) == 40 and stability_index(5) == 20
    assert coverage_index(Decimal("8")) == 100 and coverage_index(Decimal("1.49")) == 20


def test_round_half_up_and_score_band_boundaries() -> None:
    assert score_from_weighted_index(Decimal("51")) == 581
    assert score_from_weighted_index(Decimal("-1")) == 300
    assert score_from_weighted_index(Decimal("101")) == 850
    assert classify_score(549)[:2] == ("riesgo_alto", "evaluada")
    assert classify_score(550)[:2] == ("riesgo_medio", "revision_manual")
    assert classify_score(699)[:2] == ("riesgo_medio", "revision_manual")
    assert classify_score(700)[:2] == ("riesgo_bajo", "evaluada")
