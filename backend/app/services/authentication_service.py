import uuid

from app.core.logging.logger import logger
from app.core.security.jwt_service import JwtService
from app.core.security.password_service import PasswordService
from app.database.models.user import User, UserRole
from app.database.repositories.user_repository import UserRepository
from app.repositories.interfaces.auth_repository import AuthRepository
from app.exceptions.auth_exceptions import (
    InactiveUserException,
    InvalidCredentialsException,
    InvalidTokenException,
    UserAlreadyExistsException,
    UserNotFoundException,
)
from app.schemas.auth import (
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)


class AuthenticationService:
    """
    Business logic layer for all authentication operations.

    This service orchestrates the repository, password, and JWT layers.
    It contains no SQL, no HTTP concerns, and no raw token parsing.
    """

    def __init__(self, user_repository: UserRepository, auth_repository: AuthRepository) -> None:
        self._repo = user_repository
        self._auth_repo = auth_repository

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def register(self, payload: RegisterRequest) -> UserResponse:
        """
        Register a new user account.
        """
        if self._repo.exists_by_email(payload.email):
            raise UserAlreadyExistsException(payload.email)

        if self._repo.exists_by_username(payload.username):
            raise UserAlreadyExistsException(payload.username)

        user: User = self._repo.create(
            {
                "email": payload.email,
                "username": payload.username,
                "full_name": payload.full_name,
                "password_hash": PasswordService.hash_password(payload.password),
                "role": payload.role,
                "is_active": True,
                "is_verified": False,
            }
        )

        logger.info(
            "User registered | email={} | username={} | role={}",
            user.email,
            user.username,
            user.role,
        )
        return UserResponse.model_validate(user)

    def login(self, payload: LoginRequest) -> TokenResponse:
        """
        Authenticate a user and return a JWT token pair.
        """
        user: User | None = self._repo.get_by_email(payload.email)

        if user is None or not PasswordService.verify_password(
            payload.password, user.password_hash
        ):
            logger.warning("Login failed — invalid credentials | email={}", payload.email)
            raise InvalidCredentialsException()

        if not user.is_active:
            logger.warning("Login rejected — inactive account | email={}", user.email)
            raise InactiveUserException()

        self._repo.update_last_login(user)

        access_token = JwtService.create_access_token(str(user.id))
        refresh_token = JwtService.create_refresh_token(str(user.id))

        self._auth_repo.store_refresh_token(user.id, refresh_token)

        logger.info("Login success | email={} | role={}", user.email, user.role)
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserResponse.model_validate(user),
        )

    def refresh_token(self, payload: RefreshTokenRequest) -> TokenResponse:
        """
        Rotate the token pair using a valid refresh token.
        """
        token_payload = JwtService.decode_token(payload.refresh_token, expected_type="refresh")

        subject: str | None = token_payload.get("sub")
        if not subject:
            raise InvalidTokenException()

        try:
            user_id = uuid.UUID(subject)
        except ValueError:
            raise InvalidTokenException()

        user: User | None = self._repo.get_by_id(user_id)
        if user is None:
            raise UserNotFoundException()

        if not user.is_active:
            raise InactiveUserException()

        # Revoke old refresh token
        self._auth_repo.revoke_refresh_token(payload.refresh_token)

        access_token = JwtService.create_access_token(str(user.id))
        new_refresh_token = JwtService.create_refresh_token(str(user.id))

        # Store new refresh token
        self._auth_repo.store_refresh_token(user.id, new_refresh_token)

        logger.info("Token refreshed | user_id={}", user.id)
        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            user=UserResponse.model_validate(user),
        )

    def get_current_user(self, token: str) -> UserResponse:
        """
        Resolve the currently authenticated user from a bearer access token.
        """
        token_payload = JwtService.decode_token(token, expected_type="access")

        subject: str | None = token_payload.get("sub")
        if not subject:
            raise InvalidTokenException()

        try:
            user_id = uuid.UUID(subject)
        except ValueError:
            raise InvalidTokenException()

        user: User | None = self._repo.get_by_id(user_id)
        if user is None:
            raise UserNotFoundException()

        return UserResponse.model_validate(user)
