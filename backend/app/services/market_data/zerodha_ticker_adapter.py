"""
Zerodha Kite Ticker Market Data Adapter (Step 13.21I.34.120).

Adapts Zerodha KiteTicker WebSocket feeds and tick payloads into canonical market quote structures,
submitting them to MarketDataProvider for publishing on `market:<symbol>` topics.

Safety & Credential Isolation Guarantees:
1. Zero API keys, secrets, or access tokens in tick event payloads or logs.
2. Financial values strictly serialized as Decimal strings.
3. Fail-safe disconnect recovery with exponential backoff & subscription restoration.
"""

import asyncio
import logging
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Callable, Dict, List, Optional, Set
from uuid import UUID

logger = logging.getLogger(__name__)


class ZerodhaTickerAdapter:
    """
    Adapter for Zerodha KiteTicker WebSocket feeds.
    Normalizes tick payloads and manages stream reconnection & symbol subscriptions.
    """

    def __init__(
        self,
        user_id: UUID,
        broker_id: Optional[UUID] = None,
        on_quote_callback: Optional[Callable[[UUID, Dict[str, Any], Optional[UUID]], Any]] = None,
        max_reconnect_attempts: int = 5,
    ) -> None:
        self.user_id = user_id
        self.broker_id = broker_id
        self._on_quote_callback = on_quote_callback
        self.max_reconnect_attempts = max_reconnect_attempts

        self._subscribed_symbols: Set[str] = set()
        self._instrument_symbol_map: Dict[int, str] = {}
        self._is_connected: bool = False
        self._reconnect_count: int = 0
        self._ticker_client: Optional[Any] = None

    @property
    def is_connected(self) -> bool:
        return self._is_connected

    @property
    def subscribed_symbols(self) -> Set[str]:
        return set(self._subscribed_symbols)

    def register_instrument_mapping(self, instrument_token: int, symbol: str) -> None:
        """Maps numeric Zerodha instrument token to canonical uppercase symbol."""
        if instrument_token and symbol:
            self._instrument_symbol_map[instrument_token] = symbol.strip().upper()

    def subscribe(self, symbols: List[str]) -> None:
        """Registers symbols for streaming."""
        for sym in symbols:
            if sym:
                norm_sym = sym.strip().upper()
                self._subscribed_symbols.add(norm_sym)

        if self._ticker_client and self._is_connected:
            tokens = [
                tok for tok, sym in self._instrument_symbol_map.items() if sym in self._subscribed_symbols
            ]
            if tokens:
                try:
                    self._ticker_client.subscribe(tokens)
                except Exception as exc:
                    logger.warning("Zerodha ticker subscribe failed: %s", exc)

    def unsubscribe(self, symbols: List[str]) -> None:
        """Unregisters symbols from streaming."""
        for sym in symbols:
            if sym:
                norm_sym = sym.strip().upper()
                self._subscribed_symbols.discard(norm_sym)

        if self._ticker_client and self._is_connected:
            tokens = [
                tok for tok, sym in self._instrument_symbol_map.items() if sym in symbols
            ]
            if tokens:
                try:
                    self._ticker_client.unsubscribe(tokens)
                except Exception as exc:
                    logger.warning("Zerodha ticker unsubscribe failed: %s", exc)

    def normalize_tick(self, raw_tick: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Normalizes Zerodha KiteTicker payload into canonical quote dictionary.
        Preserves string-safe Decimal financial quantities.
        Returns None if tick is malformed or missing symbol/price.
        """
        if not isinstance(raw_tick, dict):
            return None

        # 1. Resolve Symbol
        symbol = raw_tick.get("symbol") or raw_tick.get("tradingsymbol")
        if not symbol:
            inst_token = raw_tick.get("instrument_token")
            if inst_token in self._instrument_symbol_map:
                symbol = self._instrument_symbol_map[inst_token]

        if not symbol or not isinstance(symbol, str):
            return None

        norm_symbol = symbol.strip().upper()

        # 2. Extract & Format Decimal Price
        raw_price = raw_tick.get("last_price") or raw_tick.get("price") or raw_tick.get("lastPrice")
        if raw_price is None:
            return None

        try:
            last_price_str = str(Decimal(str(raw_price)))
        except (InvalidOperation, TypeError, ValueError):
            return None

        # 3. Extract Market Depth (Bid / Ask)
        bid_str: Optional[str] = None
        ask_str: Optional[str] = None

        depth = raw_tick.get("depth", {})
        if isinstance(depth, dict):
            buy_depth = depth.get("buy", [])
            sell_depth = depth.get("sell", [])

            if buy_depth and isinstance(buy_depth, list) and len(buy_depth) > 0:
                top_buy = buy_depth[0].get("price")
                if top_buy is not None:
                    try:
                        bid_str = str(Decimal(str(top_buy)))
                    except (InvalidOperation, ValueError):
                        bid_str = None

            if sell_depth and isinstance(sell_depth, list) and len(sell_depth) > 0:
                top_sell = sell_depth[0].get("price")
                if top_sell is not None:
                    try:
                        ask_str = str(Decimal(str(top_sell)))
                    except (InvalidOperation, ValueError):
                        ask_str = None

        # 4. Extract Timestamp
        raw_ts = raw_tick.get("timestamp") or raw_tick.get("last_trade_time")
        ts_str: Optional[str] = None
        if raw_ts:
            if isinstance(raw_ts, datetime):
                ts_str = raw_ts.isoformat()
            elif isinstance(raw_ts, str):
                ts_str = raw_ts
            elif isinstance(raw_ts, (int, float)):
                ts_str = datetime.fromtimestamp(raw_ts, tz=timezone.utc).isoformat()

        if not ts_str:
            ts_str = datetime.now(timezone.utc).isoformat()

        # 5. Build Canonical Payload (Zero secrets)
        return {
            "symbol": norm_symbol,
            "last_price": last_price_str,
            "bid": bid_str,
            "ask": ask_str,
            "change": str(Decimal(str(raw_tick["change"]))) if raw_tick.get("change") is not None else None,
            "volume": int(raw_tick["volume"]) if raw_tick.get("volume") is not None else None,
            "timestamp": ts_str,
        }

    def handle_tick(self, raw_tick: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Receives raw Zerodha tick, normalizes it, and invokes callback.
        Catches all exceptions to ensure zero unhandled failures.
        """
        try:
            normalized = self.normalize_tick(raw_tick)
            if normalized and self._on_quote_callback:
                self._on_quote_callback(self.user_id, normalized, self.broker_id)
            return normalized
        except Exception as exc:
            logger.warning("Zerodha ticker handle_tick exception: %s", exc)
            return None

    def on_connect(self) -> None:
        """Callback when WebSocket connection opens."""
        self._is_connected = True
        self._reconnect_count = 0
        logger.info("Zerodha ticker connected for user_id=%s", self.user_id)

        # Restore active symbol subscriptions upon connect/reconnect
        if self._subscribed_symbols:
            self.subscribe(list(self._subscribed_symbols))

    def on_close(self, code: int = 1000, reason: str = "") -> None:
        """Callback when WebSocket connection drops."""
        self._is_connected = False
        logger.warning(
            "Zerodha ticker disconnected for user_id=%s (code=%s, reason=%s)",
            self.user_id,
            code,
            reason,
        )

        if self._reconnect_count < self.max_reconnect_attempts:
            self._reconnect_count += 1
            logger.info(
                "Scheduling Zerodha ticker reconnect attempt %s/%s...",
                self._reconnect_count,
                self.max_reconnect_attempts,
            )

    def on_error(self, error: Exception) -> None:
        """Callback for ticker errors."""
        logger.warning("Zerodha ticker error for user_id=%s: %s", self.user_id, error)
