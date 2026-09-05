import re
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.config import settings
from app.database.models.user import UserRole


# ---------------------------------------------------------------------------
# Request Schemas
# ---------------------------------------------------------------------------


class RegisterRequest(BaseModel):
    """Payload for POST /auth/register."""

    email: EmailStr = Field(..., description="A valid, unique email address.")
    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
        description="Unique username (3-50 characters, alphanumeric + underscores only).",
    )
    full_name: str = Field(
        ...,
        min_length=2,
        max_length=255,
        description="The user's full display name.",
    )
    password: str = Field(
        ...,
        min_length=settings.PASSWORD_MIN_LENGTH,
        description=f"Password with a minimum length of {settings.PASSWORD_MIN_LENGTH} characters.",
    )
    role: UserRole = Field(
        default=UserRole.TRADER,
        description="The user's platform role. Defaults to TRADER.",
    )
    phone_number: Optional[str] = Field(
        default=None,
        description="10-digit Indian mobile number (+91).",
    )

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return v.lower().strip()

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[a-z0-9_]+$", v):
            raise ValueError("Username may only contain letters, digits, and underscores.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < settings.PASSWORD_MIN_LENGTH:
            raise ValueError(
                f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters long."
            )
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit.")
        return v


class LoginRequest(BaseModel):
    """Payload for POST /auth/login."""

    email: EmailStr = Field(..., description="Registered email address.")
    password: str = Field(..., description="Account password.")
    login_type: Optional[str] = Field(
        default="trader",
        description="Login context: 'trader' or 'admin'.",
    )

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return v.lower().strip()


class RefreshTokenRequest(BaseModel):
    """Payload for POST /auth/refresh."""

    refresh_token: str = Field(..., description="A valid, non-expired refresh token.")


class ForgotPasswordRequest(BaseModel):
    """Payload for POST /auth/forgot-password."""

    email: EmailStr = Field(..., description="Registered email address.")
    new_password: str = Field(
        ...,
        min_length=settings.PASSWORD_MIN_LENGTH,
        description=f"New password with a minimum length of {settings.PASSWORD_MIN_LENGTH} characters.",
    )

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return v.lower().strip()

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < settings.PASSWORD_MIN_LENGTH:
            raise ValueError(
                f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters long."
            )
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit.")
        return v


# ---------------------------------------------------------------------------
# Response Schemas
# ---------------------------------------------------------------------------


class UserResponse(BaseModel):
    """Public-safe representation of a User record (no password hash exposed)."""

    id: uuid.UUID
    email: str
    username: str
    full_name: str
    role: UserRole
    phone_number: Optional[str] = None
    is_active: bool
    is_verified: bool
    last_login: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """JWT token pair returned after successful login or token refresh."""

    access_token: str = Field(..., description="Short-lived JWT access token.")
    refresh_token: str = Field(..., description="Long-lived JWT refresh token.")
    token_type: str = Field(default="bearer", description="OAuth2 token type.")
    user: UserResponse = Field(..., description="The authenticated user's public profile.")


class SendOTPRequest(BaseModel):
    """Payload for POST /auth/send-otp."""

    phone_number: str = Field(..., description="10-digit Indian mobile number (+91).")
    login_type: Optional[str] = Field(
        default="trader",
        description="Login context: 'trader' or 'admin'.",
    )

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        clean = re.sub(r"[^\d]", "", v)
        if len(clean) < 10:
            raise ValueError("Mobile number must be at least 10 digits.")
        return clean[-10:]


class VerifyOTPRequest(BaseModel):
    """Payload for POST /auth/verify-otp."""

    phone_number: str = Field(..., description="10-digit Indian mobile number.")
    otp_code: str = Field(..., min_length=6, max_length=6, description="6-digit OTP code.")
    login_type: Optional[str] = Field(
        default="trader",
        description="Login context: 'trader' or 'admin'.",
    )

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        clean = re.sub(r"[^\d]", "", v)
        if len(clean) < 10:
            raise ValueError("Mobile number must be at least 10 digits.")
        return clean[-10:]


class OTPResponse(BaseModel):
    """Response returned after dispatching OTP."""

    status: str = Field(default="success")
    message: str
    phone_number: str
    otp_code: Optional[str] = Field(default=None, description="Returned in dev/test mode for rapid testing.")
    whatsapp_link: Optional[str] = Field(default=None, description="Direct WhatsApp message link for 1-click WhatsApp delivery.")

