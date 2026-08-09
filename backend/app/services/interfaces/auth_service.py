from abc import ABC, abstractmethod
from app.schemas.auth_response import LoginResponse


class AuthService(ABC):
    """Abstract interface for authentication service operations."""

    @abstractmethod
    def login(self, email: str, password: str) -> LoginResponse:
        """Authenticate a user and return login details."""
        pass

    @abstractmethod
    def refresh_token(self, refresh_token: str) -> LoginResponse:
        """Refresh an authentication token and return updated login details."""
        pass

    @abstractmethod
    def logout(self, refresh_token: str) -> None:
        """Revoke a refresh token to perform a logout."""
        pass
