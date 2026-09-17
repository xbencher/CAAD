"""Auth router — thin HTTP layer. Business logic lives in service.py."""

from fastapi import APIRouter, Depends, Request, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.db import get_db
from app.core.redis import get_redis
from app.modules.auth import service as svc
from app.modules.auth.deps import get_sms_provider
from app.modules.auth.providers import SmsProvider
from app.modules.auth.schemas import (
    OtpRequestBody,
    OtpVerifyBody,
    OtpVerifyResponse,
    RefreshBody,
    TokenPair,
)

router = APIRouter(tags=["auth"])


def _client_ip(request: Request) -> str:
    """Extract the real client IP, respecting X-Forwarded-For in production."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/auth/otp/request", status_code=status.HTTP_202_ACCEPTED)
async def otp_request(
    body: OtpRequestBody,
    request: Request,
    redis: Redis = Depends(get_redis),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    sms_provider: SmsProvider = Depends(get_sms_provider),
) -> dict[str, str]:
    await svc.request_otp(
        phone=body.phone,
        client_ip=_client_ip(request),
        redis=redis,
        session=session,
        settings=settings,
        sms_provider=sms_provider,
    )
    return {"detail": "OTP sent if the number is eligible."}


@router.post("/auth/otp/verify", response_model=OtpVerifyResponse)
async def otp_verify(
    body: OtpVerifyBody,
    redis: Redis = Depends(get_redis),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> OtpVerifyResponse:
    return await svc.verify_otp_and_login(
        phone=body.phone,
        code=body.code,
        device_id=body.device_id,
        redis=redis,
        session=session,
        settings=settings,
    )


@router.post("/auth/refresh", response_model=TokenPair)
async def refresh(
    body: RefreshBody,
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenPair:
    return await svc.refresh_tokens(body.refresh_token, session, settings)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: RefreshBody,
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> None:
    await svc.logout(body.refresh_token, session, settings)
