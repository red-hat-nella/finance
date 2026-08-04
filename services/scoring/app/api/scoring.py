from datetime import UTC, datetime
from time import perf_counter
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response

from app.api.models import ScoreRequest, ScoreResponse
from app.api.security import require_service_token
from app.criteria.loader import CRITERIA_VERSION, load_criteria
from app.domain.scoring import calculate_score

router = APIRouter()
logger = structlog.get_logger("scoring")


@router.post(
    "/internal/v1/scores",
    dependencies=[Depends(require_service_token)],
    response_model=ScoreResponse,
    response_model_exclude_none=False,
)
async def score(
    payload: ScoreRequest,
    request: Request,
    response: Response,
    evaluation_header: Annotated[UUID, Header(alias="X-Evaluation-Id")],
) -> ScoreResponse:
    started = perf_counter()
    if evaluation_header != payload.evaluationId:
        raise HTTPException(status_code=400, detail="El identificador de evaluación no coincide.")
    if payload.criteriaVersion != CRITERIA_VERSION:
        raise HTTPException(status_code=409, detail="La versión de criterios no está disponible.")

    _, checksum = load_criteria()
    normalized = payload.model_dump(mode="json", include={"income", "utilities", "mobile"})
    result = calculate_score(normalized)
    calculated_at = datetime.now(UTC)
    response.headers["X-Evaluation-Id"] = str(payload.evaluationId)
    response.headers["X-Criteria-Checksum"] = checksum

    model = ScoreResponse.model_validate(
        {
            **result,
            "evaluationId": payload.evaluationId,
            "scoreScale": {"minimum": 300, "maximum": 850},
            "criteriaVersion": CRITERIA_VERSION,
            "inputHash": payload.inputHash,
            "calculatedAt": calculated_at,
        }
    )
    await logger.ainfo(
        "score.calculated",
        request_id=request.state.request_id,
        evaluation_id=str(payload.evaluationId),
        criteria_version=CRITERIA_VERSION,
        result_type=model.resultType,
        duration_ms=round((perf_counter() - started) * 1000, 3),
    )
    return model
