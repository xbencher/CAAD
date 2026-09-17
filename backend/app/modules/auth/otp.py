"""
OTP generation, storage and verification.

Security design:
- OTP itself is never stored in Redis — only HMAC-SHA256(pepper, phone+otp).
- Attempt counter is stored separately with the same TTL.
- Comparison is constant-time (hmac.compare_digest) to prevent timing attacks.
- After 5 wrong attempts the slot is locked (BR-23).
"""

import hashlib
import hmac
import secrets

from redis.asyncio import Redis

from app.core.errors import AppError

_OTP_TTL = 300          # 5 minutes (BR-23: OTP valid for 5 minutes)
_MAX_ATTEMPTS = 5       # BR-23: max 5 verify attempts per issued code


def generate_otp() -> str:
    """Return a cryptographically random 6-digit string."""
    return str(secrets.randbelow(1_000_000)).zfill(6)


def _otp_hash_key(phone: str) -> str:
    return f"otp:hash:{phone}"


def _otp_attempts_key(phone: str) -> str:
    return f"otp:attempts:{phone}"


def _compute_hmac(pepper: str, phone: str, code: str) -> str:
    msg = f"{phone}:{code}".encode()
    return hmac.new(pepper.encode(), msg, hashlib.sha256).hexdigest()


async def store_otp(redis: Redis, phone: str, code: str, pepper: str) -> None:
    """Store HMAC of the OTP in Redis with 5-minute TTL.
    Resets the attempt counter. Does NOT store the raw code.
    """
    digest = _compute_hmac(pepper, phone, code)
    async with redis.pipeline(transaction=True) as pipe:
        pipe.set(_otp_hash_key(phone), digest, ex=_OTP_TTL)
        pipe.set(_otp_attempts_key(phone), 0, ex=_OTP_TTL)
        await pipe.execute()


async def verify_otp(redis: Redis, phone: str, code: str, pepper: str) -> None:
    """Verify the OTP for a phone number.

    Raises AppError:
    - OTP_LOCKED (429) if the attempt limit has been reached.
    - OTP_INVALID (400) if the code is wrong or expired.

    On success, deletes both Redis keys so the OTP cannot be reused.
    """
    stored_hash = await redis.get(_otp_hash_key(phone))
    if stored_hash is None:
        raise AppError(code="OTP_INVALID", message="OTP expired or not found.", status_code=400)

    # Increment attempt counter atomically; check BEFORE comparing
    attempts = await redis.incr(_otp_attempts_key(phone))
    if attempts > _MAX_ATTEMPTS:  # BR-23
        raise AppError(
            code="OTP_LOCKED",
            message="Too many incorrect attempts. Request a new OTP.",
            status_code=429,
        )

    expected = _compute_hmac(pepper, phone, code)
    # Constant-time comparison — prevents timing attacks
    if not hmac.compare_digest(stored_hash, expected):
        raise AppError(code="OTP_INVALID", message="Invalid OTP.", status_code=400)

    # Success — delete both keys so the OTP cannot be replayed
    await redis.delete(_otp_hash_key(phone), _otp_attempts_key(phone))


async def delete_otp(redis: Redis, phone: str) -> None:
    """Explicitly remove OTP keys (e.g. after login)."""
    await redis.delete(_otp_hash_key(phone), _otp_attempts_key(phone))
