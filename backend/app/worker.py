from typing import Any

import structlog
from arq.connections import RedisSettings

from app.core.config import get_settings

logger = structlog.get_logger()


async def heartbeat(ctx: dict[str, Any]) -> str:
    """Minimal job used to prove the worker can run a job end to end.
    Exercised by tests; no product jobs exist yet in CP-0."""
    await logger.ainfo("worker_heartbeat")
    return "ok"


class WorkerSettings:
    functions = [heartbeat]
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
