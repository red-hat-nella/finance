import hmac
from typing import Annotated

from fastapi import Header, HTTPException

from app.settings import get_settings


def require_service_token(
    token: Annotated[str | None, Header(alias="X-Scoring-Service-Token")] = None,
) -> None:
    expected = get_settings().scoring_service_token or ""
    supplied = token or ""
    if not supplied or not hmac.compare_digest(supplied.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Credenciales de servicio inválidas.")
