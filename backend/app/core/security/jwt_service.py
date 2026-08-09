import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError

from app.core.config import settings
from app.exceptions.auth_exceptions import ExpiredTokenException, InvalidTokenException


class JwtService:
    """
    Service responsible for issuing and validating JWT access and refresh tokens.

    Token configuration is sourced exclusively from application Settings.
    """

    @staticmethod
    def _create_token(subject: str, token_type: str, expires_delta: timedelta) -> str:
        """
        Internal helper to build and sign a JWT.

        Args:
            subject: The unique identifier (UUID string) of the authenticated user.
            token_type: Either "access" or "refresh" — stored in the ``type`` claim.
            expires_delta: Lifetime of the token from the current UTC moment.

        Returns:
            A signed JWT string.
        """
        now = datetime.now(timezone.utc)
        expire = now + expires_delta

        payload: dict[str, Any] = {
            "sub": subject,
            "type": token_type,
            "jti": str(uuid.uuid4()),
            "iat": now,
            "exp": expire,
        }

        return jwt.encode(
            payload,
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )

    @classmethod
    def create_access_token(cls, subject: str) -> str:
        """
        Issue a short-lived access token for the given subject.

        Args:
            subject: The user's UUID as a string.

        Returns:
            A signed JWT access token.
        """
        return cls._create_token(
            subject=subject,
            token_type="access",
            expires_delta=timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
        )

    @classmethod
    def create_refresh_token(cls, subject: str) -> str:
        """
        Issue a long-lived refresh token for the given subject.

        Args:
            subject: The user's UUID as a string.

        Returns:
            A signed JWT refresh token.
        """
        return cls._create_token(
            subject=subject,
            token_type="refresh",
            expires_delta=timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
        )

    @staticmethod
    def decode_token(token: str, expected_type: str) -> dict[str, Any]:
        """
        Decode and validate a JWT, asserting it carries the expected type claim.

        Args:
            token: The raw JWT string to validate.
            expected_type: The expected value of the ``type`` claim ("access" or "refresh").

        Returns:
            The decoded payload dictionary.

        Raises:
            ExpiredTokenException: If the token has passed its expiry time.
            InvalidTokenException: If the token is malformed, the signature is invalid,
                                   or the type claim does not match.
        """
        try:
            payload: dict[str, Any] = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
            )
        except ExpiredSignatureError:
            raise ExpiredTokenException()
        except JWTError:
            raise InvalidTokenException()

        if payload.get("type") != expected_type:
            raise InvalidTokenException()

        return payload
