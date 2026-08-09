from passlib.context import CryptContext
from app.services.interfaces.password_service import PasswordService


class PasswordServiceImpl(PasswordService):
    """Implementation of PasswordService using passlib."""

    def __init__(self) -> None:
        self.pwd_context = CryptContext(
            schemes=["bcrypt"],
            deprecated="auto",
        )

    def hash_password(self, password: str) -> str:
        """Hash a plaintext password."""
        return self.pwd_context.hash(password)

    def verify_password(
        self,
        plain_password: str,
        hashed_password: str,
    ) -> bool:
        """Verify a plaintext password against a hashed password."""
        return self.pwd_context.verify(
            plain_password,
            hashed_password,
        )
