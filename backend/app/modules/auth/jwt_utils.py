"""
JWT utilities: issue and decode access and refresh tokens.

Claims:
  sub  — user UUID (str)
  jti  — unique token ID (UUID str)
  iat  — issued at (int, UTC epoch)
  exp  — expiry (int, UTC epoch)
  typ  — "access" | "refresh"

Algorithm: HS256. Secret: settings.jwt_secret.
"""

import uuid
from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import Settings
from app.core.errors import AppError


def _issue(
    subject: uuid.UUID,
    token_type: str,
    ttl_seconds: int,
    settings: Settings,
) -> tuple[str, str]:
    """Return (raw_token, jti_str)."""
    jti = str(uuid.uuid4())
    now = datetime.now(tz=UTC)
    payload = {
        "sub": str(subject),
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=ttl_seconds)).timestamp()),
        "typ": token_type,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
    return token, jti


def create_access_token(user_id: uuid.UUID, settings: Settings) -> tuple[str, str]:
    """Return (access_token, jti)."""
    return _issue(user_id, "access", settings.jwt_access_ttl_seconds, settings)


def create_refresh_token(user_id: uuid.UUID, settings: Settings) -> tuple[str, str]:
    """Return (refresh_token, jti). Caller must store the token hash in DB."""
    return _issue(user_id, "refresh", settings.jwt_refresh_ttl_seconds, settings)


def decode_token(token: str, expected_type: str, settings: Settings) -> dict[str, object]:
    """Decode and validate a JWT.

    Raises AppError(TOKEN_EXPIRED, 401) or AppError(TOKEN_INVALID, 401).
    """
    try:
        payload: dict[str, object] = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            options={"require": ["sub", "jti", "exp", "typ"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise AppError(code="TOKEN_EXPIRED", message="Token has expired.", status_code=401) from exc
    except jwt.PyJWTError as exc:
        raise AppError(code="TOKEN_INVALID", message="Invalid token.", status_code=401) from exc

    if payload.get("typ") != expected_type:
        raise AppError(code="TOKEN_INVALID", message="Wrong token type.", status_code=401)

    return payload
