from collections.abc import AsyncIterator, Callable
from pathlib import Path
from typing import Any

import pytest
import pytest_asyncio
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from alembic import command
from app.core.config import get_settings
from app.core.db import get_db
from app.core.redis import get_redis
from app.main import app as fastapi_app

ALEMBIC_INI = Path(__file__).resolve().parent.parent / "alembic.ini"


def _alembic_config() -> Config:
    return Config(str(ALEMBIC_INI))


@pytest.fixture(scope="session", autouse=True)
def _apply_migrations() -> None:
    settings = get_settings()
    if settings.env != "test":
        raise RuntimeError(
            "Tests must run with ENV=test (see `make test-backend`) to avoid "
            "touching a non-test database."
        )
    command.upgrade(_alembic_config(), "head")


@pytest_asyncio.fixture(scope="session")
async def engine(_apply_migrations: None) -> AsyncIterator[AsyncEngine]:
    test_engine = create_async_engine(get_settings().database_url)
    yield test_engine
    await test_engine.dispose()


@pytest_asyncio.fixture
async def db_session(engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    """Wraps each test in an outer transaction + SAVEPOINT and rolls it
    back afterwards, so tests never leave data behind for one another."""
    async with engine.connect() as connection:
        await connection.begin()
        session_factory = async_sessionmaker(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        session = session_factory()
        try:
            yield session
        finally:
            await session.close()
            await connection.rollback()


@pytest_asyncio.fixture(autouse=True)
async def _flush_redis() -> AsyncIterator[None]:
    redis = get_redis()
    await redis.flushdb()
    yield


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncIterator[AsyncClient]:
    async def _get_db_override() -> AsyncIterator[AsyncSession]:
        yield db_session

    fastapi_app.dependency_overrides[get_db] = _get_db_override
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
    fastapi_app.dependency_overrides.clear()


OverrideFn = Callable[[Callable[..., Any], Callable[..., Any]], None]


@pytest.fixture
def override_dependency(client: AsyncClient) -> OverrideFn:
    """Lets a test swap out a FastAPI dependency (e.g. Redis) for the
    duration of the test. Cleared automatically when `client` tears down."""

    def _override(dependency: Callable[..., Any], replacement: Callable[..., Any]) -> None:
        fastapi_app.dependency_overrides[dependency] = replacement

    return _override


@pytest.fixture
def redis_client() -> Redis:
    return get_redis()
