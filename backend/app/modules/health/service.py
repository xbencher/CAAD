from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.core.db import check_db_ready
from app.core.errors import AppError
from app.core.redis import check_redis_ready


async def check_readiness(session: AsyncSession, redis: Redis) -> None:
    try:
        await check_db_ready(session)
    except Exception as exc:
        raise AppError(
            code="NOT_READY",
            message="Database is not reachable.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details={"dependency": "database"},
        ) from exc

    try:
        await check_redis_ready(redis)
    except Exception as exc:
        raise AppError(
            code="NOT_READY",
            message="Redis is not reachable.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details={"dependency": "redis"},
        ) from exc
