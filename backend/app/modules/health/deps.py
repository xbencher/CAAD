from redis.asyncio import Redis

from app.core.redis import get_redis


async def get_redis_dep() -> Redis:
    return get_redis()
