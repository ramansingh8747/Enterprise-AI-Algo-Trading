from typing import Any, Optional
from app.exceptions.base_exception import BaseAppException


class BaseRiskException(BaseAppException):
    """Base class for risk engine exceptions."""

    def __init__(
        self,
        message: str,
        status_code: int = 400,
        details: Optional[Any] = None,
    ) -> None:
        super().__init__(message=message, status_code=status_code, details=details)


class RiskLimitExceededException(BaseRiskException):
    """Raised when an order violates an order size, notional, position, exposure, or frequency risk limit."""

    def __init__(self, message: str, details: Optional[Any] = None) -> None:
        super().__init__(message=message, status_code=400, details=details)


class TradingHaltedException(BaseRiskException):
    """Raised when global kill switch is active or daily loss / drawdown limit is breached."""

    def __init__(self, message: str, details: Optional[Any] = None) -> None:
        super().__init__(message=message, status_code=400, details=details)
