from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class ZerodhaSettings(BaseSettings):
    """Zerodha broker configuration settings."""

    ZERODHA_API_KEY: str
    ZERODHA_API_SECRET: str
    ZERODHA_REDIRECT_URL: str
    ZERODHA_TIMEOUT: int = 30
    ZERODHA_BASE_URL: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )
