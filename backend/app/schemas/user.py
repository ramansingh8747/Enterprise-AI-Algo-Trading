from pydantic import BaseModel, EmailStr, Field

from app.schemas.auth import UserResponse
from app.database.models.user import UserRole


class UserUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=255)
    email: EmailStr | None = None


class AdminUserUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=255)
    email: EmailStr | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    is_verified: bool | None = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=8)


class UserPaginatedResponse(BaseModel):
    """Paginated, public-safe user list returned by the admin API."""

    total: int
    items: list[UserResponse]

