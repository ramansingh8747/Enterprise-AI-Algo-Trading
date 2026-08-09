from app.services.interfaces.auth_service import AuthService
from app.repositories.interfaces.auth_repository import AuthRepository
from app.services.interfaces.password_service import PasswordService
from app.services.interfaces.jwt_service import JwtService
from app.schemas.auth_response import LoginResponse, TokenResponse
from app.exceptions.auth_exceptions import InvalidCredentialsException


class AuthServiceImpl(AuthService):
    """Implementation of AuthService using repository and security services."""

    def __init__(
        self,
        repository: AuthRepository,
        password_service: PasswordService,
        jwt_service: JwtService,
    ) -> None:
        self.repository = repository
        self.password_service = password_service
        self.jwt_service = jwt_service

    def login(self, email: str, password: str) -> LoginResponse:
        """Authenticate a user and return login details."""
        user = self.repository.get_user_by_email(email)
        if not user:
            raise InvalidCredentialsException()

        if not self.password_service.verify_password(password, user.password_hash):
            raise InvalidCredentialsException()

        access_token = self.jwt_service.create_access_token(user.id)
        refresh_token = self.jwt_service.create_refresh_token(user.id)

        self.repository.store_refresh_token(user.id, refresh_token)
        self.repository.update_last_login(user.id)

        return LoginResponse(
            user_id=user.id,
            email=user.email,
            full_name=user.full_name,
            tokens=TokenResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                expires_in=30 * 60,  # Should ideally match settings
            ),
        )

    def refresh_token(self, refresh_token: str) -> LoginResponse:
        """Refresh an authentication token and return updated login details."""
        raise NotImplementedError("refresh_token is not yet implemented")

    def logout(self, refresh_token: str) -> None:
        """Revoke a refresh token to perform a logout."""
        raise NotImplementedError("logout is not yet implemented")
