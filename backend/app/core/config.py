from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["dev", "test", "e2e", "prod"]
SmsProviderName = Literal["fake"]


class Settings(BaseSettings):
    """Application settings. Every value is sourced from the environment;
    there are no hardcoded fallbacks for secrets. Missing required values
    raise a validation error at startup (fail fast)."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    env: Environment
    database_url: str
    redis_url: str
    jwt_secret: str = Field(min_length=16)

    # CP-1: required secrets — fail fast if missing
    otp_pepper: str = Field(min_length=16)
    phone_hash_pepper: str = Field(min_length=16)

    # CP-1: JWT TTLs
    jwt_access_ttl_seconds: int = 900       # 15 minutes
    jwt_refresh_ttl_seconds: int = 2_592_000  # 30 days

    # CP-1: versioned consents — clients must accept these exact versions
    current_terms_version: str = "1.0"
    current_privacy_version: str = "1.0"

    # CP-1: SMS provider — "fake" in dev/test; real provider added in CP-9
    sms_provider: SmsProviderName = "fake"

    # BR-08: daily request quotas
    free_daily_requests: int = 3
    member_daily_requests: int = 50

    log_level: str = "INFO"
    api_v1_prefix: str = "/api/v1"
    request_id_header: str = "X-Request-ID"


@lru_cache
def get_settings() -> Settings:
    return Settings()
