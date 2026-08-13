from pydantic import BaseModel, EmailStr, Field

from app.schemas.auth import UserResponse

class UserUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=255)
    email: EmailStr | None = None

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=8)


class UserPaginatedResponse(BaseModel):
    """Paginated public-safe list of users for admin management."""

    total: int
    items: list[UserResponse]
