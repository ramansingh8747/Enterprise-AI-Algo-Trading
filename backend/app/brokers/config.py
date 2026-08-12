from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class ZerodhaSettings(BaseSettings):
    """Zerodha broker configuration settings."""

    ZERODHA_API_KEY: str
    ZERODHA_API_SECRET: str
    ZERODHA_REDIRECT_URL: str
    ZERODHA_TIMEOUT: int = 30
    ZERODHA_BASE_URL: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


class AngelOneSettings(BaseSettings):
    """AngelOne SmartAPI broker configuration settings."""

    ANGELONE_API_KEY: Optional[str] = None
    ANGELONE_CLIENT_CODE: Optional[str] = None
    ANGELONE_PASSWORD: Optional[str] = None
    ANGELONE_TOTP_SECRET: Optional[str] = None
    ANGELONE_FEED_TOKEN: Optional[str] = None
    ANGELONE_BASE_URL: Optional[str] = "https://apiconnect.angelone.in"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )
