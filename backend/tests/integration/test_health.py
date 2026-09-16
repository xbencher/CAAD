from collections.abc import AsyncIterator

from httpx import AsyncClient

from app.core.db import get_db
from app.modules.health.deps import get_redis_dep
from tests.conftest import OverrideFn


async def test_health_ok(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_ready_checks_db_postgis_and_redis(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_ready_returns_503_envelope_when_redis_down(
    client: AsyncClient,
    override_dependency: OverrideFn,
) -> None:
    class BrokenRedis:
        async def ping(self) -> None:
            raise ConnectionError("redis is down")

    async def _broken_redis_dep() -> AsyncIterator[BrokenRedis]:
        yield BrokenRedis()

    override_dependency(get_redis_dep, _broken_redis_dep)

    response = await client.get("/api/v1/health/ready")

    assert response.status_code == 503
    body = response.json()
    assert body["error"]["code"] == "NOT_READY"
    assert body["error"]["details"] == {"dependency": "redis"}


async def test_ready_returns_503_envelope_when_db_down(
    client: AsyncClient,
    override_dependency: OverrideFn,
) -> None:
    class BrokenSession:
        async def execute(self, *args: object, **kwargs: object) -> None:
            raise ConnectionError("database is down")

    async def _broken_db_dep() -> AsyncIterator[BrokenSession]:
        yield BrokenSession()

    override_dependency(get_db, _broken_db_dep)

    response = await client.get("/api/v1/health/ready")

    assert response.status_code == 503
    body = response.json()
    assert body["error"]["code"] == "NOT_READY"
    assert body["error"]["details"] == {"dependency": "database"}
