from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, PlainTextResponse
from starlette.middleware.base import RequestResponseEndpoint
from starlette.responses import Response

from app.api.health import router as health_router
from app.api.problems import problem
from app.api.scoring import router as scoring_router
from app.observability.logging import configure_logging
from app.observability.metrics import record_request, render_metrics, timer

configure_logging()
app = FastAPI(title="Motor interno de scoring", version="1.0.0", docs_url=None, redoc_url=None)
app.include_router(health_router)
app.include_router(scoring_router)


@app.get("/metrics", include_in_schema=False)
async def metrics() -> PlainTextResponse:
    return PlainTextResponse(render_metrics(), media_type="text/plain; version=0.0.4")


@app.middleware("http")
async def request_context(request: Request, call_next: RequestResponseEndpoint) -> Response:
    started = timer()
    candidate = request.headers.get("X-Request-Id", "")
    try:
        request_id = str(UUID(candidate))
    except ValueError:
        request_id = str(uuid4())
    request.state.request_id = request_id
    content_length = request.headers.get("content-length")
    response: Response
    if content_length and content_length.isdigit() and int(content_length) > 262_144:
        response = problem(
            request,
            413,
            "PAYLOAD_TOO_LARGE",
            "Solicitud demasiado grande",
            "El cuerpo de la solicitud no puede superar 256 KiB.",
        )
    else:
        response = await call_next(request)
    record_request(request.method, response.status_code, started)
    response.headers["X-Request-Id"] = request_id
    return response


@app.exception_handler(HTTPException)
async def http_problem(request: Request, exc: HTTPException) -> JSONResponse:
    code = {
        400: "INTERNAL_BAD_REQUEST",
        401: "INTERNAL_UNAUTHORIZED",
        409: "CRITERIA_VERSION_UNAVAILABLE",
        413: "PAYLOAD_TOO_LARGE",
    }.get(exc.status_code, "INTERNAL_FAILURE")
    return problem(request, exc.status_code, code, "Solicitud rechazada", str(exc.detail))


@app.exception_handler(RequestValidationError)
async def validation_problem(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [
        {
            "field": ".".join(str(part) for part in error["loc"] if part != "body"),
            "code": "INVALID_VALUE",
            "message": "Revise el valor enviado para este campo.",
        }
        for error in exc.errors()
    ]
    return problem(
        request,
        422,
        "VALIDATION_FAILED",
        "Datos internos inválidos",
        "Revise los campos indicados.",
        errors=errors,
    )
