from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized, type-safe application configuration loaded from environment variables and .env file."""

    # Core API Settings (Requested in Step 2.1)
    API_NAME: str = Field(
        default="Enterprise AI Algo Trading Platform",
        description="The name of the API application."
    )

    API_VERSION: str = Field(
        default="v1",
        description="The version of the API."
    )

    ENVIRONMENT: str = Field(
        default="development",
        description="The runtime environment (development, staging, production)."
    )

    DEBUG: bool = Field(
        default=False,
        description="Enable/disable debug mode."
    )

    SECRET_KEY: str = Field(
        default="change-this-to-a-very-long-random-secret-key-in-production",
        min_length=32,
        description="The secret key for application security."
    )

    # Legacy Compatibility (to avoid breaking existing imports)
    APP_NAME: str = Field(
        default="Enterprise AI Algo Trading Platform",
        description="Legacy alias for API_NAME."
    )

    APP_VERSION: str = Field(
        default="1.0.0",
        description="Legacy alias for API_VERSION."
    )

    API_PREFIX: str = Field(
        default="/api/v1",
        description="Prefix for all API routes."
    )

    LOG_LEVEL: str = Field(
        default="INFO",
        description="Standard log level for application loggers."
    )

    DATABASE_URL: str = Field(
        default="postgresql+psycopg://postgres:password@localhost:5432/algo_trading",
        description="Database connection URL."
    )

    # JWT Configuration
    JWT_SECRET_KEY: str = Field(
        default="change-this-to-a-very-long-random-secret-key-in-production",
        description="Secret key specifically for JWT token generation."
    )

    JWT_ALGORITHM: str = Field(
        default="HS256",
        description="Algorithm used for JWT tokens."
    )

    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=30,
        description="Access token expiration in minutes."
    )

    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = Field(
        default=7,
        description="Refresh token expiration in days."
    )

    # Password Policy
    PASSWORD_MIN_LENGTH: int = Field(
        default=8,
        description="Minimum character length for user passwords."
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
        env_file_override=True,  # Match the behavior of the legacy settings
    )


@lru_cache
def get_settings() -> Settings:
    """
    Return cached application settings.
    """
    return Settings()


# Singleton settings instance for application-wide use
settings = get_settings()
