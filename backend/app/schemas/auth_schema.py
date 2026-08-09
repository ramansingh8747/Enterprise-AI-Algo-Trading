from pydantic import BaseModel, EmailStr, Field, SecretStr, ConfigDict


class LoginRequest(BaseModel):
    """Payload for user authentication."""

    model_config = ConfigDict(from_attributes=True)

    email: EmailStr = Field(..., description="Registered email address.")
    password: SecretStr = Field(..., description="Account password.")


class RefreshTokenRequest(BaseModel):
    """Payload for refreshing an expired access token."""

    model_config = ConfigDict(from_attributes=True)

    refresh_token: str = Field(..., description="A valid, non-expired refresh token.")
