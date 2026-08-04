from decimal import Decimal


def build_factors(indices: dict[str, Decimal]) -> list[dict[str, object]]:
    weights = {"utility": Decimal("0.4"), "mobile": Decimal("0.3"), "income": Decimal("0.3")}
    labels = {"utility": "servicios públicos", "mobile": "telefonía móvil", "income": "ingresos"}
    tie = {"utility": 0, "mobile": 1, "income": 2}
    factors: list[dict[str, object]] = []
    for dimension, index in indices.items():
        direction = "favorable" if index > 50 else "neutral" if index == 50 else "unfavorable"
        contribution = Decimal("5.5") * weights[dimension] * index
        factors.append(
            {
                "dimension": dimension,
                "direction": direction,
                "dimensionIndex": f"{index:.3f}",
                "weight": f"{weights[dimension]:.3f}",
                "contributionPoints": f"{contribution:.3f}",
                "observedSummary": f"Índice de {labels[dimension]}: {index:.1f} de 100.",
                "ruleCode": f"{dimension.upper()}_INDEX",
                "explanation": (
                    f"La información declarada de {labels[dimension]} tiene un aporte "
                    f"{direction} al resultado."
                ),
            }
        )
    factors.sort(
        key=lambda f: (-abs(Decimal(str(f["contributionPoints"]))), tie[str(f["dimension"])])
    )
    for rank, factor in enumerate(factors, 1):
        factor["rank"] = rank
    return factors
