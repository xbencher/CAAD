"""
Auth service — business logic for OTP flows, JWT issuance, refresh rotation,
and logout. No direct DB or Redis access; goes through repository/otp modules.
"""

import re
import time
import uuid
from datetime import UTC, datetime, timedelta

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import AppError
from app.core.ratelimit import check_rate_limit
from app.modules.auth import otp as otp_mod
from app.modules.auth import repository as auth_repo
from app.modules.auth.jwt_utils import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.modules.auth.providers import SmsProvider
from app.modules.auth.schemas import OtpVerifyResponse, TokenPair
from app.modules.users import repository as user_repo
from app.modules.users.service import is_phone_blocked

# BR-23: Indian mobile number — +91 followed by 10 digits starting 6–9
_INDIAN_PHONE_RE = re.compile(r"^\+91[6-9]\d{9}$")

# BR-23 rate limit windows
_OTP_REQ_PHONE_MAX = 3
_OTP_REQ_PHONE_WINDOW = 600   # 10 minutes
_OTP_REQ_IP_MAX = 10
_OTP_REQ_IP_WINDOW = 3600     # 1 hour


def _validate_indian_phone(phone: str) -> None:
    if not _INDIAN_PHONE_RE.match(phone):
        raise AppError(
            code="INVALID_PHONE",
            message=(
                "Phone must be a valid Indian mobile number "
                "(+91 followed by 10 digits starting 6–9)."
            ),
            status_code=400,
        )


async def request_otp(
    phone: str,
    client_ip: str,
    redis: Redis,
    session: AsyncSession,
    settings: Settings,
    sms_provider: SmsProvider,
) -> None:
    """Validate the phone, apply BR-23 rate limits, and send OTP.

    Always returns without error (caller returns 202) even if the phone is
    blocked — we never reveal whether an account exists.
    """
    _validate_indian_phone(phone)

    now = time.time()

    # BR-23: rate limits — applied before the blocked-hash check so we don't
    # short-circuit the limiter for blocked phones (prevents enumeration).
    await check_rate_limit(
        redis,
        key=f"rl:otp_req:phone:{phone}",
        max_calls=_OTP_REQ_PHONE_MAX,
        window_seconds=_OTP_REQ_PHONE_WINDOW,
        current_time=now,
    )
    await check_rate_limit(
        redis,
        key=f"rl:otp_req:ip:{client_ip}",
        max_calls=_OTP_REQ_IP_MAX,
        window_seconds=_OTP_REQ_IP_WINDOW,
        current_time=now,
    )

    # Blocked phone hashes silently skip SMS — never reveal to caller (BR-01)
    phone_hash = is_phone_blocked(phone, settings.phone_hash_pepper)
    block = await user_repo.get_phone_hash_block(session, phone_hash)
    if block and block.blocked_until > datetime.now(tz=UTC):
        return  # silently skip — caller still returns 202

    code = otp_mod.generate_otp()
    await otp_mod.store_otp(redis, phone, code, settings.otp_pepper)
    await sms_provider.send_otp(phone, code)


async def verify_otp_and_login(
    phone: str,
    code: str,
    device_id: str,
    redis: Redis,
    session: AsyncSession,
    settings: Settings,
) -> OtpVerifyResponse:
    """Verify OTP, create/fetch user, and issue a JWT pair."""
    _validate_indian_phone(phone)
    await otp_mod.verify_otp(redis, phone, code, settings.otp_pepper)

    # Fetch or create user
    user = await user_repo.get_user_by_phone(session, phone)
    is_new = user is None
    if user is None:
        user = await user_repo.create_user(session, phone)

    # Issue tokens
    access_token, _ = create_access_token(user.id, settings)
    raw_refresh, _ = create_refresh_token(user.id, settings)

    family_id = uuid.uuid4()
    expires_at = datetime.now(tz=UTC) + timedelta(
        seconds=settings.jwt_refresh_ttl_seconds
    )
    await auth_repo.create_refresh_token(
        session,
        user_id=user.id,
        raw_token=raw_refresh,
        family_id=family_id,
        device_id=device_id,
        expires_at=expires_at,
    )

    return OtpVerifyResponse(
        access_token=access_token,
        refresh_token=raw_refresh,
        is_new_user=is_new,
        user_status=user.status,
        user_id=user.id,
    )


async def refresh_tokens(
    raw_refresh: str,
    session: AsyncSession,
    settings: Settings,
) -> TokenPair:
    """Rotate refresh token. Revokes old; detects and handles reuse."""
    # Decode to validate signature/expiry
    payload = decode_token(raw_refresh, "refresh", settings)
    user_id = uuid.UUID(str(payload["sub"]))

    record = await auth_repo.get_token_by_hash(session, raw_refresh)

    if record is None:
        raise AppError(code="TOKEN_INVALID", message="Refresh token not found.", status_code=401)

    if record.revoked_at is not None:
        # Reuse detected — revoke the entire family
        await auth_repo.revoke_family(session, record.family_id)
        raise AppError(
            code="TOKEN_REUSED",
            message="Refresh token already used. All sessions have been invalidated.",
            status_code=401,
        )

    if record.expires_at < datetime.now(tz=UTC):
        raise AppError(code="TOKEN_EXPIRED", message="Refresh token has expired.", status_code=401)

    # Issue new pair
    new_access, _ = create_access_token(user_id, settings)
    new_raw_refresh, _ = create_refresh_token(user_id, settings)
    new_expires = datetime.now(tz=UTC) + timedelta(
        seconds=settings.jwt_refresh_ttl_seconds
    )

    # Create new record first so we have its ID for the forward link
    new_record = await auth_repo.create_refresh_token(
        session,
        user_id=user_id,
        raw_token=new_raw_refresh,
        family_id=record.family_id,
        device_id=record.device_id,
        expires_at=new_expires,
    )

    # Revoke old token and point it at the replacement
    await auth_repo.revoke_token(session, record, replaced_by_id=new_record.id)

    return TokenPair(access_token=new_access, refresh_token=new_raw_refresh)


async def logout(raw_refresh: str, session: AsyncSession, settings: Settings) -> None:
    """Revoke the current refresh token."""
    record = await auth_repo.get_token_by_hash(session, raw_refresh)
    if record and record.revoked_at is None:
        await auth_repo.revoke_token(session, record)
