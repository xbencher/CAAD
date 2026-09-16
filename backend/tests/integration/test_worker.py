import uuid

from arq import create_pool
from arq.connections import RedisSettings
from arq.worker import Worker

from app.core.config import get_settings
from app.worker import WorkerSettings


async def test_worker_runs_heartbeat_job() -> None:
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
    pool = await create_pool(redis_settings)
    try:
        job = await pool.enqueue_job("heartbeat", _job_id=f"heartbeat-{uuid.uuid4()}")
        assert job is not None

        worker = Worker(
            functions=WorkerSettings.functions,
            redis_settings=redis_settings,
            burst=True,
            poll_delay=0,
        )
        try:
            await worker.async_run()
        finally:
            await worker.close()

        assert await job.result(timeout=5) == "ok"
    finally:
        await pool.aclose()
