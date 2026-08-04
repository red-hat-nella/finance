from fastapi import APIRouter, HTTPException

from app.criteria.loader import load_criteria
from app.settings import get_settings

router = APIRouter()


@router.get("/health/live")
def live() -> dict[str, str]:
    return {"status": "ok", "service": "scoring", "version": "1.0.0"}


@router.get("/health/ready")
def ready() -> dict[str, str]:
    settings = get_settings()
    criteria, checksum = load_criteria()
    if (
        not settings.scoring_service_token
        or len(settings.scoring_service_token) < 32
        or settings.criteria_version != criteria["version"]
    ):
        raise HTTPException(status_code=503, detail="service configuration is not ready")
    return {
        "status": "ready",
        "service": "scoring",
        "criteriaVersion": str(criteria["version"]),
        "criteriaChecksum": checksum,
    }
