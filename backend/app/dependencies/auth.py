from typing import Annotated, List

from fastapi import Depends, WebSocket
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.logging.logger import logger
from app.database.models.user import UserRole
from app.database.repositories.user_repository import UserRepository
from app.repositories.interfaces.auth_repository import AuthRepository
from app.repositories.implementations.auth_repository_impl import AuthRepositoryImpl
from app.dependencies.database import get_db
from app.exceptions.auth_exceptions import (
    ForbiddenException,
    InactiveUserException,
    UnauthorizedException,
)
from app.schemas.auth import UserResponse
from app.services.authentication_service import AuthenticationService

_bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Repository factory
# ---------------------------------------------------------------------------

def get_user_repository(db: Annotated[Session, Depends(get_db)]) -> UserRepository:
    """FastAPI dependency that constructs a scoped UserRepository."""
    return UserRepository(db)

def get_auth_repository(db: Annotated[Session, Depends(get_db)]) -> AuthRepository:
    """FastAPI dependency that constructs a scoped AuthRepository."""
    return AuthRepositoryImpl(db)


# ---------------------------------------------------------------------------
# Service factory
# ---------------------------------------------------------------------------

def get_authentication_service(
    user_repo: Annotated[UserRepository, Depends(get_user_repository)],
    auth_repo: Annotated[AuthRepository, Depends(get_auth_repository)],
) -> AuthenticationService:
    """FastAPI dependency that constructs an AuthenticationService."""
    return AuthenticationService(user_repo, auth_repo)


# ---------------------------------------------------------------------------
# Current-user resolution
# ---------------------------------------------------------------------------

def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)],
    service: Annotated[AuthenticationService, Depends(get_authentication_service)],
) -> UserResponse:
    """
    FastAPI dependency that extracts and validates the Bearer token from the
    ``Authorization`` header, then resolves the corresponding user.

    Raises:
        UnauthorizedException: If no credentials are present.
        InvalidTokenException: If the token is malformed.
        ExpiredTokenException: If the token has expired.
        UserNotFoundException: If the user no longer exists.
    """
    if credentials is None:
        logger.warning("Unauthorized access attempt — no bearer token provided")
        raise UnauthorizedException()

    return service.get_current_user(credentials.credentials)


def get_current_user_ws(
    websocket: WebSocket,
    service: Annotated[AuthenticationService, Depends(get_authentication_service)],
) -> UserResponse:
    """
    FastAPI dependency for WebSocket connection authentication.
    Extracts token from query parameter ``token`` or ``Authorization`` header.
    """
    token = websocket.query_params.get("token")
    if not token:
        auth_header = websocket.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        logger.warning("Unauthorized WebSocket access attempt — no token provided")
        raise UnauthorizedException()

    return service.get_current_user(token)


def get_current_active_user_ws(
    current_user: Annotated[UserResponse, Depends(get_current_user_ws)],
) -> UserResponse:
    """FastAPI dependency that enforces the authenticated WebSocket user is active."""
    if not current_user.is_active:
        raise InactiveUserException()
    return current_user


def get_current_active_user(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> UserResponse:
    """
    FastAPI dependency that enforces the user account is active.

    Raises:
        InactiveUserException: If the authenticated user's account is deactivated.
    """
    if not current_user.is_active:
        raise InactiveUserException()
    return current_user


# ---------------------------------------------------------------------------
# Role-based authorisation
# ---------------------------------------------------------------------------

class RoleChecker:
    """
    FastAPI dependency class for declarative role-based access control.

    Usage::

        @router.get("/admin-only", dependencies=[Depends(RoleChecker(["ADMIN"]))])
        async def admin_endpoint(): ...
    """

    def __init__(self, allowed_roles: List[UserRole]) -> None:
        self._allowed_roles = allowed_roles

    def __call__(
        self,
        current_user: Annotated[UserResponse, Depends(get_current_active_user)],
    ) -> UserResponse:
        """
        Verify the current user holds one of the allowed roles.

        Raises:
            ForbiddenException: If the user's role is not in the allowed set.
        """
        if current_user.role not in self._allowed_roles:
            logger.warning(
                "Forbidden access | user_id={} | role={} | required={}",
                current_user.id,
                current_user.role,
                self._allowed_roles,
            )
            raise ForbiddenException()
        return current_user
