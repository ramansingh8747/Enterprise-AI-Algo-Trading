import bcrypt


class PasswordService:
    """
    Service responsible for password hashing and verification using bcrypt.

    Plain-text passwords are never stored or logged anywhere in this service.
    Input passwords are safely encoded and constrained to 72 bytes per bcrypt standard.
    """

    @classmethod
    def hash_password(cls, plain_password: str) -> str:
        """
        Hash a plain-text password using bcrypt.

        Args:
            plain_password: The raw password provided by the user.

        Returns:
            A bcrypt-hashed string suitable for database storage.
        """
        password_bytes = plain_password.encode("utf-8")[:72]
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password_bytes, salt).decode("utf-8")

    @classmethod
    def verify_password(cls, plain_password: str, hashed_password: str) -> bool:
        """
        Verify a plain-text password against a stored bcrypt hash.

        Args:
            plain_password: The raw password provided by the user at login.
            hashed_password: The bcrypt hash retrieved from the database.

        Returns:
            True if the password matches, False otherwise.
        """
        password_bytes = plain_password.encode("utf-8")[:72]
        hash_bytes = hashed_password.encode("utf-8")
        try:
            return bcrypt.checkpw(password_bytes, hash_bytes)
        except Exception:
            return False
