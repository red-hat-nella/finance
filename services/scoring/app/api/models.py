from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class UnavailableDimension(StrictModel):
    availability: Literal["unavailable"]
    reasonCode: Literal[
        "APPLICANT_COULD_NOT_PROVIDE_DATA", "DATA_NOT_AVAILABLE", "PERIOD_NOT_AVAILABLE"
    ]


class IncomeProvided(StrictModel):
    availability: Literal["provided"]
    monthlyIncomeCop: str = Field(
        pattern=r"^(?:0\.(?:0[1-9]|[1-9][0-9])|[1-9][0-9]{0,8}\.[0-9]{2})$"
    )
    stabilityMonths: int = Field(ge=0, le=600)


class UtilityReference(StrictModel):
    serviceType: Literal["electricity", "water", "gas", "internet", "other"]
    periodStart: date
    periodEnd: date
    observedMonths: int = Field(ge=1, le=12)
    totalObligations: int = Field(ge=1, le=12)
    onTimeCount: int = Field(ge=0, le=12)
    lateCount: int = Field(ge=0, le=12)
    missedCount: int = Field(ge=0, le=12)
    averageMonthlyAmountCop: str = Field(
        pattern=r"^(?:0\.(?:0[1-9]|[1-9][0-9])|[1-9][0-9]{0,8}\.[0-9]{2})$"
    )


class UtilitiesProvided(StrictModel):
    availability: Literal["provided"]
    references: list[UtilityReference] = Field(min_length=1, max_length=3)


class MobileProvided(StrictModel):
    availability: Literal["provided"]
    mode: Literal["prepaid", "postpaid"]
    tenureMonths: int = Field(ge=0, le=600)
    observedMonths: int = Field(ge=1, le=12)
    regularMonths: int = Field(ge=0, le=12)


IncomeDimension = Annotated[
    IncomeProvided | UnavailableDimension, Field(discriminator="availability")
]
UtilitiesDimension = Annotated[
    UtilitiesProvided | UnavailableDimension, Field(discriminator="availability")
]
MobileDimension = Annotated[
    MobileProvided | UnavailableDimension, Field(discriminator="availability")
]


class ScoreRequest(StrictModel):
    evaluationId: UUID
    criteriaVersion: str = Field(min_length=1, max_length=64)
    inputSchemaVersion: Literal["1.0.0"]
    inputHash: str = Field(pattern=r"^sha256:[a-f0-9]{64}$")
    income: IncomeDimension
    utilities: UtilitiesDimension
    mobile: MobileDimension


class ScoreScale(StrictModel):
    minimum: Literal[300] = 300
    maximum: Literal[850] = 850


class Recommendation(StrictModel):
    code: Literal[
        "CONTINUE_HUMAN_ANALYSIS",
        "MANUAL_REVIEW_REQUIRED",
        "DO_NOT_CONTINUE_WITHOUT_DOCUMENTED_HUMAN_DECISION",
    ]
    text: str = Field(min_length=1, max_length=240)


class Factor(StrictModel):
    rank: int = Field(ge=1, le=3)
    dimension: Literal["utility", "mobile", "income"]
    direction: Literal["favorable", "unfavorable", "neutral"]
    dimensionIndex: str = Field(pattern=r"^[0-9]{1,3}\.[0-9]{3}$")
    weight: str = Field(pattern=r"^0\.[0-9]{3}$")
    contributionPoints: str = Field(pattern=r"^[0-9]{1,3}\.[0-9]{3}$")
    observedSummary: str = Field(min_length=1, max_length=240)
    ruleCode: str = Field(min_length=1, max_length=64)
    explanation: str = Field(min_length=1, max_length=320)


class ManualReviewReason(StrictModel):
    code: str = Field(min_length=1, max_length=64)
    dimension: Literal["utility", "mobile", "income", "explanation"]
    message: str = Field(min_length=1, max_length=240)


class ScoreResponse(StrictModel):
    resultType: Literal["scored", "manual_review"]
    evaluationId: UUID
    status: Literal["evaluada", "revision_manual"]
    score: int | None = Field(default=None, ge=300, le=850)
    scoreScale: ScoreScale = Field(default_factory=ScoreScale)
    riskBand: Literal["riesgo_bajo", "riesgo_medio", "riesgo_alto"] | None
    recommendation: Recommendation
    factors: list[Factor] = Field(max_length=3)
    manualReviewReasons: list[ManualReviewReason]
    criteriaVersion: Literal["SCORING-MVP-1.0.0"]
    inputHash: str = Field(pattern=r"^sha256:[a-f0-9]{64}$")
    calculatedAt: datetime


class FieldError(StrictModel):
    field: str
    code: str
    message: str


class Problem(StrictModel):
    type: str
    title: str
    status: int = Field(ge=400, le=599)
    detail: str
    instance: str
    code: str
    correlationId: UUID
    retryable: bool
    errors: list[FieldError] = Field(default_factory=list, max_length=50)
