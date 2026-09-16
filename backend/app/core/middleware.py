import time
import uuid
from collections.abc import Awaitable, Callable

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import get_settings

logger = structlog.get_logger()


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assigns/propagates a request id (BR: request tracing) and emits a
    structured access log line. Never logs the request path under a key
    that would be caught by the logging redaction filter's `url` match —
    it is logged as `path`."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        header_name = get_settings().request_id_header
        request_id = request.headers.get(header_name) or str(uuid.uuid4())
        structlog.contextvars.bind_contextvars(request_id=request_id)

        started_at = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - started_at) * 1000, 2)

        response.headers[header_name] = request_id
        await logger.ainfo(
            "http_request",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
        )
        structlog.contextvars.unbind_contextvars("request_id")
        return response
