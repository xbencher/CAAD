"""
Auth repository — the only place that touches the refresh_tokens table.
"""

import hashlib
import uuid
from datetime import UTC, datetime

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.modules.auth.models import RefreshToken


def _hash_token(raw_token: str) -> str:
    """SHA-256 hex digest of a raw refresh token. Never store the raw token."""
    return hashlib.sha256(raw_token.encode()).hexdigest()


async def create_refresh_token(
    session: AsyncSession,
    user_id: uuid.UUID,
    raw_token: str,
    family_id: uuid.UUID,
    device_id: str,
    expires_at: datetime,
) -> RefreshToken:
    record = RefreshToken(
        user_id=user_id,
        token_hash=_hash_token(raw_token),
        family_id=family_id,
        device_id=device_id,
        expires_at=expires_at,
        created_at=datetime.now(tz=UTC),
    )
    session.add(record)
    await session.flush()
    return record


async def get_token_by_hash(session: AsyncSession, raw_token: str) -> RefreshToken | None:
    result = await session.execute(
        select(RefreshToken).where(RefreshToken.token_hash == _hash_token(raw_token))
    )
    return result.scalar_one_or_none()


async def revoke_token(
    session: AsyncSession, record: RefreshToken, replaced_by_id: uuid.UUID | None = None
) -> None:
    record.revoked_at = datetime.now(tz=UTC)
    if replaced_by_id:
        record.replaced_by_id = replaced_by_id
    await session.flush()


async def revoke_family(session: AsyncSession, family_id: uuid.UUID) -> None:
    """Revoke all tokens in a family (reuse detection — BR protection)."""
    now = datetime.now(tz=UTC)
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    await session.flush()
