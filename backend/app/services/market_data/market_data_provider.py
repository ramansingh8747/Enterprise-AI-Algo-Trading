"""
Market Data Provider & Streaming Adapter Service (Step 13.21I.34.119).

Provides quote validation, symbol normalization, stale data guard, Decimal string formatting,
and fail-safe event publishing to the EventBus on `market:<symbol>` topics.
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Optional, Set
from uuid import UUID

from app.services.event_bus.interfaces import EventPublisher
from app.services.event_bus.models import Event, EventType
from app.services.event_bus.topics import Topic

logger = logging.getLogger(__name__)


class MarketDataProvider:
    """
    Real-time Market Data Provider & Adapter.
    Publishes normalized, validated quote updates and stale quote notifications
    to the EventBus on `market:<symbol>` topics.
    """

    def __init__(
        self,
        event_publisher: Optional[EventPublisher] = None,
        max_quote_age_seconds: int = 10,
    ) -> None:
        self._event_publisher = event_publisher
        self.max_quote_age_seconds = max_quote_age_seconds
        self._subscribed_symbols: Set[str] = set()

    def subscribe_symbol(self, symbol: str) -> str:
        """Registers a symbol for quote streaming."""
        norm_symbol = self.normalize_symbol(symbol)
        if norm_symbol:
            self._subscribed_symbols.add(norm_symbol)
        return norm_symbol

    def unsubscribe_symbol(self, symbol: str) -> str:
        """Unregisters a symbol from quote streaming."""
        norm_symbol = self.normalize_symbol(symbol)
        if norm_symbol in self._subscribed_symbols:
            self._subscribed_symbols.remove(norm_symbol)
        return norm_symbol

    def is_subscribed(self, symbol: str) -> bool:
        """Checks if a symbol is subscribed."""
        return self.normalize_symbol(symbol) in self._subscribed_symbols

    @staticmethod
    def normalize_symbol(symbol: Optional[str]) -> str:
        """Normalizes symbol string to uppercase stripped canonical format."""
        if not symbol or not isinstance(symbol, str):
            return ""
        return symbol.strip().upper()

    def _parse_timestamp(self, raw_ts: Any) -> Optional[datetime]:
        """Parses raw timestamp into timezone-aware UTC datetime."""
        if not raw_ts:
            return None
        try:
            if isinstance(raw_ts, (int, float)):
                return datetime.fromtimestamp(raw_ts, tz=timezone.utc)
            elif isinstance(raw_ts, str):
                return datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
            elif isinstance(raw_ts, datetime):
                if raw_ts.tzinfo is None:
                    return raw_ts.replace(tzinfo=timezone.utc)
                return raw_ts
        except Exception:
            return None
        return None

    def _to_decimal_str(self, val: Any) -> Optional[str]:
        """Converts price value to string-safe fixed Decimal format without floats."""
        if val is None:
            return None
        try:
            d = Decimal(str(val))
            return str(d)
        except (InvalidOperation, TypeError, ValueError):
            return None

    def process_and_publish_quote(
        self,
        user_id: UUID,
        raw_quote: Dict[str, Any],
        broker_id: Optional[UUID] = None,
    ) -> Optional[Event]:
        """
        Validates raw market quote, applies Stale Data Guard, normalizes Decimal financial values,
        and publishes `quote.updated` or `quote.stale` to `market:<symbol>` topic.

        FAIL-SAFE: Any EventBus or publishing error is caught and logged, returning None
        without raising exceptions to caller.
        """
        if not isinstance(raw_quote, dict):
            logger.warning("Invalid raw quote format: expected dictionary.")
            return None

        raw_sym = raw_quote.get("symbol") or raw_quote.get("tradingsymbol") or raw_quote.get("name")
        symbol = self.normalize_symbol(raw_sym)
        if not symbol:
            logger.warning("Market quote missing valid symbol. Rejected.")
            return None

        # 1. Price validation
        raw_price = (
            raw_quote.get("last_price")
            or raw_quote.get("price")
            or raw_quote.get("lastPrice")
            or raw_quote.get("close")
        )
        price_str = self._to_decimal_str(raw_price)
        if price_str is None:
            logger.warning(f"Market quote for {symbol} missing valid price. Rejected.")
            return None

        # 2. Timestamp & Staleness validation
        raw_ts = (
            raw_quote.get("timestamp")
            or raw_quote.get("generatedAt")
            or raw_quote.get("time")
            or raw_quote.get("updated_at")
        )
        ts_dt = self._parse_timestamp(raw_ts)

        now = datetime.now(timezone.utc)
        if ts_dt is None:
            # If timestamp missing, mark as stale / invalid
            return self.mark_quote_stale(
                user_id=user_id,
                symbol=symbol,
                reason="Missing timestamp",
                broker_id=broker_id,
            )

        age = (now - ts_dt).total_seconds()
        if age > self.max_quote_age_seconds or age < -300:
            return self.mark_quote_stale(
                user_id=user_id,
                symbol=symbol,
                reason=f"Stale quote ({age:.1f}s old, max {self.max_quote_age_seconds}s)",
                broker_id=broker_id,
            )

        # 3. Construct safe payload with string Decimals
        bid_str = self._to_decimal_str(raw_quote.get("bid") or raw_quote.get("bid_price"))
        ask_str = self._to_decimal_str(raw_quote.get("ask") or raw_quote.get("ask_price"))
        change_str = self._to_decimal_str(raw_quote.get("change"))
        change_pct_str = self._to_decimal_str(
            raw_quote.get("change_percent") or raw_quote.get("changePercent")
        )
        volume_val = raw_quote.get("volume")

        payload = {
            "symbol": symbol,
            "last_price": price_str,
            "bid": bid_str,
            "ask": ask_str,
            "change": change_str,
            "change_percent": change_pct_str,
            "volume": int(volume_val) if volume_val is not None and str(volume_val).isdigit() else None,
            "timestamp": ts_dt.isoformat(),
            "is_stale": False,
        }

        # 4. Construct Event & Publish safely
        event = Event(
            event_id=uuid.uuid4(),
            event_type=EventType.QUOTE_UPDATED,
            timestamp=now,
            user_id=user_id,
            broker_id=broker_id,
            symbol=symbol,
            payload=payload,
        )

        topic = Topic.market(symbol)
        self._publish_event_safe(topic, event)
        return event

    def mark_quote_stale(
        self,
        user_id: UUID,
        symbol: str,
        reason: str,
        broker_id: Optional[UUID] = None,
    ) -> Optional[Event]:
        """Publishes `quote.stale` event to `market:<symbol>` topic."""
        norm_symbol = self.normalize_symbol(symbol)
        if not norm_symbol:
            return None

        now = datetime.now(timezone.utc)
        payload = {
            "symbol": norm_symbol,
            "is_stale": True,
            "reason": reason,
            "timestamp": now.isoformat(),
        }

        event = Event(
            event_id=uuid.uuid4(),
            event_type=EventType.QUOTE_STALE,
            timestamp=now,
            user_id=user_id,
            broker_id=broker_id,
            symbol=norm_symbol,
            payload=payload,
        )

        topic = Topic.market(norm_symbol)
        self._publish_event_safe(topic, event)
        return event

    def _publish_event_safe(self, topic: str, event: Event) -> None:
        """FAIL-SAFE EventBus publisher wrapper."""
        if not self._event_publisher:
            return

        try:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                loop.create_task(self._async_publish(topic, event))
            else:
                asyncio.run(self._async_publish(topic, event))
        except Exception as exc:
            logger.warning(
                "Market quote publish failed for symbol=%s event_type=%s: %s",
                event.symbol,
                event.event_type,
                exc,
            )

    async def _async_publish(self, topic: str, event: Event) -> None:
        try:
            if self._event_publisher:
                await self._event_publisher.publish(topic, event)
        except Exception as exc:
            logger.warning(
                "Async market quote publish error on topic=%s event_type=%s: %s",
                topic,
                event.event_type,
                exc,
            )
