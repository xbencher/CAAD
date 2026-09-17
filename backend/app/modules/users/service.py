"""
Users service — business logic for profile management, DOB age gate, and consents.
No direct DB access here; all persistence goes through repository.py.
"""

import hashlib
import hmac
import uuid
from datetime import UTC, date, datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import AppError
from app.modules.users import repository as repo
from app.modules.users.models import Consent, ConsentType, User
from app.modules.users.schemas import ConsentResponse, UserMeResponse

# IST offset from UTC
_IST = timezone(timedelta(hours=5, minutes=30))


def _phone_hash(phone: str, pepper: str) -> str:
    """Return HMAC-SHA256(pepper, phone) as a hex digest.
    Never log this value — it's a one-way hash of a phone number.
    """
    return hmac.new(pepper.encode(), phone.encode(), hashlib.sha256).hexdigest()


def _today_in_ist() -> date:
    """Return the current date in Asia/Kolkata (IST) — BR-01 requires IST day boundaries."""
    return datetime.now(tz=_IST).date()


def _compute_age_in_ist(dob: date) -> int:
    """Compute age in full years as of today in IST."""
    today = _today_in_ist()
    years = today.year - dob.year
    # Subtract 1 if birthday hasn't occurred yet this year
    if (today.month, today.day) < (dob.month, dob.day):
        years -= 1
    return years


def _needs_consent(consents: list[Consent], settings: Settings) -> bool:
    """Return True if the user has not granted the current version of both
    terms and privacy consents (or has withdrawn either).
    """
    active = {
        c.consent_type: c
        for c in consents
        if c.withdrawn_at is None
    }
    terms = active.get(ConsentType.terms)
    privacy = active.get(ConsentType.privacy)
    if terms is None or terms.version != settings.current_terms_version:
        return True
    if privacy is None or privacy.version != settings.current_privacy_version:
        return True
    return False


async def get_user_me(
    user: User,
    settings: Settings,
) -> UserMeResponse:
    """Build the /users/me response from an already-loaded User ORM object."""
    consent_responses = [
        ConsentResponse.model_validate(c) for c in user.consents
    ]
    return UserMeResponse(
        id=user.id,
        status=user.status,
        has_dob=user.dob is not None,
        needs_consent=_needs_consent(user.consents, settings),
        consents=consent_responses,
    )


async def set_dob(
    user: User,
    dob: date,
    session: AsyncSession,
    settings: Settings,
) -> None:
    """Set DOB with BR-01 age gate enforcement.

    BR-01: users must be 18+ computed in IST. Under-18 → 403, user record
    deleted, phone hash blocked for 365 days. DOB cannot be changed once set.
    """
    # BR-01: DOB immutability
    if user.dob is not None:
        raise AppError(
            code="DOB_IMMUTABLE",
            message="Date of birth cannot be changed once set.",
            status_code=409,
        )

    # BR-01: must be 18+ in IST
    age = _compute_age_in_ist(dob)
    if age < 18:
        # Block the phone hash for 365 days before deleting the user
        blocked_until = datetime.now(tz=UTC) + timedelta(days=365)
        phone_hash = _phone_hash(user.phone_e164, settings.phone_hash_pepper)
        await repo.add_phone_hash_block(
            session,
            phone_hash=phone_hash,
            reason="under_18",
            blocked_until=blocked_until,
        )
        # Hard-delete the user record immediately (BR-01)
        await repo.delete_user(session, user.id)
        raise AppError(
            code="AGE_RESTRICTED",
            message="You must be 18 or older to use Proxi.",
            status_code=403,
        )

    await repo.set_user_dob(session, user.id, dob)  # type: ignore[arg-type]


async def grant_consent(
    user: User,
    consent_type: ConsentType,
    version: str,
    session: AsyncSession,
) -> ConsentResponse:
    now = datetime.now(tz=UTC)
    consent = await repo.upsert_consent(session, user.id, consent_type, version, now)
    return ConsentResponse.model_validate(consent)


async def withdraw_consent(
    user_id: uuid.UUID,
    consent_type: ConsentType,
    session: AsyncSession,
) -> None:
    now = datetime.now(tz=UTC)
    await repo.withdraw_consent_record(session, user_id, consent_type, now)


async def list_consents(
    user_id: uuid.UUID,
    session: AsyncSession,
) -> list[ConsentResponse]:
    consents = await repo.get_consents(session, user_id)
    return [ConsentResponse.model_validate(c) for c in consents]


def is_phone_blocked(phone: str, pepper: str) -> str:
    """Return the phone hash for a given phone+pepper (used by auth service)."""
    return _phone_hash(phone, pepper)
