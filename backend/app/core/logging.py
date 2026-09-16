import logging
from collections.abc import MutableMapping
from typing import Any

import structlog

from app.core.config import get_settings

# Substrings matched case-insensitively against event-dict keys. Any key
# containing one of these is redacted, at any nesting depth, because a
# structured log line must never leak an OTP, phone number, token,
# coordinate, message body or photo URL.
REDACTED_KEY_SUBSTRINGS = (
    "phone",
    "otp",
    "token",
    "password",
    "secret",
    "lat",
    "lon",
    "latitude",
    "longitude",
    "body",
    "url",
)
REDACTED_VALUE = "[REDACTED]"


def _is_sensitive_key(key: str) -> bool:
    lowered = key.lower()
    return any(substring in lowered for substring in REDACTED_KEY_SUBSTRINGS)


def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: REDACTED_VALUE if _is_sensitive_key(key) else _redact(nested)
            for key, nested in value.items()
        }
    if isinstance(value, list):
        return [_redact(item) for item in value]
    return value


def redact_sensitive_fields(
    _logger: Any, _method_name: str, event_dict: MutableMapping[str, Any]
) -> MutableMapping[str, Any]:
    return {
        key: REDACTED_VALUE if _is_sensitive_key(key) else _redact(value)
        for key, value in event_dict.items()
    }


def configure_logging() -> None:
    log_level = get_settings().log_level.upper()
    logging.basicConfig(level=log_level, format="%(message)s")

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            redact_sensitive_fields,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.getLevelName(log_level)),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )
