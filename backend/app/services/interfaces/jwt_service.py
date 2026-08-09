from abc import ABC, abstractmethod
from uuid import UUID


class JwtService(ABC):
    """Abstract interface for JWT token operations."""

    @abstractmethod
    def create_access_token(self, user_id: UUID) -> str:
        """Create a new access token for a given user."""
        pass

    @abstractmethod
    def create_refresh_token(self, user_id: UUID) -> str:
        """Create a new refresh token for a given user."""
        pass

    @abstractmethod
    def verify_access_token(self, token: str) -> UUID:
        """Verify an access token and return the user ID."""
        pass

    @abstractmethod
    def verify_refresh_token(self, token: str) -> UUID:
        """Verify a refresh token and return the user ID."""
        pass
