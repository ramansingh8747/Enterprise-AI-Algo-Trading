from functools import lru_cache
from typing import Any
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Enterprise application settings loaded from environment variables and .env file."""

    APP_NAME: str = "Enterprise AI Algo Trading Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    API_PREFIX: str = "/api/v1"
    LOG_LEVEL: str = "INFO"
    DATABASE_URL: str
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = Field(
        min_length=32
    )
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    BROKER_SECRET_KEY: str
    PASSWORD_MIN_LENGTH: int = 8
    CORS_ALLOWED_ORIGINS: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    @field_validator("CORS_ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @model_validator(mode="after")
    def validate_production_cors(self) -> "Settings":
        if self.ENVIRONMENT.lower() == "production" or not self.DEBUG:
            if "*" in self.CORS_ALLOWED_ORIGINS:
                raise ValueError("CORS allow_origins cannot contain '*' in production environment.")
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, v: Any) -> bool:
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            val = v.lower().strip()
            if val in ("true", "1", "t", "yes", "y"):
                return True
            if val in ("false", "0", "f", "no", "n"):
                return False
        return True


@lru_cache
def get_settings() -> Settings:
    return Settings()


# Singleton settings instance for application-wide use
settings = get_settings()
