from decimal import Decimal


def ratio_index(value: Decimal) -> Decimal:
    if value >= Decimal("1"):
        return Decimal(100)
    if value >= Decimal("0.9"):
        return Decimal(85)
    if value >= Decimal("0.75"):
        return Decimal(65)
    if value >= Decimal("0.5"):
        return Decimal(40)
    return Decimal(10)


def tenure_index(months: int) -> Decimal:
    if months >= 60:
        return Decimal(100)
    if months >= 36:
        return Decimal(85)
    if months >= 24:
        return Decimal(70)
    if months >= 12:
        return Decimal(50)
    if months >= 6:
        return Decimal(30)
    return Decimal(10)


def stability_index(months: int) -> Decimal:
    if months >= 36:
        return Decimal(100)
    if months >= 24:
        return Decimal(80)
    if months >= 12:
        return Decimal(60)
    if months >= 6:
        return Decimal(40)
    return Decimal(20)


def coverage_index(value: Decimal) -> Decimal:
    if value >= Decimal(8):
        return Decimal(100)
    if value >= Decimal(5):
        return Decimal(80)
    if value >= Decimal(3):
        return Decimal(60)
    if value >= Decimal("1.5"):
        return Decimal(40)
    return Decimal(20)
