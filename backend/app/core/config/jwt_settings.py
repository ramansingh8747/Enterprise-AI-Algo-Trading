from pydantic import BaseModel, Field


class JwtSettings(BaseModel):
    """JWT configuration settings."""

    secret_key: str = Field(..., description="Secret key for JWT token generation.")
    algorithm: str = Field(default="HS256", description="Algorithm used for JWT tokens.")
    access_token_expire_minutes: int = Field(..., gt=0, description="Access token expiration in minutes.")
    refresh_token_expire_days: int = Field(..., gt=0, description="Refresh token expiration in days.")
    issuer: str = Field(..., description="The issuer of the JWT tokens.")
    audience: str = Field(..., description="The intended audience of the JWT tokens.")
