"""
SMS provider Protocol + Fake implementation.

External providers sit behind a Protocol so tests and local dev use the
Fake and the real provider is swapped in by config (CP-9).
"""

from typing import Protocol, runtime_checkable


@runtime_checkable
class SmsProvider(Protocol):
    """Send a one-time password to a phone number."""

    async def send_otp(self, phone: str, code: str) -> None:
        """Send OTP `code` to `phone` (E.164 format).

        Must not raise for test/dev; production implementations should raise
        an AppError on failure so the service layer can handle it.

        NOTE: Never log `phone` or `code` — redaction is tested in CP-0.
        """
        ...


class FakeSmsProvider:
    """In-memory SMS provider for dev, test and e2e environments.

    Stores the last OTP per phone in a plain dict so tests can retrieve it
    via GET /api/v1/dev/last-otp (only mounted in dev/e2e — see main.py).
    """

    def __init__(self) -> None:
        self._codes: dict[str, str] = {}

    async def send_otp(self, phone: str, code: str) -> None:
        # Store under phone key for the dev endpoint to retrieve.
        # Production implementation would call an SMS gateway here.
        self._codes[phone] = code

    def get_last_code(self, phone: str) -> str | None:
        return self._codes.get(phone)


# Module-level singleton used via dependency injection.
# Tests may replace this via FastAPI's dependency_overrides.
_fake_sms_provider = FakeSmsProvider()


def get_fake_sms_provider() -> FakeSmsProvider:
    return _fake_sms_provider
