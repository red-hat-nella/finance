from fastapi import Request
from fastapi.responses import JSONResponse


def problem(
    request: Request,
    status: int,
    code: str,
    title: str,
    detail: str,
    *,
    retryable: bool = False,
    errors: list[dict[str, str]] | None = None,
) -> JSONResponse:
    request_id = request.state.request_id
    return JSONResponse(
        status_code=status,
        media_type="application/problem+json",
        content={
            "type": f"https://errors.example.test/{code.lower().replace('_', '-')}",
            "title": title,
            "status": status,
            "detail": detail,
            "instance": f"/problems/{request_id}",
            "code": code,
            "correlationId": request_id,
            "retryable": retryable,
            "errors": errors or [],
        },
    )
