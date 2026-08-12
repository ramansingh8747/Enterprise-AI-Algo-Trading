from typing import Any, Optional
from app.exceptions.base_exception import BaseAppException


class BaseStrategyException(BaseAppException):
    """Base exception for Strategy Engine operations."""

    def __init__(
        self,
        message: str,
        status_code: int = 400,
        details: Optional[Any] = None,
    ) -> None:
        super().__init__(message=message, status_code=status_code, details=details)


class StaleDataException(BaseStrategyException):
    """Raised when market data timestamp is missing or exceeds maximum allowed staleness threshold."""

    def __init__(self, message: str, details: Optional[Any] = None) -> None:
        super().__init__(message=message, status_code=400, details=details)


class DuplicateSignalException(BaseStrategyException):
    """Raised when a generated signal has already been processed for a strategy instance."""

    def __init__(self, message: str, details: Optional[Any] = None) -> None:
        super().__init__(message=message, status_code=409, details=details)


class InvalidLifecycleTransitionException(BaseStrategyException):
    """Raised when an invalid status transition is attempted on a strategy instance."""

    def __init__(self, message: str, details: Optional[Any] = None) -> None:
        super().__init__(message=message, status_code=400, details=details)
