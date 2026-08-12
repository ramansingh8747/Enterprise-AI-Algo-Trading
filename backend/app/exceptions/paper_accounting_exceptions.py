from typing import Any, Optional
from app.exceptions.base_exception import BaseAppException


class BasePaperAccountingException(BaseAppException):
    """Base exception for Paper Portfolio & Accounting operations."""

    def __init__(
        self,
        message: str,
        status_code: int = 400,
        details: Optional[Any] = None,
    ) -> None:
        super().__init__(message=message, status_code=status_code, details=details)


class PaperPortfolioNotFoundException(BasePaperAccountingException):
    """Raised when a target PaperPortfolio cannot be found for user or strategy."""

    def __init__(self, message: str, details: Optional[Any] = None) -> None:
        super().__init__(message=message, status_code=404, details=details)


class PaperPositionNotFoundException(BasePaperAccountingException):
    """Raised when a target PaperPosition cannot be found."""

    def __init__(self, message: str, details: Optional[Any] = None) -> None:
        super().__init__(message=message, status_code=404, details=details)


class InvalidExecutionModeException(BasePaperAccountingException):
    """Raised when non-PAPER execution mode is passed to PaperAccountingService."""

    def __init__(self, message: str, details: Optional[Any] = None) -> None:
        super().__init__(message=message, status_code=400, details=details)


class InvalidPaperFillException(BasePaperAccountingException):
    """Raised when paper fill parameters are invalid (e.g. quantity <= 0 or price < 0)."""

    def __init__(self, message: str, details: Optional[Any] = None) -> None:
        super().__init__(message=message, status_code=400, details=details)


class InsufficientPaperPositionException(BasePaperAccountingException):
    """Raised when attempting to SELL more quantity than currently open in paper position."""

    def __init__(self, message: str, details: Optional[Any] = None) -> None:
        super().__init__(message=message, status_code=400, details=details)


class InsufficientPaperCashException(BasePaperAccountingException):
    """Raised when attempting a paper BUY order exceeding available paper cash balance / buying power."""

    def __init__(self, message: str, details: Optional[Any] = None) -> None:
        super().__init__(message=message, status_code=400, details=details)


class DuplicatePaperExecutionException(BasePaperAccountingException):
    """Raised when a paper execution fill has already been processed."""

    def __init__(self, message: str, details: Optional[Any] = None) -> None:
        super().__init__(message=message, status_code=409, details=details)


class StaleQuoteDataException(BasePaperAccountingException):
    """Raised when a market quote timestamp is missing, malformed, stale, or in the future."""

    def __init__(self, message: str, details: Optional[Any] = None) -> None:
        super().__init__(message=message, status_code=400, details=details)


class InvalidQuoteException(BasePaperAccountingException):
    """Raised when a quote price is invalid (<= 0, NaN, or non-decimal)."""

    def __init__(self, message: str, details: Optional[Any] = None) -> None:
        super().__init__(message=message, status_code=400, details=details)
