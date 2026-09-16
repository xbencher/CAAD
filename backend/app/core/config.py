from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["dev", "test", "e2e", "prod"]


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

    log_level: str = "INFO"
    api_v1_prefix: str = "/api/v1"
    request_id_header: str = "X-Request-ID"


@lru_cache
def get_settings() -> Settings:
    return Settings()
