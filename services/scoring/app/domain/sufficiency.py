from datetime import date
from typing import Any

MESSAGES = {
    "MISSING_UTILITY_DATA": ("utility", "Faltan referencias suficientes de servicios públicos."),
    "UTILITY_PERIOD_TOO_SHORT": (
        "utility",
        "Las referencias de servicios deben cubrir al menos 6 meses.",
    ),
    "UTILITY_COUNTS_INCONSISTENT": (
        "utility",
        "Los conteos de servicios declarados son inconsistentes.",
    ),
    "UTILITY_PERIODS_OVERLAP": (
        "utility",
        "Los períodos de referencias de servicios no deben superponerse.",
    ),
    "ZERO_OR_MISSING_UTILITY_AMOUNT": (
        "utility",
        "El monto mensual de servicios debe ser mayor que cero.",
    ),
    "MISSING_MOBILE_DATA": ("mobile", "Faltan datos de telefonía móvil."),
    "MOBILE_PERIOD_TOO_SHORT": ("mobile", "La regularidad móvil debe cubrir al menos 6 meses."),
    "MOBILE_COUNTS_INCONSISTENT": (
        "mobile",
        "Los meses regulares no coinciden con el período observado.",
    ),
    "MISSING_INCOME": ("income", "Faltan datos de ingresos estimados."),
    "MISSING_INCOME_STABILITY": ("income", "Falta la antigüedad de la fuente de ingresos."),
}
ORDER = [
    "MISSING_UTILITY_DATA",
    "UTILITY_PERIOD_TOO_SHORT",
    "UTILITY_COUNTS_INCONSISTENT",
    "UTILITY_PERIODS_OVERLAP",
    "ZERO_OR_MISSING_UTILITY_AMOUNT",
    "MISSING_MOBILE_DATA",
    "MOBILE_PERIOD_TOO_SHORT",
    "MOBILE_COUNTS_INCONSISTENT",
    "MISSING_INCOME",
    "MISSING_INCOME_STABILITY",
]


def manual_reasons(data: dict[str, Any]) -> list[dict[str, str]]:
    codes: set[str] = set()
    utilities = data.get("utilities", {})
    if utilities.get("availability") != "provided" or not utilities.get("references"):
        codes.add("MISSING_UTILITY_DATA")
    else:
        periods: list[tuple[date, date]] = []
        for ref in utilities["references"]:
            if ref.get("observedMonths", 0) < 6:
                codes.add("UTILITY_PERIOD_TOO_SHORT")
            total = ref.get("totalObligations", -1)
            if (
                total <= 0
                or ref.get("onTimeCount", 0) + ref.get("lateCount", 0) + ref.get("missedCount", 0)
                != total
            ):
                codes.add("UTILITY_COUNTS_INCONSISTENT")
            if float(ref.get("averageMonthlyAmountCop", 0)) <= 0:
                codes.add("ZERO_OR_MISSING_UTILITY_AMOUNT")
            try:
                start = date.fromisoformat(str(ref["periodStart"]))
                end = date.fromisoformat(str(ref["periodEnd"]))
                if end < start:
                    codes.add("UTILITY_COUNTS_INCONSISTENT")
                if any(
                    start <= existing_end and end >= existing_start
                    for existing_start, existing_end in periods
                ):
                    codes.add("UTILITY_PERIODS_OVERLAP")
                periods.append((start, end))
            except (KeyError, ValueError):
                pass
    mobile = data.get("mobile", {})
    if mobile.get("availability") != "provided":
        codes.add("MISSING_MOBILE_DATA")
    else:
        if mobile.get("observedMonths", 0) < 6:
            codes.add("MOBILE_PERIOD_TOO_SHORT")
        if mobile.get("regularMonths", 0) > mobile.get("observedMonths", 0):
            codes.add("MOBILE_COUNTS_INCONSISTENT")
    income = data.get("income", {})
    if income.get("availability") != "provided":
        codes.add("MISSING_INCOME")
    elif income.get("stabilityMonths") is None:
        codes.add("MISSING_INCOME_STABILITY")
    return [
        {"code": code, "dimension": MESSAGES[code][0], "message": MESSAGES[code][1]}
        for code in ORDER
        if code in codes
    ]
