from abc import ABC, abstractmethod
from typing import Optional
from uuid import UUID
from app.database.models.user import User


class AuthRepository(ABC):
    """Abstract interface for authentication-related repository operations."""

    @abstractmethod
    def get_user_by_email(self, email: str) -> Optional[User]:
        """Retrieve a user by their email address."""
        pass

    @abstractmethod
    def update_last_login(self, user_id: UUID) -> None:
        """Update the last login timestamp for a given user."""
        pass

    @abstractmethod
    def store_refresh_token(self, user_id: UUID, refresh_token: str) -> None:
        """Store a refresh token for a given user."""
        pass

    @abstractmethod
    def revoke_refresh_token(self, refresh_token: str) -> None:
        """Revoke a refresh token."""
        pass
