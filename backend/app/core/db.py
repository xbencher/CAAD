from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def create_engine() -> AsyncEngine:
    return create_async_engine(get_settings().database_url, pool_pre_ping=True)


_engine: AsyncEngine = create_engine()
_session_factory = async_sessionmaker(bind=_engine, expire_on_commit=False)


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return _session_factory


async def get_db() -> AsyncGenerator[AsyncSession]:
    async with _session_factory() as session:
        yield session


async def check_db_ready(session: AsyncSession) -> str:
    """Runs the queries required by BR-independent readiness checks:
    a plain connectivity check plus a PostGIS availability check."""
    await session.execute(text("SELECT 1"))
    result = await session.execute(text("SELECT PostGIS_Version()"))
    return str(result.scalar_one())
