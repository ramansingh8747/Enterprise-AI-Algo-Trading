"""
Live Market Data Manager & Broker Stream Adapter Manager (Steps 13.21I.34.120 & 13.21I.34.121).

Bridges live broker WebSocket ticker feeds (Zerodha, AngelOne, etc.) with MarketDataProvider,
enforcing symbol topic routing, Decimal string formatting, Stale Data Guard, and fail-safe EventBus publishing.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from app.services.event_bus.models import Event
from app.services.market_data.market_data_provider import MarketDataProvider
from app.services.market_data.zerodha_ticker_adapter import ZerodhaTickerAdapter
from app.services.market_data.angelone_ticker_adapter import AngelOneTickerAdapter

logger = logging.getLogger(__name__)


class LiveMarketDataManager:
    """
    Manager for orchestrating real-time broker market data feeds.
    Connects active broker ticker instances with MarketDataProvider.
    """

    def __init__(self, market_data_provider: MarketDataProvider) -> None:
        self.provider = market_data_provider
        # Map (user_id, broker_name) -> adapter
        self._adapters: Dict[Tuple[UUID, str], Any] = {}

    def get_adapter(self, user_id: UUID, broker_name: str) -> Optional[Any]:
        """Retrieves active ticker adapter for user and broker."""
        key = (user_id, broker_name.lower())
        return self._adapters.get(key)

    def register_adapter(self, user_id: UUID, broker_name: str, adapter: Any) -> None:
        """Registers a live broker ticker adapter."""
        key = (user_id, broker_name.lower())
        self._adapters[key] = adapter
        logger.info("Registered broker ticker adapter: user_id=%s broker=%s", user_id, broker_name)

    def unregister_adapter(self, user_id: UUID, broker_name: str) -> None:
        """Unregisters and closes a live broker ticker adapter."""
        key = (user_id, broker_name.lower())
        adapter = self._adapters.pop(key, None)
        if adapter and hasattr(adapter, "on_close"):
            try:
                adapter.on_close()
            except Exception as exc:
                logger.warning("Error closing adapter for user_id=%s broker=%s: %s", user_id, broker_name, exc)

    def create_zerodha_adapter(
        self,
        user_id: UUID,
        broker_id: Optional[UUID] = None,
    ) -> ZerodhaTickerAdapter:
        """
        Creates and registers a ZerodhaTickerAdapter configured to feed quotes into MarketDataProvider.
        """
        adapter = ZerodhaTickerAdapter(
            user_id=user_id,
            broker_id=broker_id,
            on_quote_callback=self.process_live_broker_tick,
        )
        self.register_adapter(user_id, "zerodha", adapter)
        return adapter

    def create_angelone_adapter(
        self,
        user_id: UUID,
        broker_id: Optional[UUID] = None,
    ) -> AngelOneTickerAdapter:
        """
        Creates and registers an AngelOneTickerAdapter configured to feed quotes into MarketDataProvider.
        """
        adapter = AngelOneTickerAdapter(
            user_id=user_id,
            broker_id=broker_id,
            on_quote_callback=self.process_live_broker_tick,
        )
        self.register_adapter(user_id, "angelone", adapter)
        return adapter

    def process_live_broker_tick(
        self,
        user_id: UUID,
        raw_tick: Dict[str, Any],
        broker_id: Optional[UUID] = None,
    ) -> Optional[Event]:
        """
        Receives normalized or raw broker tick, passes it to MarketDataProvider for validation,
        stale guard checking, and EventBus publishing.
        """
        try:
            return self.provider.process_and_publish_quote(
                user_id=user_id,
                raw_quote=raw_tick,
                broker_id=broker_id,
            )
        except Exception as exc:
            logger.warning("Failed to process live broker tick for user_id=%s: %s", user_id, exc)
            return None

    def subscribe_symbol(self, user_id: UUID, symbol: str, broker_name: str = "zerodha") -> str:
        """Subscribes to a symbol across MarketDataProvider and active broker adapter."""
        norm_symbol = self.provider.subscribe_symbol(symbol)

        adapter = self.get_adapter(user_id, broker_name)
        if adapter and hasattr(adapter, "subscribe"):
            try:
                adapter.subscribe([norm_symbol])
            except Exception as exc:
                logger.warning("Broker adapter subscribe error for symbol %s: %s", norm_symbol, exc)

        return norm_symbol

    def unsubscribe_symbol(self, user_id: UUID, symbol: str, broker_name: str = "zerodha") -> str:
        """Unsubscribes from a symbol across MarketDataProvider and active broker adapter."""
        norm_symbol = self.provider.unsubscribe_symbol(symbol)

        adapter = self.get_adapter(user_id, broker_name)
        if adapter and hasattr(adapter, "unsubscribe"):
            try:
                adapter.unsubscribe([norm_symbol])
            except Exception as exc:
                logger.warning("Broker adapter unsubscribe error for symbol %s: %s", norm_symbol, exc)

        return norm_symbol
