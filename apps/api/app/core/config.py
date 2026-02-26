from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Moonshot Backend"
    api_version: str = "0.1.0"
    schema_version: str = "0.1.0"
    database_url: str = "sqlite+pysqlite:///./moonshot.db"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    model_config = SettingsConfigDict(env_prefix="MOONSHOT_", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
