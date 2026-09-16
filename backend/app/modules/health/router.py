from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.modules.health import service
from app.modules.health.deps import get_redis_dep
from app.modules.health.schemas import HealthResponse, ReadyResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get("/health/ready", response_model=ReadyResponse)
async def ready(
    session: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_dep),
) -> ReadyResponse:
    await service.check_readiness(session, redis)
    return ReadyResponse(status="ok")
