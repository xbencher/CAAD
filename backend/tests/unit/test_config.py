import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_settings_fail_fast_when_required_secret_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("JWT_SECRET", raising=False)

    with pytest.raises(ValidationError) as exc_info:
        Settings(
            _env_file=None,
            env="test",
            database_url="postgresql+asyncpg://user:pass@localhost/db",
            redis_url="redis://localhost:6379/0",
        )

    assert "jwt_secret" in str(exc_info.value)
