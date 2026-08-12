from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from decimal import Decimal


class BaseStrategy(ABC):
    """Abstract interface for server-side trading strategy implementations."""

    @abstractmethod
    def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Evaluates market data input and produces a proposed signal dict or None.
        Signal format: {
            "symbol": str,
            "side": "BUY" | "SELL",
            "quantity": Decimal,
            "order_type": "MARKET" | "LIMIT",
            "price": Optional[Decimal]
        }
        """
        pass


class DeterministicMomentumStrategy(BaseStrategy):
    """Deterministic momentum breakout test strategy for backend worker integration."""

    def __init__(self, default_quantity: Decimal = Decimal("10")) -> None:
        self.default_quantity = default_quantity

    def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        symbol = market_data.get("symbol")
        change_pct = market_data.get("change_percent") or market_data.get("changePercent") or 0.0
        price_val = market_data.get("price") or market_data.get("last_price")

        if not symbol or price_val is None:
            return None

        price = Decimal(str(price_val))
        change_pct = float(change_pct)

        if change_pct >= 1.0:
            return {
                "symbol": str(symbol).upper(),
                "side": "BUY",
                "quantity": self.default_quantity,
                "order_type": "MARKET",
                "price": price,
            }
        elif change_pct <= -1.0:
            return {
                "symbol": str(symbol).upper(),
                "side": "SELL",
                "quantity": self.default_quantity,
                "order_type": "MARKET",
                "price": price,
            }

        return None
