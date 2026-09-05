from typing import Optional, Any
from app.exceptions.base_exception import BaseAppException


class IdempotencyException(BaseAppException):
    """Base exception for order idempotency operations."""
    pass


class IdempotencyPayloadMismatchException(IdempotencyException):
    """Raised when an idempotency key is reused with a different request payload."""

    def __init__(
        self,
        message: str = "Idempotency key reuse detected with different order parameters.",
        details: Optional[Any] = None,
    ) -> None:
        super().__init__(message=message, status_code=409, details=details)


class IdempotencyConflictException(IdempotencyException):
    """Raised when a concurrent duplicate order request is already in-flight."""

    def __init__(
        self,
        message: str = "Order request with this idempotency key is currently in-flight.",
        details: Optional[Any] = None,
    ) -> None:
        super().__init__(message=message, status_code=409, details=details)


class IdempotencyUnknownOutcomeException(IdempotencyException):
    """Broker call timed out or otherwise has an unknown execution outcome; reconciliation is required."""
    def __init__(self, message: str = "Broker execution outcome is unknown. Reconcile broker state before retrying."):
        super().__init__(message=message)
