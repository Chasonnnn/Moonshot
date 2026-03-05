from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Moonshot Backend"
    api_version: str = "0.6.0"
    schema_version: str = "0.6.0"
    database_url: str = "sqlite+pysqlite:///./moonshot.db"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    jwt_issuer: str = "moonshot"
    jwt_audience: str = "moonshot-api"
    jwt_active_kid: str = "v1"
    jwt_signing_keys: dict[str, str] = {"v1": "moonshot-dev-signing-key-change-me"}
    jwt_default_ttl_seconds: int = 3600
    auth_bootstrap_token: str = "moonshot-bootstrap-dev"

    worker_poll_interval_seconds: float = 0.2
    worker_max_attempts_default: int = 3
    worker_retry_base_seconds: float = 2.0
    worker_lease_seconds: float = 30.0
    worker_heartbeat_interval_seconds: float = 5.0
    worker_stale_after_seconds: float = 30.0

    model_provider: str = "litellm"
    provider_request_timeout_seconds: float = 45.0
    litellm_base_url: str | None = None
    litellm_api_key: str | None = None
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.0-flash"
    openai_model: str = "gpt-5-mini"
    managed_secrets_enabled: bool = False
    managed_secrets_required: bool = False
    managed_secrets_region: str | None = None
    jwt_signing_keys_secret_id: str | None = None
    gemini_api_key_secret_id: str | None = None

    model_config = SettingsConfigDict(env_prefix="MOONSHOT_", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
