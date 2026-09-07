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
    CORS_ALLOWED_ORIGINS: Any = Field(default_factory=lambda: ["http://localhost:5173"])

    # Trading safety / production readiness defaults. LIVE trading remains disabled by default.
    LIVE_TRADING_ENABLED: bool = False
    LIVE_DATA_FEED_ENABLED: bool = False
    LIVE_DATA_FEED_PROVIDER: str = "zerodha"
    LIVE_TRADING_MAX_ORDER_VALUE: str = "50000.00"
    STRATEGY_SCHEDULER_ENABLED: bool = True
    STRATEGY_SCHEDULER_INTERVAL_SECONDS: float = 5.0
    BROKER_RECONCILIATION_ENABLED: bool = True
    BROKER_RECONCILIATION_INTERVAL_SECONDS: int = 30
    AUDIT_LOG_ENABLED: bool = True
    REDIS_EVENT_BUS_ENABLED: bool = False
    REDIS_URL: str = "redis://localhost:6379/0"
    BROKER_OPERATION_TIMEOUT_SECONDS: int = 15
    REDIS_RECONNECT_MAX_ATTEMPTS: int = 5
    REDIS_RECONNECT_BASE_DELAY_SECONDS: float = 1.0
    PORTFOLIO_VALUATION_REFRESH_INTERVAL_SECONDS: int = 30
    STRATEGY_UPLOAD_DIR: str = "storage/strategy_uploads"
    STRATEGY_DEFAULT_COOLDOWN_SECONDS: int = 900
    ENFORCE_MARKET_HOURS: bool = False
    MARKET_OPEN_TIME_IST: str = "09:15"
    MARKET_ENTRY_START_TIME_IST: str = "09:30"
    MARKET_NEW_ORDER_CUTOFF_IST: str = "15:15"
    MARKET_CLOSE_TIME_IST: str = "15:30"
    DB_POOL_SIZE: int = 30
    DB_MAX_OVERFLOW: int = 50
    DB_POOL_TIMEOUT: float = 60.0
    DB_POOL_RECYCLE: int = 1800

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+psycopg://", 1)
        if v.startswith("postgresql://") and not v.startswith("postgresql+"):
            return v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v

    @field_validator("CORS_ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()]
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        if isinstance(v, list):
            return [str(origin).strip() for origin in v if str(origin).strip()]
        return ["http://localhost:5173"]

    @model_validator(mode="after")
    def validate_production_cors(self) -> "Settings":
        if self.ENVIRONMENT.lower() == "production":
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
