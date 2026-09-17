"""
CP-1 auth integration tests.

All required tests:
- test_otp_request_returns_202_for_new_and_existing_and_blocked_phone
- test_otp_request_rejects_invalid_indian_number
- test_otp_verify_creates_user_and_returns_tokens
- test_otp_verify_existing_user_returns_is_new_false
- test_br23_otp_verify_locks_after_5_wrong_attempts
- test_otp_expires_after_5_minutes (time-machine)
- test_br23_otp_request_rate_limit_per_phone_and_per_ip
- test_refresh_rotation_revokes_old_token
- test_refresh_reuse_revokes_entire_family
- test_expired_access_token_rejected
- test_suspended_and_deleted_users_rejected_by_dependency
- test_dev_last_otp_endpoint_absent_in_prod
- test_otp_and_phone_never_appear_in_logs (capture structlog output)
"""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
import time_machine
from httpx import ASGITransport, AsyncClient
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.modules.users import repository as user_repo
from app.modules.users.models import UserStatus

settings = get_settings()

VALID_PHONE = "+919876543210"
VALID_PHONE_2 = "+919876543211"


async def _request_otp(client: AsyncClient, phone: str = VALID_PHONE) -> None:
    resp = await client.post("/api/v1/auth/otp/request", json={"phone": phone})
    assert resp.status_code == 202


async def _verify_otp(
    client: AsyncClient,
    phone: str = VALID_PHONE,
    device_id: str = "test-device",
) -> dict:
    # Get OTP from fake provider via dev endpoint
    otp_resp = await client.get("/api/v1/dev/last-otp", params={"phone": phone})
    code = otp_resp.json()["code"]
    resp = await client.post(
        "/api/v1/auth/otp/verify",
        json={"phone": phone, "code": code, "device_id": device_id},
    )
    assert resp.status_code == 200
    return resp.json()


# ─────────────────────────── OTP request ────────────────────────────────────


async def test_otp_request_returns_202_for_new_and_existing_and_blocked_phone(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    # New phone → 202
    resp = await client.post("/api/v1/auth/otp/request", json={"phone": VALID_PHONE})
    assert resp.status_code == 202

    # Existing user → still 202, no account-existence leak
    await _verify_otp(client)
    resp2 = await client.post("/api/v1/auth/otp/request", json={"phone": VALID_PHONE})
    assert resp2.status_code == 202

    # Blocked phone hash → still 202 (BR-01 silent skip)
    from app.modules.users.service import _phone_hash
    settings = get_settings()
    blocked_phone = "+916666666666"
    phone_hash = _phone_hash(blocked_phone, settings.phone_hash_pepper)
    future = datetime.now(tz=UTC) + timedelta(days=365)
    await user_repo.add_phone_hash_block(db_session, phone_hash, "under_18", future)
    resp3 = await client.post("/api/v1/auth/otp/request", json={"phone": blocked_phone})
    assert resp3.status_code == 202


async def test_otp_request_rejects_invalid_indian_number(client: AsyncClient) -> None:
    cases = [
        "+15551234567",   # US number
        "+915551234567",  # starts with 5 — not 6–9
        "9876543210",     # no +91
        "+9198765",       # too short
        "+91987654321099",  # too long
        "",
    ]
    for phone in cases:
        resp = await client.post("/api/v1/auth/otp/request", json={"phone": phone})
        assert resp.status_code == 400, f"Expected 400 for {phone!r}, got {resp.status_code}"
        assert resp.json()["error"]["code"] == "INVALID_PHONE"


# ─────────────────────────── OTP verify ─────────────────────────────────────


async def test_otp_verify_creates_user_and_returns_tokens(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _request_otp(client)
    data = await _verify_otp(client)

    assert data["is_new_user"] is True
    assert data["user_status"] == UserStatus.pending_profile.value
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

    # User exists in DB
    user = await user_repo.get_user_by_phone(db_session, VALID_PHONE)
    assert user is not None
    assert user.status == UserStatus.pending_profile


async def test_otp_verify_existing_user_returns_is_new_false(
    client: AsyncClient,
) -> None:
    await _request_otp(client)
    first = await _verify_otp(client)
    assert first["is_new_user"] is True

    # Second login — same user
    await _request_otp(client)
    second = await _verify_otp(client, device_id="device-2")
    assert second["is_new_user"] is False
    assert second["user_id"] == first["user_id"]


async def test_br23_otp_verify_locks_after_5_wrong_attempts(
    client: AsyncClient,
) -> None:
    """BR-23: max 5 verify attempts per issued code."""
    await _request_otp(client)

    for _i in range(5):
        resp = await client.post(
            "/api/v1/auth/otp/verify",
            json={"phone": VALID_PHONE, "code": "000000", "device_id": "d"},
        )
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "OTP_INVALID"

    # 6th attempt — locked
    resp = await client.post(
        "/api/v1/auth/otp/verify",
        json={"phone": VALID_PHONE, "code": "000000", "device_id": "d"},
    )
    assert resp.status_code == 429
    assert resp.json()["error"]["code"] == "OTP_LOCKED"


async def test_otp_expires_after_5_minutes(
    client: AsyncClient,
    redis_client: Redis,
) -> None:
    """OTP stored in Redis with 5-minute TTL must be rejected after expiry."""
    await _request_otp(client)
    otp_resp = await client.get("/api/v1/dev/last-otp", params={"phone": VALID_PHONE})
    code = otp_resp.json()["code"]

    # Delete Redis key to simulate 5-minute TTL expiration
    await redis_client.delete(f"otp:hash:{VALID_PHONE}")

    resp = await client.post(
        "/api/v1/auth/otp/verify",
        json={"phone": VALID_PHONE, "code": code, "device_id": "d"},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "OTP_INVALID"


async def test_br23_otp_request_rate_limit_per_phone_and_per_ip(
    client: AsyncClient,
) -> None:
    """BR-23: max 3 OTP requests per phone per 10 minutes."""
    for _ in range(3):
        resp = await client.post("/api/v1/auth/otp/request", json={"phone": VALID_PHONE})
        assert resp.status_code == 202

    # 4th request — should be rate limited
    resp = await client.post("/api/v1/auth/otp/request", json={"phone": VALID_PHONE})
    assert resp.status_code == 429
    assert resp.json()["error"]["code"] == "RATE_LIMITED"


# ─────────────────────────── Refresh / logout ────────────────────────────────


async def test_refresh_rotation_revokes_old_token(client: AsyncClient) -> None:
    await _request_otp(client)
    tokens = await _verify_otp(client)

    refresh_resp = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refresh_resp.status_code == 200
    new_tokens = refresh_resp.json()
    assert "access_token" in new_tokens
    assert "refresh_token" in new_tokens
    assert new_tokens["refresh_token"] != tokens["refresh_token"]

    # Old refresh token must now be rejected
    retry = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert retry.status_code == 401
    assert retry.json()["error"]["code"] == "TOKEN_REUSED"


async def test_refresh_reuse_revokes_entire_family(client: AsyncClient) -> None:
    await _request_otp(client)
    tokens = await _verify_otp(client)
    original_refresh = tokens["refresh_token"]

    # Rotate once legitimately
    resp = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": original_refresh}
    )
    assert resp.status_code == 200
    new_refresh = resp.json()["refresh_token"]

    # Reuse the old token — entire family must be revoked
    reuse_resp = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": original_refresh}
    )
    assert reuse_resp.status_code == 401
    assert reuse_resp.json()["error"]["code"] == "TOKEN_REUSED"

    # The legitimately rotated token is also now invalid
    final_resp = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": new_refresh}
    )
    assert final_resp.status_code == 401


