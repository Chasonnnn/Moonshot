import json
import logging
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.request_context import reset_request_id, set_request_id
from app.core.secrets import load_managed_secrets

load_managed_secrets()
settings = get_settings()
logger = logging.getLogger("moonshot.request")
if not logging.getLogger().handlers:
    logging.basicConfig(level=logging.INFO)

app = FastAPI(title=settings.app_name, version=settings.api_version)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


ERROR_CODE_BY_STATUS: dict[int, str] = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    422: "validation_error",
}
ERROR_CODE_BY_DETAIL: dict[str, str] = {
    "Missing Idempotency-Key header": "missing_idempotency_key",
    "coach is disabled in assessment_no_ai mode": "coach_disabled_for_mode",
}


def _request_id_for(request: Request) -> str:
    request_id = getattr(request.state, "request_id", None)
    if isinstance(request_id, str) and request_id:
        return request_id
    header_id = request.headers.get("x-request-id")
    if isinstance(header_id, str) and header_id:
        return header_id
    return str(uuid4())


def _error_payload(*, request: Request, status_code: int, detail: str, error_code: str | None = None) -> dict[str, str]:
    resolved_error_code = error_code or ERROR_CODE_BY_DETAIL.get(detail) or ERROR_CODE_BY_STATUS.get(status_code, "internal_error")
    return {
        "detail": detail,
        "error_code": resolved_error_code,
        "error_detail": detail,
        "request_id": _request_id_for(request),
    }


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid4())
    request.state.request_id = request_id
    token = set_request_id(request_id)
    started = perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        latency_ms = max(1, int((perf_counter() - started) * 1000))
        logger.exception(
            json.dumps(
                {
                    "event": "request_failed",
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "latency_ms": latency_ms,
                    "status_code": 500,
                }
            )
        )
        raise
    finally:
        reset_request_id(token)

    latency_ms = max(1, int((perf_counter() - started) * 1000))
    response.headers["X-Request-Id"] = request_id
    logger.info(
        json.dumps(
            {
                "event": "request_completed",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "latency_ms": latency_ms,
                "status_code": response.status_code,
            }
        )
    )
    return response


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = str(exc.detail) if exc.detail is not None else "Request failed"
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_payload(request=request, status_code=exc.status_code, detail=detail),
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, _exc: RequestValidationError):
    detail = "Request validation failed"
    return JSONResponse(
        status_code=422,
        content=_error_payload(request=request, status_code=422, detail=detail, error_code="validation_error"),
    )


app.include_router(api_router)
