"""
Auth FastAPI dependencies.

get_current_user: extracted from Authorization: Bearer header, validated JWT,
user fetched from DB, status checked — raises 401/403 on any failure.
"""

import uuid
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.db import get_db
from app.core.errors import AppError
from app.modules.auth.jwt_utils import decode_token
from app.modules.auth.providers import SmsProvider, get_fake_sms_provider
from app.modules.users import repository as user_repo
from app.modules.users.models import User, UserStatus

_bearer = HTTPBearer(auto_error=False)

# Statuses that block access to protected routes
_BLOCKED_STATUSES = {UserStatus.suspended, UserStatus.deactivated, UserStatus.deleted}


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    """Validate Bearer token and return the authenticated User.

    Raises:
        AppError(TOKEN_INVALID, 401) — missing/malformed/invalid token
        AppError(TOKEN_EXPIRED, 401) — valid but expired token
        AppError(ACCOUNT_UNAVAILABLE, 403) — suspended/deactivated/deleted
    """
    if credentials is None:
        raise AppError(
            code="TOKEN_INVALID",
            message="Authorization header missing.",
            status_code=401,
        )

    payload = decode_token(credentials.credentials, "access", settings)
    user_id = uuid.UUID(str(payload["sub"]))

    user = await user_repo.get_user_by_id(session, user_id)
    if user is None:
        raise AppError(code="TOKEN_INVALID", message="User not found.", status_code=401)

    if user.status in _BLOCKED_STATUSES:
        raise AppError(
            code="ACCOUNT_UNAVAILABLE",
            message="This account is not available.",
            status_code=403,
        )

    return user


async def get_sms_provider(
    settings: Settings = Depends(get_settings),
) -> SmsProvider:
    """Select the SMS provider based on config.
    CP-9 will add the real provider; for now only 'fake' is valid.
    """
    # settings.sms_provider == "fake" (the only valid value in CP-1)
    return get_fake_sms_provider()
