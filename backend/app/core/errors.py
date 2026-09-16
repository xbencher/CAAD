from typing import Any

import structlog
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = structlog.get_logger()

_STATUS_CODE_TO_DEFAULT_CODE = {
    status.HTTP_400_BAD_REQUEST: "BAD_REQUEST",
    status.HTTP_401_UNAUTHORIZED: "UNAUTHORIZED",
    status.HTTP_403_FORBIDDEN: "FORBIDDEN",
    status.HTTP_404_NOT_FOUND: "NOT_FOUND",
    status.HTTP_409_CONFLICT: "CONFLICT",
    status.HTTP_422_UNPROCESSABLE_CONTENT: "VALIDATION_ERROR",
    status.HTTP_429_TOO_MANY_REQUESTS: "RATE_LIMITED",
    status.HTTP_503_SERVICE_UNAVAILABLE: "NOT_READY",
}


class AppError(Exception):
    """Raise from service/repository code for domain-level failures.
    Routers never need to know the HTTP status of a business error."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


def _envelope(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details or {}}}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        fields = [
            {"loc": list(error["loc"]), "message": error["msg"]} for error in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content=_envelope(
                "VALIDATION_ERROR", "Request validation failed.", {"fields": fields}
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(
        _request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        if isinstance(exc.detail, dict) and "error" in exc.detail:
            content = exc.detail
        else:
            code = _STATUS_CODE_TO_DEFAULT_CODE.get(exc.status_code, "HTTP_ERROR")
            message = exc.detail if isinstance(exc.detail, str) else code
            content = _envelope(code, message)
        return JSONResponse(status_code=exc.status_code, content=content, headers=exc.headers)

    @app.exception_handler(Exception)
    async def handle_unhandled_exception(_request: Request, exc: Exception) -> JSONResponse:
        await logger.aexception("unhandled_exception", error_type=type(exc).__name__)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_envelope("INTERNAL_ERROR", "An unexpected error occurred."),
        )
