from http import HTTPStatus
from app.exceptions.base_exception import BaseAppException


class InvalidCredentialsException(BaseAppException):
    """Raised when email/password combination is invalid."""

    def __init__(self) -> None:
        super().__init__(
            message="Invalid email or password.",
            status_code=HTTPStatus.UNAUTHORIZED.value,
        )


class UserAlreadyExistsException(BaseAppException):
    """Raised when attempting to register with an already-registered email."""

    def __init__(self, email: str) -> None:
        super().__init__(
            message=f"A user with email '{email}' already exists.",
            status_code=HTTPStatus.CONFLICT.value,
        )


class UserNotFoundException(BaseAppException):
    """Raised when a requested user cannot be located."""

    def __init__(self) -> None:
        super().__init__(
            message="User not found.",
            status_code=HTTPStatus.NOT_FOUND.value,
        )


class InvalidTokenException(BaseAppException):
    """Raised when a token is malformed or has an invalid signature."""

    def __init__(self) -> None:
        super().__init__(
            message="The provided token is invalid.",
            status_code=HTTPStatus.UNAUTHORIZED.value,
        )


class ExpiredTokenException(BaseAppException):
    """Raised when a token has passed its expiry time."""

    def __init__(self) -> None:
        super().__init__(
            message="The provided token has expired.",
            status_code=HTTPStatus.UNAUTHORIZED.value,
        )


class UnauthorizedException(BaseAppException):
    """Raised when a request lacks valid authentication credentials."""

    def __init__(self, message: str = "Authentication required.") -> None:
        super().__init__(
            message=message,
            status_code=HTTPStatus.UNAUTHORIZED.value,
        )


class ForbiddenException(BaseAppException):
    """Raised when an authenticated user lacks the required permissions."""

    def __init__(self, message: str = "You do not have permission to perform this action.") -> None:
        super().__init__(
            message=message,
            status_code=HTTPStatus.FORBIDDEN.value,
        )


class InactiveUserException(BaseAppException):
    """Raised when an inactive user attempts to authenticate."""

    def __init__(self) -> None:
        super().__init__(
            message="This account has been deactivated. Please contact support.",
            status_code=HTTPStatus.FORBIDDEN.value,
        )


class BrokerAlreadyExistsException(BaseAppException):
    """Raised when attempting to register a broker with a duplicate name."""

    def __init__(self, broker_name: str) -> None:
        super().__init__(
            message=f"A broker with name '{broker_name}' already exists.",
            status_code=HTTPStatus.CONFLICT.value,
        )


class BrokerNotFoundException(BaseAppException):
    """Raised when a requested broker cannot be located."""

    def __init__(self, broker_id: str) -> None:
        super().__init__(
            message=f"Broker with ID '{broker_id}' not found.",
            status_code=HTTPStatus.NOT_FOUND.value,
        )
