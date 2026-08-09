from abc import ABC, abstractmethod
from typing import List, Any
from app.brokers.base.broker_types import (
    BrokerProfile, BrokerHolding, BrokerPosition, BrokerOrder, BrokerQuote, BrokerOrderActionResult, BrokerCancelOrderRequest
)


class BrokerInterface(ABC):
    """Abstract interface for trading broker operations."""

    @abstractmethod
    def connect(self) -> None:
        """Establish connection to the broker."""
        pass

    @abstractmethod
    def disconnect(self) -> None:
        """Terminate connection to the broker."""
        pass

    @abstractmethod
    def refresh_session(self) -> None:
        """Refresh the broker session."""
        pass

    @abstractmethod
    def get_profile(self) -> BrokerProfile:
        """Retrieve broker account profile."""
        pass

    @abstractmethod
    def get_holdings(self) -> List[BrokerHolding]:
        """Retrieve current account holdings."""
        pass

    @abstractmethod
    def get_positions(self) -> List[BrokerPosition]:
        """Retrieve open positions."""
        pass

    @abstractmethod
    def get_orders(self) -> List[BrokerOrder]:
        """Retrieve recent orders."""
        pass

    @abstractmethod
    def place_order(self, order_data: Any) -> BrokerOrder:
        """Place a new order."""
        pass

    @abstractmethod
    def modify_order(self, order_id: str, order_data: Any) -> BrokerOrderActionResult:
        """Modify an existing order."""
        pass

    @abstractmethod
    def cancel_order(self, request: BrokerCancelOrderRequest) -> BrokerOrderActionResult:
        """Cancel an existing order."""
        pass

    @abstractmethod
    def get_quotes(self, symbols: List[str]) -> List[BrokerQuote]:
        """Get market quotes for specified symbols."""
        pass
