from abc import ABC, abstractmethod


class PasswordService(ABC):
    """Abstract interface for password operations."""

    @abstractmethod
    def hash_password(self, password: str) -> str:
        """Hash a plaintext password."""
        pass

    @abstractmethod
    def verify_password(
        self,
        plain_password: str,
        hashed_password: str,
    ) -> bool:
        """Verify a plaintext password against a hashed password."""
        pass
