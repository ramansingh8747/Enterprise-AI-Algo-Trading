from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class TokenResponse(BaseModel):
    """JWT token pair returned after successful authentication."""

    model_config = ConfigDict(from_attributes=True)

    access_token: str = Field(..., description="Short-lived JWT access token.")
    refresh_token: str = Field(..., description="Long-lived JWT refresh token.")
    token_type: str = Field(default="Bearer", description="OAuth2 token type.")
    expires_in: int = Field(..., description="Access token expiration time in seconds.")


class LoginResponse(BaseModel):
    """Payload returned after a successful login."""

    model_config = ConfigDict(from_attributes=True)

    user_id: UUID = Field(..., description="The user's unique identifier.")
    email: EmailStr = Field(..., description="The user's registered email address.")
    full_name: str = Field(..., description="The user's full display name.")
    tokens: TokenResponse = Field(..., description="The authentication tokens.")
