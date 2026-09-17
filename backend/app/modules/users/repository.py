"""
User repository — the only place that touches users/consents/blocked_phone_hashes tables.
All methods are async and operate on an AsyncSession.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.models import BlockedPhoneHash, Consent, ConsentType, User, UserStatus


async def get_user_by_id(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_phone(session: AsyncSession, phone: str) -> User | None:
    result = await session.execute(select(User).where(User.phone_e164 == phone))
    return result.scalar_one_or_none()


async def create_user(session: AsyncSession, phone: str) -> User:
    user = User(
        phone_e164=phone,
        status=UserStatus.pending_profile,
        created_at=datetime.now(UTC),
    )
    session.add(user)
    await session.flush()  # populate id without committing
    return user


async def update_user_status(
    session: AsyncSession, user_id: uuid.UUID, status: UserStatus
) -> None:
    await session.execute(
        update(User).where(User.id == user_id).values(status=status)
    )


async def set_user_dob(session: AsyncSession, user_id: uuid.UUID, dob: datetime) -> None:
    await session.execute(update(User).where(User.id == user_id).values(dob=dob))


async def mark_user_deactivated(session: AsyncSession, user_id: uuid.UUID) -> None:
    now = datetime.now(UTC)
    await session.execute(
        update(User)
        .where(User.id == user_id)
        .values(status=UserStatus.deactivated, deactivated_at=now)
    )


async def delete_user(session: AsyncSession, user_id: uuid.UUID) -> None:
    """Hard-delete a user immediately (used by BR-01 under-18 flow)."""
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user:
        await session.delete(user)
        await session.flush()


# ── Blocked phone hashes ──────────────────────────────────────────────────────


async def get_phone_hash_block(
    session: AsyncSession, phone_hash: str
) -> BlockedPhoneHash | None:
    result = await session.execute(
        select(BlockedPhoneHash).where(BlockedPhoneHash.phone_hash == phone_hash)
    )
    return result.scalar_one_or_none()


async def add_phone_hash_block(
    session: AsyncSession,
    phone_hash: str,
    reason: str,
    blocked_until: datetime,
) -> None:
    """Upsert: if hash already exists, extend the block."""
    existing = await get_phone_hash_block(session, phone_hash)
    if existing:
        existing.blocked_until = max(existing.blocked_until, blocked_until)
    else:
        block = BlockedPhoneHash(
            phone_hash=phone_hash, reason=reason, blocked_until=blocked_until
        )
        session.add(block)
    await session.flush()


# ── Consents ─────────────────────────────────────────────────────────────────


async def get_consents(session: AsyncSession, user_id: uuid.UUID) -> list[Consent]:
    result = await session.execute(
        select(Consent).where(Consent.user_id == user_id)
    )
    return list(result.scalars().all())


async def get_consent(
    session: AsyncSession, user_id: uuid.UUID, consent_type: ConsentType
) -> Consent | None:
    result = await session.execute(
        select(Consent).where(
            Consent.user_id == user_id, Consent.consent_type == consent_type
        )
    )
    return result.scalar_one_or_none()


async def upsert_consent(
    session: AsyncSession,
    user_id: uuid.UUID,
    consent_type: ConsentType,
    version: str,
    granted_at: datetime,
) -> Consent:
    existing = await get_consent(session, user_id, consent_type)
    if existing:
        existing.version = version
        existing.granted_at = granted_at
        existing.withdrawn_at = None
    else:
        existing = Consent(
            user_id=user_id,
            consent_type=consent_type,
            version=version,
            granted_at=granted_at,
        )
        session.add(existing)
    await session.flush()
    return existing


async def withdraw_consent_record(
    session: AsyncSession,
    user_id: uuid.UUID,
    consent_type: ConsentType,
    withdrawn_at: datetime,
) -> Consent | None:
    existing = await get_consent(session, user_id, consent_type)
    if existing:
        existing.withdrawn_at = withdrawn_at
        await session.flush()
    return existing
