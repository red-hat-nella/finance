from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from app.domain.dimensions import coverage_index, ratio_index, stability_index, tenure_index
from app.domain.explanations import build_factors
from app.domain.sufficiency import manual_reasons


def score_from_weighted_index(weighted: Decimal) -> int:
    score = int(
        (Decimal(300) + Decimal("5.5") * weighted).quantize(Decimal(1), rounding=ROUND_HALF_UP)
    )
    return min(850, max(300, score))


def classify_score(score: int) -> tuple[str, str, str, str]:
    if score >= 700:
        return (
            "riesgo_bajo",
            "evaluada",
            "CONTINUE_HUMAN_ANALYSIS",
            "Continuar con el análisis crediticio humano.",
        )
    if score >= 550:
        return (
            "riesgo_medio",
            "revision_manual",
            "MANUAL_REVIEW_REQUIRED",
            "Realizar revisión manual obligatoria.",
        )
    return (
        "riesgo_alto",
        "evaluada",
        "DO_NOT_CONTINUE_WITHOUT_DOCUMENTED_HUMAN_DECISION",
        "No continuar salvo decisión humana documentada.",
    )


def calculate_score(data: dict[str, Any]) -> dict[str, Any]:
    reasons = manual_reasons(data)
    if reasons:
        return {
            "resultType": "manual_review",
            "status": "revision_manual",
            "score": None,
            "riskBand": None,
            "recommendation": {
                "code": "MANUAL_REVIEW_REQUIRED",
                "text": "Realizar revisión manual obligatoria.",
            },
            "factors": [],
            "manualReviewReasons": reasons,
        }
    references = data["utilities"]["references"]
    total = sum(int(ref["totalObligations"]) for ref in references)
    on_time = sum(int(ref["onTimeCount"]) for ref in references)
    utility_amount = sum(Decimal(str(ref["averageMonthlyAmountCop"])) for ref in references)
    utility = ratio_index(Decimal(on_time) / Decimal(total))
    mobile_data = data["mobile"]
    mobile = Decimal("0.6") * tenure_index(int(mobile_data["tenureMonths"])) + Decimal(
        "0.4"
    ) * ratio_index(Decimal(mobile_data["regularMonths"]) / Decimal(mobile_data["observedMonths"]))
    income_data = data["income"]
    income = Decimal("0.6") * stability_index(int(income_data["stabilityMonths"])) + Decimal(
        "0.4"
    ) * coverage_index(Decimal(str(income_data["monthlyIncomeCop"])) / utility_amount)
    indices = {"utility": utility, "mobile": mobile, "income": income}
    weighted = Decimal("0.4") * utility + Decimal("0.3") * mobile + Decimal("0.3") * income
    score = score_from_weighted_index(weighted)
    band, status, code, text = classify_score(score)
    medium_reason = (
        [
            {
                "code": "MEDIUM_RISK_BAND",
                "dimension": "explanation",
                "message": "La banda de riesgo medio requiere revisión humana.",
            }
        ]
        if status == "revision_manual"
        else []
    )
    return {
        "resultType": "scored",
        "status": status,
        "score": score,
        "riskBand": band,
        "recommendation": {"code": code, "text": text},
        "factors": build_factors(indices),
        "manualReviewReasons": medium_reason,
    }
