"""
Market Data Sanitizer & Price Circuit Anomaly Detector.

Protects Algo Trading strategies, stop-loss calculations, and portfolio valuation
from outlier market ticks, erroneous exchange feed spikes, and unadjusted split data
(e.g., Kotak Bank tick at ₹390.25 vs real price ₹1,800+).
"""

from decimal import Decimal
from typing import Dict, Any, Tuple, Optional
import logging

logger = logging.getLogger(__name__)


class MarketDataSanitizer:
    """Detects and sanitizes outlier price ticks exceeding intraday circuit limits."""

    @classmethod
    def validate_and_sanitize_quote(
        cls,
        market_data: Dict[str, Any],
        max_deviation_pct: float = 20.0,
        fallback_price: Optional[float] = None,
    ) -> Tuple[bool, Dict[str, Any], str]:
        """
        Validates whether current price falls within acceptable deviation from reference price.

        Parameters:
            market_data: Raw quote dictionary with 'price', 'last_price', 'previous_close', 'open'
            max_deviation_pct: Maximum allowed deviation percentage from reference price (default 20.0%)
            fallback_price: Last known good price if available

        Returns:
            Tuple of (is_valid, sanitized_market_data, reason)
        """
        if not market_data or not isinstance(market_data, dict):
            return False, market_data or {}, "Invalid or empty market data structure"

        sanitized = dict(market_data)
        raw_price_str = sanitized.get("price") or sanitized.get("last_price") or sanitized.get("close")
        symbol = sanitized.get("symbol", "UNKNOWN")

        try:
            current_price = float(raw_price_str)
        except (ValueError, TypeError):
            return False, sanitized, f"Invalid price format: {raw_price_str}"

        # 1. Non-positive Price Check
        if current_price <= 0:
            if fallback_price and fallback_price > 0:
                sanitized["price"] = str(round(fallback_price, 2))
                sanitized["last_price"] = str(round(fallback_price, 2))
                sanitized["outlier_detected"] = True
                sanitized["sanitization_reason"] = "Price was non-positive; reverted to fallback price"
                return False, sanitized, f"Non-positive price {current_price} sanitized to {fallback_price}"
            return False, sanitized, f"Non-positive price {current_price}"

        # 2. Reference Price Resolution (Priority: previous_close > open > fallback_price)
        ref_price = None
        raw_prev_close = sanitized.get("previous_close") or sanitized.get("previousClose")
        raw_open = sanitized.get("open")

        if raw_prev_close is not None:
            try:
                p_close = float(raw_prev_close)
                if p_close > 0:
                    ref_price = p_close
            except (ValueError, TypeError):
                pass

        if ref_price is None and raw_open is not None:
            try:
                p_open = float(raw_open)
                if p_open > 0:
                    ref_price = p_open
            except (ValueError, TypeError):
                pass

        if ref_price is None and fallback_price and fallback_price > 0:
            ref_price = fallback_price

        # 3. Circuit Band / Percentage Deviation Check
        if ref_price is not None and ref_price > 0:
            deviation_pct = abs(current_price - ref_price) / ref_price * 100.0
            if deviation_pct > max_deviation_pct:
                # Glitch / Outlier tick detected! (e.g. ₹390.25 vs ₹1810)
                sanitized_price = fallback_price if fallback_price and fallback_price > 0 else ref_price
                sanitized["raw_outlier_price"] = current_price
                sanitized["price"] = str(round(sanitized_price, 2))
                sanitized["last_price"] = str(round(sanitized_price, 2))
                sanitized["outlier_detected"] = True
                sanitized["deviation_pct"] = round(deviation_pct, 2)
                sanitized["sanitization_reason"] = (
                    f"Outlier tick ₹{current_price:.2f} deviated {deviation_pct:.1f}% "
                    f"from reference ₹{ref_price:.2f} (limit {max_deviation_pct}%)."
                )

                logger.warning(
                    "Sanitized market data outlier for %s: raw ₹%s deviated %.1f%% from ref ₹%s. Replaced with ₹%s",
                    symbol, current_price, deviation_pct, ref_price, sanitized_price
                )
                return False, sanitized, sanitized["sanitization_reason"]

        return True, sanitized, "Price is within normal circuit band"

    @classmethod
    def sanitize_tick(
        cls,
        payload: Dict[str, Any],
        symbol: Optional[str] = None,
        max_deviation_pct: float = 20.0,
        fallback_price: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Convenience method to sanitize an incoming tick payload for continuous valuation and ticker stream.
        """
        data = dict(payload) if isinstance(payload, dict) else {}
        if symbol and "symbol" not in data:
            data["symbol"] = symbol
        is_valid, sanitized, reason = cls.validate_and_sanitize_quote(
            market_data=data,
            max_deviation_pct=max_deviation_pct,
            fallback_price=fallback_price,
        )
        sanitized["is_outlier"] = not is_valid and sanitized.get("outlier_detected", False)
        return sanitized
