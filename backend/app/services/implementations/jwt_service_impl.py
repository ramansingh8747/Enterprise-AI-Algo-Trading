from datetime import datetime, timedelta, UTC
from uuid import UUID
from jose import jwt, JWTError, ExpiredSignatureError
from app.services.interfaces.jwt_service import JwtService
from app.core.config import settings
from app.exceptions.auth_exceptions import InvalidTokenException, ExpiredTokenException


class JwtServiceImpl(JwtService):
    """Implementation of JwtService using jose/PyJWT."""

    def __init__(self) -> None:
        self.secret_key = settings.JWT_SECRET_KEY
        self.algorithm = settings.JWT_ALGORITHM
        self.access_token_expire_minutes = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        self.refresh_token_expire_days = settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS
        self.issuer = "enterprise-api"
        self.audience = "enterprise-app"

    def _create_token(self, user_id: UUID, expires_delta: timedelta) -> str:
        now = datetime.now(UTC)
        expire = now + expires_delta
        payload = {
            "sub": str(user_id),
            "iat": now,
            "exp": expire,
            "iss": self.issuer,
            "aud": self.audience,
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)

    def _verify_token(self, token: str) -> UUID:
        """Helper to verify token claims."""
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm],
                audience=self.audience,
                issuer=self.issuer,
            )
            return UUID(payload["sub"])
        except ExpiredSignatureError:
            raise ExpiredTokenException()
        except JWTError:
            raise InvalidTokenException()

    def create_access_token(self, user_id: UUID) -> str:
        """Create a new access token for a given user."""
        return self._create_token(
            user_id, timedelta(minutes=self.access_token_expire_minutes)
        )

    def create_refresh_token(self, user_id: UUID) -> str:
        """Create a new refresh token for a given user."""
        return self._create_token(
            user_id, timedelta(days=self.refresh_token_expire_days)
        )

    def verify_access_token(self, token: str) -> UUID:
        """Verify an access token and return the user ID."""
        return self._verify_token(token)

    def verify_refresh_token(self, token: str) -> UUID:
        """Verify a refresh token and return the user ID."""
        return self._verify_token(token)
