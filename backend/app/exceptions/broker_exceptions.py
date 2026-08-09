from typing import Any
from app.exceptions.base_exception import BaseAppException

class BrokerException(BaseAppException):
    """Base class for all broker-related exceptions."""
    def __init__(self, message: str = "Broker error occurred", status_code: int = 500, details: Any = None) -> None:
        super().__init__(message, status_code, details)

class BrokerSessionExpiredException(BrokerException):
    """Raised when the broker session has expired."""
    def __init__(self, message: str = "Broker session expired", details: Any = None) -> None:
        super().__init__(message, status_code=401, details=details)

class BrokerOrderException(BrokerException):
    """Raised when an order-related operation fails."""
    def __init__(self, message: str = "Broker order operation failed", details: Any = None) -> None:
        super().__init__(message, status_code=400, details=details)

class BrokerNetworkException(BrokerException):
    """Raised when a network-related issue occurs with the broker."""
    def __init__(self, message: str = "Broker network error occurred", status_code: int = 503, details: Any = None) -> None:
        super().__init__(message, status_code=503, details=details)
