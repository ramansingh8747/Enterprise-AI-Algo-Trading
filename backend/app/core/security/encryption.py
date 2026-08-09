from cryptography.fernet import Fernet, InvalidToken
from app.core.config import settings

class EncryptionUtility:
    """Utility for symmetric encryption of sensitive fields."""

    def __init__(self) -> None:
        if not settings.BROKER_SECRET_KEY:
            raise ValueError("BROKER_SECRET_KEY must be set in environment variables.")
        
        try:
            self.fernet = Fernet(settings.BROKER_SECRET_KEY.encode())
        except Exception as e:
            raise ValueError(f"Invalid BROKER_SECRET_KEY: {e}")

    def encrypt(self, plain_text: str) -> str:
        """Encrypts a plaintext string."""
        return self.fernet.encrypt(plain_text.encode()).decode()

    def decrypt(self, encrypted_text: str) -> str:
        """Decrypts an encrypted string."""
        try:
            return self.fernet.decrypt(encrypted_text.encode()).decode()
        except InvalidToken:
            raise ValueError("Decryption failed: Invalid token or key.")