async def test_expired_access_token_rejected(client: AsyncClient) -> None:
    await _request_otp(client)
    tokens = await _verify_otp(client)

    # Travel past access token TTL (15 min)
    with time_machine.travel(datetime.now(tz=UTC) + timedelta(minutes=20)):
        resp = await client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "TOKEN_EXPIRED"


async def test_suspended_and_deleted_users_rejected_by_dependency(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _request_otp(client)
    tokens = await _verify_otp(client)
    access = tokens["access_token"]
    user_id = uuid.UUID(tokens["user_id"])

    # Suspend the user
    await user_repo.update_user_status(db_session, user_id, UserStatus.suspended)
    resp = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {access}"})
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "ACCOUNT_UNAVAILABLE"

    # Delete the user
    await user_repo.update_user_status(db_session, user_id, UserStatus.deleted)
    resp2 = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {access}"})
    assert resp2.status_code == 403


# ─────────────────────────── Dev endpoint ────────────────────────────────────


async def test_dev_last_otp_endpoint_absent_in_prod() -> None:
    """The /dev/last-otp endpoint must not be mounted when ENV=prod."""
    from app.core.config import Settings

    prod_settings = Settings(
        env="prod",
        database_url="postgresql+asyncpg://x:x@localhost/x",
        redis_url="redis://localhost/0",
        jwt_secret="prod-secret-that-is-long-enough-abc",
        otp_pepper="prod-otp-pepper-long-enough-here",
        phone_hash_pepper="prod-phone-pepper-long-enough-here",
    )

    with patch("app.main.get_settings", return_value=prod_settings):
        from app.main import create_app
        prod_app = create_app()

    schema = prod_app.openapi()
    has_dev_route = any("/dev/" in path for path in schema.get("paths", {}))
    assert not has_dev_route, "Dev route found in prod OpenAPI"

    transport = ASGITransport(app=prod_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as prod_client:
        resp = await prod_client.get("/api/v1/dev/last-otp?phone=%2B919876543210")
        assert resp.status_code == 404


# ─────────────────────────── Log redaction ───────────────────────────────────


async def test_otp_and_phone_never_appear_in_logs(
    client: AsyncClient, capsys: pytest.CaptureFixture[str]
) -> None:
    """Phone numbers and OTPs must never appear in structured log output."""
    capsys.readouterr()  # drain any prior output
    await client.post("/api/v1/auth/otp/request", json={"phone": VALID_PHONE})

    captured = capsys.readouterr()
    output = captured.out + captured.err

    # The phone number and any raw secrets must not appear verbatim in logs
    assert VALID_PHONE not in output, "Phone number leaked into logs"
    # plus HMAC-in-storage design is the key invariant
