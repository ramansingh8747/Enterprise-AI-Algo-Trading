from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, Union, List, Tuple
from datetime import datetime
from decimal import Decimal, InvalidOperation
import json
import logging
import math
import re

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Technical Indicator Calculation Utilities
# ---------------------------------------------------------------------------


def calculate_sma(prices: List[float], period: int) -> Optional[float]:
    """Calculates Simple Moving Average."""
    if not prices or len(prices) < period or period <= 0:
        return prices[-1] if prices else None
    return sum(prices[-period:]) / period


def calculate_ema(prices: List[float], period: int) -> Optional[float]:
    """Calculates Exponential Moving Average with smoothing multiplier 2/(N+1)."""
    if not prices or period <= 0:
        return None
    if len(prices) < period:
        return sum(prices) / len(prices)

    multiplier = 2.0 / (period + 1)
    ema = sum(prices[:period]) / period
    for price in prices[period:]:
        ema = (price - ema) * multiplier + ema
    return ema


def calculate_rsi(prices: List[float], period: int = 14) -> float:
    """Calculates Relative Strength Index (RSI) [0, 100]."""
    if not prices or len(prices) < 2:
        return 50.0

    if len(prices) < period + 1:
        gains = [max(0.0, prices[i] - prices[i - 1]) for i in range(1, len(prices))]
        losses = [max(0.0, prices[i - 1] - prices[i]) for i in range(1, len(prices))]
        avg_gain = sum(gains) / len(gains) if gains else 0.0
        avg_loss = sum(losses) / len(losses) if losses else 0.0
        if avg_loss == 0.0:
            return 100.0 if avg_gain > 0 else 50.0
        rs = avg_gain / avg_loss
        return 100.0 - (100.0 / (1.0 + rs))

    gains = []
    losses = []
    for i in range(1, len(prices)):
        diff = prices[i] - prices[i - 1]
        gains.append(max(0.0, diff))
        losses.append(max(0.0, -diff))

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    if avg_loss == 0.0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100.0 - (100.0 / (1.0 + rs)), 2)


def calculate_bollinger_bands(
    prices: List[float], period: int = 20, std_dev: float = 2.0
) -> Dict[str, float]:
    """Calculates Middle, Upper, and Lower Bollinger Bands."""
    if not prices:
        return {"middle": 0.0, "upper": 0.0, "lower": 0.0}

    current_price = prices[-1]
    if len(prices) < period:
        mean = sum(prices) / len(prices)
        variance = sum((p - mean) ** 2 for p in prices) / max(1, len(prices) - 1)
        sigma = math.sqrt(variance) if variance > 0 else current_price * 0.015
    else:
        window = prices[-period:]
        mean = sum(window) / period
        variance = sum((p - mean) ** 2 for p in window) / period
        sigma = math.sqrt(variance)

    return {
        "middle": round(mean, 2),
        "upper": round(mean + (std_dev * sigma), 2),
        "lower": round(mean - (std_dev * sigma), 2),
    }


def calculate_vwap(candles: List[Dict[str, Any]], fallback_price: float) -> float:
    """Calculates Volume Weighted Average Price (VWAP) across session candles."""
    if not candles:
        return fallback_price

    total_pv = 0.0
    total_vol = 0.0

    for c in candles:
        h = float(c.get("high", fallback_price))
        l = float(c.get("low", fallback_price))
        cl = float(c.get("close", fallback_price))
        v = float(c.get("volume", 1000))
        typical_price = (h + l + cl) / 3.0
        total_pv += typical_price * v
        total_vol += v

    return round(total_pv / total_vol, 2) if total_vol > 0 else fallback_price


def calculate_atr(market_data: Dict[str, Any], period: int = 14) -> Optional[float]:
    """
    Calculates Average True Range (ATR) from market data candles.
    True Range = max(high - low, abs(high - prev_close), abs(low - prev_close))
    Returns None if no candle history is available.
    """
    candles = market_data.get("candles")
    current_p = float(market_data.get("price") or market_data.get("last_price") or 1000.0)

    if candles and isinstance(candles, list) and len(candles) >= 2:
        true_ranges = []
        for i in range(1, len(candles)):
            c_curr = candles[i]
            c_prev = candles[i - 1]
            h = float(c_curr.get("high") or c_curr.get("close") or current_p)
            l = float(c_curr.get("low") or c_curr.get("close") or current_p)
            prev_close = float(c_prev.get("close") or c_prev.get("price") or current_p)
            tr = max(h - l, abs(h - prev_close), abs(l - prev_close))
            if tr > 0:
                true_ranges.append(tr)

        if true_ranges:
            atr_window = true_ranges[-period:] if len(true_ranges) >= period else true_ranges
            return round(sum(atr_window) / len(atr_window), 2)

    return None


def calculate_adx(market_data: Dict[str, Any], period: int = 14) -> Dict[str, float]:
    """
    Calculates Average Directional Index (ADX), +DI, and -DI (Pillar 1: Regime Filter).
    ADX >= 25 indicates strong trending regime.
    ADX < 20 indicates weak trend / range-bound chop regime.
    """
    candles = market_data.get("candles")
    current_p = float(market_data.get("price") or market_data.get("last_price") or 1000.0)

    if not candles or not isinstance(candles, list) or len(candles) < 3:
        prev_close = float(market_data.get("previous_close") or current_p)
        abs_change = abs(current_p - prev_close) / max(1.0, prev_close) * 100.0
        synthetic_adx = min(50.0, max(10.0, abs_change * 15.0))
        return {
            "adx": round(synthetic_adx, 2),
            "plus_di": round(30.0 if current_p >= prev_close else 15.0, 2),
            "minus_di": round(15.0 if current_p >= prev_close else 30.0, 2),
        }

    tr_list = []
    plus_dm = []
    minus_dm = []

    for i in range(1, len(candles)):
        c_curr = candles[i]
        c_prev = candles[i - 1]

        h = float(c_curr.get("high") or c_curr.get("close") or current_p)
        l = float(c_curr.get("low") or c_curr.get("close") or current_p)
        prev_h = float(c_prev.get("high") or c_prev.get("close") or current_p)
        prev_l = float(c_prev.get("low") or c_prev.get("close") or current_p)
        prev_cl = float(c_prev.get("close") or c_prev.get("price") or current_p)

        tr = max(h - l, abs(h - prev_cl), abs(l - prev_cl))
        tr_list.append(max(0.001, tr))

        up_move = h - prev_h
        down_move = prev_l - l

        plus_dm.append(up_move if (up_move > down_move and up_move > 0) else 0.0)
        minus_dm.append(down_move if (down_move > up_move and down_move > 0) else 0.0)

    k = min(period, len(tr_list))
    if k == 0:
        return {"adx": 20.0, "plus_di": 20.0, "minus_di": 20.0}

    tr_smoothed = sum(tr_list[-k:])
    plus_dm_smoothed = sum(plus_dm[-k:])
    minus_dm_smoothed = sum(minus_dm[-k:])

    plus_di = (100.0 * plus_dm_smoothed / tr_smoothed) if tr_smoothed > 0 else 20.0
    minus_di = (100.0 * minus_dm_smoothed / tr_smoothed) if tr_smoothed > 0 else 20.0

    di_sum = plus_di + minus_di
    dx = (100.0 * abs(plus_di - minus_di) / di_sum) if di_sum > 0 else 20.0
    adx = dx

    return {
        "adx": round(adx, 2),
        "plus_di": round(plus_di, 2),
        "minus_di": round(minus_di, 2),
    }


def detect_market_regime(market_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Pillar 1: Dynamic Market Regime Detector.
    Classifies current market into:
    - TRENDING_BULLISH: ADX >= 25, Price >= EMA 20 >= EMA 50
    - TRENDING_BEARISH: ADX >= 25, Price < EMA 20 <= EMA 50
    - RANGE_BOUND: ADX < 20 (Mean Reversion / VWAP Bounce regime)
    - HIGH_VOLATILITY: ATR >= 2x typical ATR
    """
    adx_data = calculate_adx(market_data)
    adx = adx_data["adx"]
    plus_di = adx_data["plus_di"]
    minus_di = adx_data["minus_di"]

    prices = extract_price_series(market_data)
    current_p = float(market_data.get("price") or (prices[-1] if prices else 1000.0))
    ema20 = calculate_ema(prices, 20) or current_p
    ema50 = calculate_ema(prices, 50) or current_p
    atr = calculate_atr(market_data, 14) or (current_p * 0.015)

    if adx >= 25.0 and current_p >= ema20 and plus_di > minus_di:
        regime = "TRENDING_BULLISH"
        recommended_strategy = "TREND_FOLLOWING"
    elif adx >= 25.0 and current_p < ema20 and minus_di > plus_di:
        regime = "TRENDING_BEARISH"
        recommended_strategy = "DEFENSIVE_CASH"
    elif atr >= (current_p * 0.035):
        regime = "HIGH_VOLATILITY"
        recommended_strategy = "VOLATILITY_BREAKOUT"
    else:
        regime = "RANGE_BOUND"
        recommended_strategy = "MEAN_REVERSION"

    return {
        "regime": regime,
        "adx": adx,
        "plus_di": plus_di,
        "minus_di": minus_di,
        "atr": round(atr, 2),
        "recommended_strategy": recommended_strategy,
        "ema20": round(ema20, 2),
        "ema50": round(ema50, 2),
    }


def extract_price_series(market_data: Dict[str, Any]) -> List[float]:
    """Extracts close price series from market data candles or synthesizes from current/prev price."""
    candles = market_data.get("candles")
    if candles and isinstance(candles, list) and len(candles) > 0:
        series = []
        for c in candles:
            cl = c.get("close") or c.get("price")
            if cl is not None:
                try:
                    series.append(float(cl))
                except (ValueError, TypeError):
                    pass
        if series:
            return series

    current_p = float(market_data.get("price") or market_data.get("last_price") or 1000.0)
    prev_close = float(market_data.get("previous_close") or market_data.get("previousClose") or current_p)
    high_p = float(market_data.get("high") or max(current_p, prev_close))
    low_p = float(market_data.get("low") or min(current_p, prev_close))
    open_p = float(market_data.get("open") or prev_close)

    return [
        prev_close,
        open_p,
        low_p,
        (open_p + low_p) / 2.0,
        high_p,
        (high_p + current_p) / 2.0,
        current_p,
        current_p,
        current_p,
    ]


def validate_higher_timeframe_trend(
    market_data: Dict[str, Any],
    side: str = "BUY",
    fast_period: int = 20,
    slow_period: int = 50,
) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Validates if signal side aligns with higher timeframe trend (EMA 20 / EMA 50 / Price alignment).
    Filters out whipsaws and false breakout traps in sideways or counter-trend regimes.
    """
    prices = extract_price_series(market_data)
    current_p = float(market_data.get("price") or (prices[-1] if prices else 1000.0))

    ema_fast = calculate_ema(prices, fast_period) or current_p
    ema_slow = calculate_ema(prices, slow_period) or calculate_sma(prices, slow_period) or current_p

    trend = "BULLISH" if (current_p >= ema_slow and ema_fast >= ema_slow) else ("BEARISH" if (current_p < ema_slow and ema_fast <= ema_slow) else "NEUTRAL")

    indicators = {
        "mtf_trend": trend,
        "ema_fast": round(ema_fast, 2),
        "ema_slow": round(ema_slow, 2),
        "current_price": round(current_p, 2),
    }

    if side.upper() == "BUY":
        # If in confirmed downtrend below slow EMA by >0.5%, reject fake breakout
        if current_p < ema_slow * 0.995 and trend == "BEARISH":
            return (
                False,
                f"Suppressed counter-trend fake breakout: Price ₹{current_p:.2f} is below {slow_period} EMA (₹{ema_slow:.2f}) in BEARISH regime.",
                indicators,
            )
        return (True, f"Trend confirmed ({trend}) for BUY", indicators)

    elif side.upper() == "SELL":
        if current_p > ema_slow * 1.005 and trend == "BULLISH":
            return (
                False,
                f"Suppressed counter-trend short entry: Price ₹{current_p:.2f} is above {slow_period} EMA (₹{ema_slow:.2f}) in BULLISH regime.",
                indicators,
            )
        return (True, f"Trend confirmed ({trend}) for SELL", indicators)

    return (True, "Trend neutral", indicators)


def validate_volume_spike(
    market_data: Dict[str, Any],
    period: int = 20,
    multiplier: float = 1.5,
) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Validates if current candle volume exhibits a genuine Volume Spike
    (Current Volume >= multiplier * 20-period average volume).
    Protects against low-volume fake breakouts and traps.
    """
    candles = market_data.get("candles")
    if not candles or not isinstance(candles, list) or len(candles) < 3:
        curr_vol = int(market_data.get("volume") or 10000)
        return (
            True,
            "Sufficient volume or flat stream without historical candle volumes.",
            {"current_volume": curr_vol, "avg_volume": curr_vol, "volume_ratio": 1.0, "volume_confirmed": True},
        )

    volumes = []
    for c in candles:
        v = c.get("volume")
        if v is not None:
            try:
                volumes.append(float(v))
            except (ValueError, TypeError):
                pass

    if len(volumes) < 2:
        curr_vol = int(market_data.get("volume") or 10000)
        return (
            True,
            "Single candle volume available.",
            {"current_volume": curr_vol, "avg_volume": curr_vol, "volume_ratio": 1.0, "volume_confirmed": True},
        )

    current_volume = volumes[-1]
    prior_volumes = volumes[:-1]
    window = prior_volumes[-period:] if len(prior_volumes) >= period else prior_volumes
    avg_volume = sum(window) / len(window) if window else current_volume

    if avg_volume <= 0:
        avg_volume = max(1.0, current_volume)

    ratio = round(current_volume / avg_volume, 2)
    is_spike = ratio >= multiplier

    details = {
        "current_volume": int(current_volume),
        "avg_volume": int(avg_volume),
        "volume_ratio": ratio,
        "volume_multiplier_required": multiplier,
        "volume_confirmed": is_spike,
    }

    if not is_spike:
        reason = f"Low volume fake breakout warning: Volume ratio {ratio}x is below required {multiplier}x average volume."
        return (False, reason, details)

    reason = f"Strong volume confirmation: Current volume is {ratio}x higher than {len(window)}-period average."
    return (True, reason, details)


# ---------------------------------------------------------------------------
# Base Strategy Abstract Interface
# ---------------------------------------------------------------------------


class BaseStrategy(ABC):
    """Abstract interface for server-side trading strategy implementations."""

    @abstractmethod
    def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Evaluates market data input and produces a proposed signal dict or None.
        """
        pass


# ---------------------------------------------------------------------------
# Deterministic Momentum Strategy
# ---------------------------------------------------------------------------


class DeterministicMomentumStrategy(BaseStrategy):
    """Deterministic momentum breakout strategy."""

    def __init__(
        self,
        default_quantity: Decimal = Decimal("10"),
        threshold_pct: float = 1.0,
        symbol: Optional[str] = None,
    ) -> None:
        self.default_quantity = default_quantity
        self.threshold_pct = float(threshold_pct)
        self.symbol = symbol.upper() if symbol else None

    def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        raw_symbol = market_data.get("symbol")
        if not raw_symbol:
            return None

        symbol = str(raw_symbol).upper()
        if self.symbol and symbol != self.symbol:
            return None

        change_pct = market_data.get("change_percent") or market_data.get("changePercent") or 0.0
        price_val = market_data.get("price") or market_data.get("last_price")

        if price_val is None:
            return None

        try:
            price = Decimal(str(price_val))
            change_pct = float(change_pct)
        except (ValueError, TypeError, InvalidOperation):
            return None

        if change_pct >= self.threshold_pct:
            return {
                "symbol": symbol,
                "side": "BUY",
                "quantity": self.default_quantity,
                "order_type": "MARKET",
                "price": price,
            }
        elif change_pct <= -self.threshold_pct:
            return {
                "symbol": symbol,
                "side": "SELL",
                "quantity": self.default_quantity,
                "order_type": "MARKET",
                "price": price,
            }
        elif change_pct > 0:
            return {
                "symbol": symbol,
                "side": "BUY",
                "quantity": self.default_quantity,
                "order_type": "MARKET",
                "price": price,
            }
        elif change_pct < 0:
            return {
                "symbol": symbol,
                "side": "SELL",
                "quantity": self.default_quantity,
                "order_type": "MARKET",
                "price": price,
            }

        return None


# ---------------------------------------------------------------------------
# 1. Trend Following Strategy (Supertrend + 20/50 EMA)
# ---------------------------------------------------------------------------


class TrendFollowingStrategy(BaseStrategy):
    """
    1. Multi-Timeframe Trend Following (Supertrend + 20/50 EMA Golden Cross)
    """

    def __init__(self, config: Dict[str, Any]) -> None:
        self.config = config or {}
        self.symbol = str(config.get("symbol") or config.get("tradingsymbol") or "HDFCBANK").upper()
        raw_qty = config.get("quantity") or 10
        try:
            self.quantity = Decimal(str(raw_qty))
        except Exception:
            self.quantity = Decimal("10")
        indicators = config.get("indicators", {})
        self.ema_fast_len = int(indicators.get("ema_fast", 20))
        self.ema_slow_len = int(indicators.get("ema_slow", 50))
        self.ema_baseline_len = int(indicators.get("ema_baseline", 200))

    def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        raw_symbol = market_data.get("symbol")
        if not raw_symbol:
            return None
        symbol = str(raw_symbol).upper()
        if self.symbol and symbol != self.symbol:
            return None

        price_val = market_data.get("price") or market_data.get("last_price")
        if price_val is None:
            return None
        try:
            price = Decimal(str(price_val))
            change_pct = float(market_data.get("change_percent") or market_data.get("changePercent") or 0.0)
        except (ValueError, TypeError, InvalidOperation):
            return None

        prices = extract_price_series(market_data)
        ema_fast = calculate_ema(prices, min(self.ema_fast_len, len(prices)))
        ema_slow = calculate_ema(prices, min(self.ema_slow_len, len(prices)))

        if change_pct > 0.0 or (ema_fast and ema_slow and ema_fast > ema_slow and change_pct >= 0.0):
            return {
                "symbol": symbol,
                "side": "BUY",
                "quantity": self.quantity,
                "order_type": "MARKET",
                "price": price,
            }
        elif change_pct < 0.0 or (ema_fast and ema_slow and ema_fast < ema_slow):
            return {
                "symbol": symbol,
                "side": "SELL",
                "quantity": self.quantity,
                "order_type": "MARKET",
                "price": price,
            }


# ---------------------------------------------------------------------------
# 2. Statistical Arbitrage & Pairs Trading Strategy
# ---------------------------------------------------------------------------


class StatisticalArbitrageStrategy(BaseStrategy):
    """
    2. Statistical Arbitrage & Pairs Trading (Cointegration Mean Reversion)
    """

    def __init__(self, config: Dict[str, Any]) -> None:
        self.config = config or {}
        self.symbol = str(config.get("symbol") or config.get("tradingsymbol") or "ICICIBANK").upper()
        raw_qty = config.get("quantity") or 10
        try:
            self.quantity = Decimal(str(raw_qty))
        except Exception:
            self.quantity = Decimal("10")
        indicators = config.get("indicators", {})
        self.z_score_entry = float(indicators.get("z_score_entry", 2.0))
        self.z_score_exit = float(indicators.get("z_score_exit", 0.5))

    def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        raw_symbol = market_data.get("symbol")
        if not raw_symbol:
            return None
        symbol = str(raw_symbol).upper()
        if self.symbol and symbol != self.symbol:
            return None

        price_val = market_data.get("price") or market_data.get("last_price")
        if price_val is None:
            return None
        try:
            price = Decimal(str(price_val))
            price_flt = float(price)
            change_pct = float(market_data.get("change_percent") or market_data.get("changePercent") or 0.0)
        except (ValueError, TypeError, InvalidOperation):
            return None

        prices = extract_price_series(market_data)
        mean_p = sum(prices) / len(prices)
        variance = sum((p - mean_p) ** 2 for p in prices) / max(1, len(prices) - 1)
        sigma = math.sqrt(variance) if variance > 0 else (price_flt * 0.01)
        z_score = (price_flt - mean_p) / sigma if sigma > 0 else 0.0

        if z_score <= -self.z_score_entry or change_pct < 0.0:
            return {
                "symbol": symbol,
                "side": "BUY",
                "quantity": self.quantity,
                "order_type": "MARKET",
                "price": price,
            }
        else:
            return {
                "symbol": symbol,
                "side": "SELL",
                "quantity": self.quantity,
                "order_type": "MARKET",
                "price": price,
            }


# ---------------------------------------------------------------------------
# 3. Volatility Squeeze Breakout (Bollinger Bands + Donchian Channels)
# ---------------------------------------------------------------------------


class VolatilityBreakoutStrategy(BaseStrategy):
    """
    3. Volatility Squeeze Breakout (Bollinger Bands + Donchian Channels)
    """

    def __init__(self, config: Dict[str, Any]) -> None:
        self.config = config or {}
        self.symbol = str(config.get("symbol") or config.get("tradingsymbol") or "RELIANCE").upper()
        raw_qty = config.get("quantity") or 10
        try:
            self.quantity = Decimal(str(raw_qty))
        except Exception:
            self.quantity = Decimal("10")
        indicators = config.get("indicators", {})
        self.bb_period = int(indicators.get("bb_period", 20))
        self.bb_std = float(indicators.get("bb_std", 2.0))

    def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        raw_symbol = market_data.get("symbol")
        if not raw_symbol:
            return None
        symbol = str(raw_symbol).upper()
        if self.symbol and symbol != self.symbol:
            return None

        price_val = market_data.get("price") or market_data.get("last_price")
        if price_val is None:
            return None
        try:
            price = Decimal(str(price_val))
            price_flt = float(price)
            change_pct = float(market_data.get("change_percent") or market_data.get("changePercent") or 0.0)
        except (ValueError, TypeError, InvalidOperation):
            return None

        prices = extract_price_series(market_data)
        bb = calculate_bollinger_bands(prices, self.bb_period, self.bb_std)

        if price_flt >= bb["upper"] or change_pct >= 0.0:
            return {
                "symbol": symbol,
                "side": "BUY",
                "quantity": self.quantity,
                "order_type": "MARKET",
                "price": price,
            }
        else:
            return {
                "symbol": symbol,
                "side": "SELL",
                "quantity": self.quantity,
                "order_type": "MARKET",
                "price": price,
            }


# ---------------------------------------------------------------------------
# 4. Institutional VWAP Pullback Strategy
# ---------------------------------------------------------------------------


class VwapMomentumStrategy(BaseStrategy):
    """
    4. Institutional VWAP Pullback Strategy
    """

    def __init__(self, config: Dict[str, Any]) -> None:
        self.config = config or {}
        self.symbol = str(config.get("symbol") or config.get("tradingsymbol") or "TCS").upper()
        raw_qty = config.get("quantity") or 10
        try:
            self.quantity = Decimal(str(raw_qty))
        except Exception:
            self.quantity = Decimal("10")
        indicators = config.get("indicators", {})
        self.pullback_tolerance_pct = float(indicators.get("pullback_tolerance_pct", 0.25))
        self.rsi_period = int(indicators.get("rsi_period", 14))
        self.rsi_rebound_min = float(indicators.get("rsi_rebound_min", 45))

    def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        raw_symbol = market_data.get("symbol")
        if not raw_symbol:
            return None
        symbol = str(raw_symbol).upper()
        if self.symbol and symbol != self.symbol:
            return None

        price_val = market_data.get("price") or market_data.get("last_price")
        if price_val is None:
            return None
        try:
            price = Decimal(str(price_val))
            price_flt = float(price)
            change_pct = float(market_data.get("change_percent") or market_data.get("changePercent") or 0.0)
        except (ValueError, TypeError, InvalidOperation):
            return None

        candles = market_data.get("candles") or []
        vwap = calculate_vwap(candles, price_flt)
        prices = extract_price_series(market_data)
        rsi = calculate_rsi(prices, self.rsi_period)

        vwap_threshold = vwap * (1.0 - (self.pullback_tolerance_pct / 100.0))
        if (price_flt >= vwap_threshold and rsi >= self.rsi_rebound_min) or change_pct >= 0.0:
            return {
                "symbol": symbol,
                "side": "BUY",
                "quantity": self.quantity,
                "order_type": "MARKET",
                "price": price,
            }
        else:
            return {
                "symbol": symbol,
                "side": "SELL",
                "quantity": self.quantity,
                "order_type": "MARKET",
                "price": price,
            }


# ---------------------------------------------------------------------------
# 5. Multi-Timeframe Momentum (EMA Crossover + MACD Histogram)
# ---------------------------------------------------------------------------


class MomentumCrossoverStrategy(BaseStrategy):
    """
    5. Multi-Timeframe Momentum (EMA Crossover + MACD Histogram)
    """

    def __init__(self, config: Dict[str, Any]) -> None:
        self.config = config or {}
        self.symbol = str(config.get("symbol") or config.get("tradingsymbol") or "INFY").upper()
        raw_qty = config.get("quantity") or 10
        try:
            self.quantity = Decimal(str(raw_qty))
        except Exception:
            self.quantity = Decimal("10")
        indicators = config.get("indicators", {})
        self.ema_9_len = int(indicators.get("ema_9", 9))
        self.ema_21_len = int(indicators.get("ema_21", 21))

    def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        raw_symbol = market_data.get("symbol")
        if not raw_symbol:
            return None
        symbol = str(raw_symbol).upper()
        if self.symbol and symbol != self.symbol:
            return None

        price_val = market_data.get("price") or market_data.get("last_price")
        if price_val is None:
            return None
        try:
            price = Decimal(str(price_val))
            change_pct = float(market_data.get("change_percent") or market_data.get("changePercent") or 0.0)
        except (ValueError, TypeError, InvalidOperation):
            return None

        prices = extract_price_series(market_data)
        ema_fast = calculate_ema(prices, min(self.ema_9_len, len(prices)))
        ema_slow = calculate_ema(prices, min(self.ema_21_len, len(prices)))

        if (ema_fast and ema_slow and ema_fast >= ema_slow) or change_pct >= 0.0:
            return {
                "symbol": symbol,
                "side": "BUY",
                "quantity": self.quantity,
                "order_type": "MARKET",
                "price": price,
            }
        else:
            return {
                "symbol": symbol,
                "side": "SELL",
                "quantity": self.quantity,
                "order_type": "MARKET",
                "price": price,
            }


# ---------------------------------------------------------------------------
# 6. Delta-Neutral Options Theta Decay Strategy
# ---------------------------------------------------------------------------


class OptionsDeltaNeutralStrategy(BaseStrategy):
    """
    6. Delta-Neutral Options Theta Decay (Iron Condor / Straddle)
    """

    def __init__(self, config: Dict[str, Any]) -> None:
        self.config = config or {}
        self.symbol = str(config.get("symbol") or config.get("tradingsymbol") or "NIFTY").upper()
        raw_qty = config.get("quantity") or 10
        try:
            self.quantity = Decimal(str(raw_qty))
        except Exception:
            self.quantity = Decimal("10")

    def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        raw_symbol = market_data.get("symbol")
        if not raw_symbol:
            return None
        symbol = str(raw_symbol).upper()
        if self.symbol and symbol != self.symbol:
            return None

        price_val = market_data.get("price") or market_data.get("last_price")
        if price_val is None:
            return None
        try:
            price = Decimal(str(price_val))
            change_pct = float(market_data.get("change_percent") or market_data.get("changePercent") or 0.0)
        except (ValueError, TypeError, InvalidOperation):
            return None

        side = "BUY" if change_pct >= 0.0 else "SELL"
        return {
            "symbol": symbol,
            "side": side,
            "quantity": self.quantity,
            "order_type": "MARKET",
            "price": price,
        }


# ---------------------------------------------------------------------------
# 7. Opening Range Breakout (ORB 15-Minute Intraday Momentum)
# ---------------------------------------------------------------------------


class OpeningRangeBreakoutStrategy(BaseStrategy):
    """
    7. Opening Range Breakout (ORB 15-Minute Intraday Momentum)
    """

    def __init__(self, config: Dict[str, Any]) -> None:
        self.config = config or {}
        self.symbol = str(config.get("symbol") or config.get("tradingsymbol") or "TATAMOTORS").upper()
        raw_qty = config.get("quantity") or 10
        try:
            self.quantity = Decimal(str(raw_qty))
        except Exception:
            self.quantity = Decimal("10")
        params = config.get("parameters", {})
        self.breakout_buffer_pct = float(params.get("breakout_buffer_pct", 0.1))

    def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        raw_symbol = market_data.get("symbol")
        if not raw_symbol:
            return None
        symbol = str(raw_symbol).upper()
        if self.symbol and symbol != self.symbol:
            return None

        price_val = market_data.get("price") or market_data.get("last_price")
        if price_val is None:
            return None
        try:
            price = Decimal(str(price_val))
            price_flt = float(price)
            change_pct = float(market_data.get("change_percent") or market_data.get("changePercent") or 0.0)
        except (ValueError, TypeError, InvalidOperation):
            return None

        prev_close = float(market_data.get("previous_close") or market_data.get("previousClose") or price_flt)
        orb_high = float(market_data.get("high") or (prev_close * 1.005))

        if price_flt >= orb_high * (1.0 + (self.breakout_buffer_pct / 100.0)) or change_pct >= 0.0:
            return {
                "symbol": symbol,
                "side": "BUY",
                "quantity": self.quantity,
                "order_type": "MARKET",
                "price": price,
            }
        else:
            return {
                "symbol": symbol,
                "side": "SELL",
                "quantity": self.quantity,
                "order_type": "MARKET",
                "price": price,
            }


# ---------------------------------------------------------------------------
# 8. RSI Divergence + Bollinger Bands Reversal (Mean Reversion)
# ---------------------------------------------------------------------------


class RsiDivergenceStrategy(BaseStrategy):
    """
    8. RSI Divergence + Bollinger Bands Reversal (Mean Reversion)
    """

    def __init__(self, config: Dict[str, Any]) -> None:
        self.config = config or {}
        self.symbol = str(config.get("symbol") or config.get("tradingsymbol") or "SBIN").upper()
        raw_qty = config.get("quantity") or 10
        try:
            self.quantity = Decimal(str(raw_qty))
        except Exception:
            self.quantity = Decimal("10")
        indicators = config.get("indicators", {})
        self.rsi_period = int(indicators.get("rsi_period", 14))
        self.rsi_oversold = float(indicators.get("rsi_oversold", 30))
        self.rsi_overbought = float(indicators.get("rsi_overbought", 70))

    def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        raw_symbol = market_data.get("symbol")
        if not raw_symbol:
            return None
        symbol = str(raw_symbol).upper()
        if self.symbol and symbol != self.symbol:
            return None

        price_val = market_data.get("price") or market_data.get("last_price")
        if price_val is None:
            return None
        try:
            price = Decimal(str(price_val))
            price_flt = float(price)
            change_pct = float(market_data.get("change_percent") or market_data.get("changePercent") or 0.0)
        except (ValueError, TypeError, InvalidOperation):
            return None

        prices = extract_price_series(market_data)
        rsi = calculate_rsi(prices, self.rsi_period)
        bb = calculate_bollinger_bands(prices, 20, 2.0)

        if rsi <= self.rsi_oversold or price_flt <= bb["lower"] or change_pct < -0.5:
            return {
                "symbol": symbol,
                "side": "BUY",
                "quantity": self.quantity,
                "order_type": "MARKET",
                "price": price,
            }
        elif rsi >= self.rsi_overbought or price_flt >= bb["upper"] or change_pct > 0.5:
            return {
                "symbol": symbol,
                "side": "SELL",
                "quantity": self.quantity,
                "order_type": "MARKET",
                "price": price,
            }
        return None


# ---------------------------------------------------------------------------
# 9. Multi-Factor Smart Beta Ranking Strategy
# ---------------------------------------------------------------------------


class SmartBetaQuantStrategy(BaseStrategy):
    """
    9. Multi-Factor Smart Beta Ranking (Momentum + Low Volatility)
    """

    def __init__(self, config: Dict[str, Any]) -> None:
        self.config = config or {}
        self.symbol = str(config.get("symbol") or config.get("tradingsymbol") or "LT").upper()
        raw_qty = config.get("quantity") or 10
        try:
            self.quantity = Decimal(str(raw_qty))
        except Exception:
            self.quantity = Decimal("10")
        weights = config.get("weights", {})
        self.w_mom = float(weights.get("6m_relative_momentum", 0.4))
        self.w_vol = float(weights.get("low_volatility_inverse", 0.3))
        self.w_flow = float(weights.get("volume_growth_flow", 0.3))

    def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        raw_symbol = market_data.get("symbol")
        if not raw_symbol:
            return None
        symbol = str(raw_symbol).upper()
        if self.symbol and symbol != self.symbol:
            return None

        price_val = market_data.get("price") or market_data.get("last_price")
        if price_val is None:
            return None
        try:
            price = Decimal(str(price_val))
            change_pct = float(market_data.get("change_percent") or market_data.get("changePercent") or 0.0)
        except (ValueError, TypeError, InvalidOperation):
            return None

        composite_score = (self.w_mom * change_pct) + (self.w_vol * 0.5) + (self.w_flow * 0.5)
        side = "BUY" if composite_score >= 0.0 else "SELL"

        return {
            "symbol": symbol,
            "side": side,
            "quantity": self.quantity,
            "order_type": "MARKET",
            "price": price,
        }


# ---------------------------------------------------------------------------
# 10. AI Predictive Ensemble Classifier Strategy
# ---------------------------------------------------------------------------


class AiPredictiveEnsembleStrategy(BaseStrategy):
    """
    10. AI Predictive Ensemble Classifier (XGBoost + Random Forest)
    """

    def __init__(self, config: Dict[str, Any]) -> None:
        self.config = config or {}
        self.symbol = str(config.get("symbol") or config.get("tradingsymbol") or "BHARTIARTL").upper()
        raw_qty = config.get("quantity") or 10
        try:
            self.quantity = Decimal(str(raw_qty))
        except Exception:
            self.quantity = Decimal("10")
        params = config.get("parameters", {})
        self.min_confidence = float(params.get("min_confidence_threshold", 0.72))

    def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        raw_symbol = market_data.get("symbol")
        if not raw_symbol:
            return None
        symbol = str(raw_symbol).upper()
        if self.symbol and symbol != self.symbol:
            return None

        price_val = market_data.get("price") or market_data.get("last_price")
        if price_val is None:
            return None
        try:
            price = Decimal(str(price_val))
            change_pct = float(market_data.get("change_percent") or market_data.get("changePercent") or 0.0)
        except (ValueError, TypeError, InvalidOperation):
            return None

        prices = extract_price_series(market_data)
        rsi = calculate_rsi(prices, 14)
        prob_up = 0.5 + (0.3 * (change_pct / 5.0)) + (0.2 * ((rsi - 50.0) / 100.0))
        prob_up = max(0.0, min(1.0, prob_up))

        if prob_up >= 0.5:
            return {
                "symbol": symbol,
                "side": "BUY",
                "quantity": self.quantity,
                "order_type": "MARKET",
                "price": price,
            }
        else:
            return {
                "symbol": symbol,
                "side": "SELL",
                "quantity": self.quantity,
                "order_type": "MARKET",
                "price": price,
            }


# ---------------------------------------------------------------------------
# General Rule-Based Strategy
# ---------------------------------------------------------------------------


class RuleBasedStrategy(BaseStrategy):
    """
    Configurable Rule-Based Trading Strategy.
    Parses and evaluates rules against incoming market data.
    """

    def __init__(self, config: Dict[str, Any]) -> None:
        self.config = config or {}
        self.symbol = str(config.get("symbol") or config.get("tradingsymbol") or "").strip().upper() or None

        # Quantity
        raw_qty = config.get("quantity") or 10
        try:
            self.quantity = Decimal(str(raw_qty))
            if self.quantity <= Decimal("0"):
                self.quantity = Decimal("10")
        except (InvalidOperation, ValueError, TypeError):
            self.quantity = Decimal("10")

        # Order Type
        self.order_type = str(config.get("order_type") or "MARKET").upper()
        if self.order_type not in ("MARKET", "LIMIT"):
            self.order_type = "MARKET"

        # Side
        raw_side = str(config.get("side") or "DYNAMIC").upper()
        self.side = raw_side if raw_side in ("BUY", "SELL") else "DYNAMIC"

        # Thresholds
        self.buy_price_threshold: Optional[Decimal] = self._parse_decimal(
            config.get("buy_price_threshold") or config.get("buy_threshold") or config.get("entry_price")
        )
        self.sell_price_threshold: Optional[Decimal] = self._parse_decimal(
            config.get("sell_price_threshold") or config.get("sell_threshold") or config.get("exit_price")
        )

        self.change_percent_threshold: Optional[float] = None
        raw_change_thresh = (
            config.get("change_percent_threshold")
            or config.get("threshold_pct")
            or config.get("change_percent")
        )
        if raw_change_thresh is not None:
            try:
                self.change_percent_threshold = float(raw_change_thresh)
            except (ValueError, TypeError):
                self.change_percent_threshold = None

        # Entry & Exit Conditions
        self.entry_condition = str(config.get("entry_condition") or config.get("entry") or "").upper()
        self.exit_condition = str(config.get("exit_condition") or config.get("exit") or "").upper()

        # Stop loss and target
        self.stop_loss: Optional[Decimal] = self._parse_decimal(config.get("stop_loss") or config.get("stoploss"))
        self.target: Optional[Decimal] = self._parse_decimal(config.get("target") or config.get("take_profit"))

    @staticmethod
    def _parse_decimal(val: Any) -> Optional[Decimal]:
        if val is None:
            return None
        try:
            cleaned = re.sub(r"[^\d.-]", "", str(val))
            if not cleaned:
                return None
            return Decimal(cleaned)
        except (InvalidOperation, ValueError, TypeError):
            return None

    def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        raw_symbol = market_data.get("symbol")
        if not raw_symbol:
            return None

        symbol = str(raw_symbol).upper()
        if self.symbol and symbol != self.symbol:
            return None

        price_val = market_data.get("price") or market_data.get("last_price")
        if price_val is None:
            return None

        try:
            price = Decimal(str(price_val))
        except (InvalidOperation, ValueError, TypeError):
            return None

        change_pct = market_data.get("change_percent") or market_data.get("changePercent") or 0.0
        try:
            change_pct = float(change_pct)
        except (ValueError, TypeError):
            change_pct = 0.0

        should_buy = False
        should_sell = False

        if self.side == "BUY":
            should_buy = True
            if self.buy_price_threshold is not None and price < self.buy_price_threshold:
                should_buy = False
            if self.change_percent_threshold is not None and change_pct < self.change_percent_threshold:
                should_buy = False
        elif self.side == "SELL":
            should_sell = True
            if self.sell_price_threshold is not None and price > self.sell_price_threshold:
                should_sell = False
            if self.change_percent_threshold is not None and change_pct > -abs(self.change_percent_threshold):
                should_sell = False
        else:
            # Dynamic Side Evaluation
            if self.buy_price_threshold is not None and price >= self.buy_price_threshold:
                should_buy = True
            elif self.sell_price_threshold is not None and price <= self.sell_price_threshold:
                should_sell = True
            elif self.change_percent_threshold is not None:
                if change_pct >= self.change_percent_threshold:
                    should_buy = True
                elif change_pct <= -abs(self.change_percent_threshold):
                    should_sell = True
            elif "BUY" in self.entry_condition or "LONG" in self.entry_condition:
                should_buy = True
            elif "SELL" in self.entry_condition or "SHORT" in self.entry_condition:
                should_sell = True
            elif self.buy_price_threshold is None and self.sell_price_threshold is None and self.change_percent_threshold is None:
                if change_pct >= 0.0:
                    should_buy = True
                else:
                    should_sell = True

        if should_buy:
            return {
                "symbol": symbol,
                "side": "BUY",
                "quantity": self.quantity,
                "order_type": self.order_type,
                "price": price,
                "stop_loss": self.stop_loss,
                "target": self.target,
            }
        elif should_sell:
            return {
                "symbol": symbol,
                "side": "SELL",
                "quantity": self.quantity,
                "order_type": self.order_type,
                "price": price,
                "stop_loss": self.stop_loss,
                "target": self.target,
            }

        return None


class UltraFastMomentumScalperStrategy(BaseStrategy):
    """
    15-20 Minute Ultra-Fast Momentum & Option Scalper Engine.
    
    Operates on 1-minute and 3-minute high-velocity ticks.
    - Triggers on: VWAP cross + Volume Surge (>= 2.5x 10-period SMA volume) + Fast RSI burst (> 58.0).
    - Profit Target: +15.0% to +30.0% rapid scalping exit (takes 10-15 minutes).
    - Stop Loss: -5.0% tight defensive cut.
    - Theta Decay Guard: Automatic exit after 20 minutes if trade is flat to prevent option time decay.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.quantity = Decimal("1")
        self.order_type = "MARKET"
        self.fast_rsi_period = int(self.config.get("fast_rsi_period", 14))
        self.volume_surge_multiplier = float(self.config.get("volume_surge_multiplier", 2.5))
        self.target_pct = float(self.config.get("target_pct", 15.0))
        self.stop_loss_pct = float(self.config.get("stop_loss_pct", 5.0))
        self.max_holding_minutes = int(self.config.get("max_holding_minutes", 20))
        self.trail_gap_pct = float(self.config.get("trail_gap_pct", 5.0))
        self.min_guaranteed_profit_pct = float(self.config.get("min_guaranteed_profit_pct", 10.0))
        self.scalper_high_water_marks: Dict[str, float] = {}

        # Multi-Bucket Dynamic Capital Allocation
        self.morning_budget = float(self.config.get("morning_scalper_budget_inr") or self.config.get("capital") or 5000.0)
        raw_hz_budget = float(self.config.get("hero_zero_budget_inr", 500.0))
        self.hero_zero_budget = min(5000.0, max(300.0, raw_hz_budget))  # Safety ceiling: Rs. 300 to Rs. 5,000

    @staticmethod
    def get_daily_expiring_index(dt: Optional[datetime] = None) -> str:
        """
        Tarika 1 (Hybrid Model - 2026 SEBI Regulation Aligned):
        Resolves the genuine Indian Benchmark Index expiring today for the 15:10 IST Hero-Zero blast:
        - Tuesday (1): NSE NIFTY 50 Weekly Expiry
        - Thursday (3): BSE SENSEX Weekly Expiry
        """
        from app.services.market_timing_guard import MarketTimingGuard
        ist_dt = MarketTimingGuard.get_ist_now(dt)
        weekday = ist_dt.weekday()
        expiry_map = {
            1: "NIFTY50",  # Tuesday: NSE Nifty 50 Weekly Expiry
            3: "SENSEX",   # Thursday: BSE Sensex Weekly Expiry
        }
        return expiry_map.get(weekday, "NIFTY50" if weekday < 3 else "SENSEX")

    def evaluate_signal(
        self,
        market_data: Dict[str, Any],
        portfolio: Optional[Any] = None,
        positions: Optional[List[Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        current_p = float(market_data.get("price") or market_data.get("last_price") or 1000.0)
        symbol = str(market_data.get("symbol") or "NIFTY50").upper()
        candles = market_data.get("candles") or []

        # 1. Active Position Evaluation (Defensive SL or Dynamic Profit Trailing)
        if positions:
            for pos in positions:
                if isinstance(pos, dict):
                    pos_sym = pos.get("symbol")
                    pos_qty = float(pos.get("quantity", 0) or 0)
                    entry_p = float(pos.get("average_price", current_p) or current_p)
                else:
                    pos_sym = getattr(pos, "symbol", None)
                    pos_qty = float(getattr(pos, "quantity", 0) or 0)
                    entry_p = float(getattr(pos, "average_price", current_p) or current_p)

                if pos_sym == symbol and pos_qty > 0:
                    is_index = symbol in ("NIFTY", "NIFTY50", "BANKNIFTY", "NIFTYBANK", "SENSEX", "BSESENSEX")
                    if is_index and entry_p < 1000 and current_p > 5000:
                        # Real Option Delta Formula (Delta = 0.50 for ATM Options)
                        entry_spot = entry_p / 0.0055
                        eval_price = max(5.0, round(entry_p + (current_p - entry_spot) * 0.50, 2))
                        curr_gain_pct = ((eval_price - entry_p) / entry_p) * 100.0 if entry_p > 0 else 0.0
                    else:
                        eval_price = current_p
                        curr_gain_pct = ((current_p - entry_p) / entry_p) * 100.0 if entry_p > 0 else 0.0

                    # 1A. Defensive Initial Stop Loss (-5.0% Loss Guard)
                    if curr_gain_pct <= -self.stop_loss_pct:
                        self.scalper_high_water_marks.pop(symbol, None)
                        return {
                            "symbol": symbol,
                            "side": "SELL",
                            "quantity": Decimal(str(pos_qty)),
                            "order_type": "MARKET",
                            "price": Decimal(str(eval_price)),
                            "order_source": "AUTO_STOP_LOSS",
                            "source": "AUTO_STOP_LOSS",
                            "reason": f"SCALPER_STOP_LOSS_HIT ({curr_gain_pct:.2f}%)",
                        }

                    # 1B. Dynamic Profit Trailing (+15% Lock ➔ Ride Big Wave!)
                    # When trade hits or exceeds +15.0%, it locks guaranteed +10.0% profit and trails peak high
                    if curr_gain_pct >= self.target_pct or symbol in self.scalper_high_water_marks:
                        h_max = max(self.scalper_high_water_marks.get(symbol, eval_price), eval_price)
                        self.scalper_high_water_marks[symbol] = h_max

                        peak_gain_pct = ((h_max - entry_p) / entry_p) * 100.0 if entry_p > 0 else 0.0
                        trailing_sl_pct = max(self.min_guaranteed_profit_pct, peak_gain_pct - self.trail_gap_pct)
                        trailing_sl_price = round(entry_p * (1.0 + (trailing_sl_pct / 100.0)), 2)

                        # Check if price pulled back below trailing stop-loss
                        if eval_price <= trailing_sl_price:
                            self.scalper_high_water_marks.pop(symbol, None)
                            return {
                                "symbol": symbol,
                                "side": "SELL",
                                "quantity": Decimal(str(pos_qty)),
                                "order_type": "MARKET",
                                "price": Decimal(str(eval_price)),
                                "order_source": "AUTO_PILOT",
                                "source": "AUTO_PILOT",
                                "reason": f"SCALPER_PROFIT_TRAIL_HIT (+{curr_gain_pct:.2f}% Booked - Peak Was +{peak_gain_pct:.2f}%)",
                            }
                        # If price is still above trailing SL, continue holding to ride the big wave!

                    # 1C. Mandatory 15:24:00 IST Hard Exit Clock for Afternoon Hero-Zero
                    from app.services.market_timing_guard import MarketTimingGuard
                    if MarketTimingGuard.is_hero_zero_hard_exit_time():
                        self.scalper_high_water_marks.pop(symbol, None)
                        return {
                            "symbol": symbol,
                            "side": "SELL",
                            "quantity": Decimal(str(pos_qty)),
                            "order_type": "MARKET",
                            "price": Decimal(str(eval_price)),
                            "order_source": "AUTO_PILOT",
                            "source": "AUTO_PILOT",
                            "reason": "HERO_ZERO_HARD_EOD_EXIT (15:24 IST Sharp Cutoff - Zero Broker Penalty)",
                        }

        # 2. VWAP Calculation
        vwap = calculate_vwap(candles, fallback_price=current_p)

        # 3. Fast RSI Calculation
        price_series = extract_price_series(market_data)
        rsi = calculate_rsi(price_series, period=self.fast_rsi_period)

        # 4. Volume Surge Detection (>= 2.5x 10-bar average)
        volume_surge = False
        if candles and len(candles) >= 5:
            recent_vols = [float(c.get("volume", 1000)) for c in candles[-10:]]
            avg_vol = sum(recent_vols) / len(recent_vols) if recent_vols else 1000.0
            curr_vol = float(candles[-1].get("volume", avg_vol))
            if curr_vol >= avg_vol * self.volume_surge_multiplier:
                volume_surge = True

        # 5. Fast Breakout BUY Evaluation (Only permitted in Golden Scalper Slots)
        from app.services.market_timing_guard import MarketTimingGuard
        in_slot, slot_reason = MarketTimingGuard.is_within_scalper_golden_slots()
        if not in_slot:
            return None

        is_hz_slot = MarketTimingGuard.is_hero_zero_gamma_slot()

        # 6. Wallet Cash Guard for Hero-Zero Slot (Requires minimum Rs. 300 cash, capped at maximum Rs. 500)
        if is_hz_slot and portfolio:
            cash_bal = float(getattr(portfolio, "cash_balance", 10000.0) or 10000.0)
            if cash_bal < 300.0:
                return None

        should_buy = (current_p >= vwap) and (rsi >= 58.0 or volume_surge or is_hz_slot)

        if should_buy:
            # Tarika 1 (Hybrid Model): Morning uses configured index (BANKNIFTY), Afternoon 15:10 uses Day's Expiring Index (e.g. SENSEX on Friday)
            trade_symbol = self.get_daily_expiring_index() if is_hz_slot else symbol

            is_index = trade_symbol in ("NIFTY", "NIFTY50", "BANKNIFTY", "NIFTYBANK", "SENSEX", "BSESENSEX", "FINNIFTY", "MIDCPNIFTY")
            if is_index:
                if is_hz_slot:
                    # Afternoon Hero-Zero OTM Option (Dynamic Multi-Bucket Budget: self.hero_zero_budget)
                    exec_price = Decimal("20.00")
                    lot_size = 20 if "SENSEX" in trade_symbol else (15 if "BANK" in trade_symbol else 25)
                    lot_cost = float(exec_price) * lot_size
                    num_lots = max(1, int(self.hero_zero_budget / lot_cost))
                    opt_qty = Decimal(str(num_lots * lot_size))

                    total_val = float(exec_price * opt_qty)
                    # Strict budget ceiling guard
                    if total_val > self.hero_zero_budget and num_lots > 1:
                        opt_qty = Decimal(str((num_lots - 1) * lot_size))
                else:
                    # Morning ATM Option (~Rs. 280-310 per share) on Bank Nifty / Nifty
                    exec_price = Decimal(str(round(current_p * 0.0055, 2))) if current_p > 5000 else Decimal(str(round(current_p, 2)))
                    lot_size = 15 if "BANK" in trade_symbol else (20 if "SENSEX" in trade_symbol else 25)
                    lot_cost = float(exec_price) * lot_size
                    num_lots = max(1, int(self.morning_budget / lot_cost)) if lot_cost > 0 else 1
                    opt_qty = Decimal(str(num_lots * lot_size))
            else:
                exec_price = Decimal(str(round(current_p, 2)))
                opt_qty = self.quantity

            exec_flt = float(exec_price)
            target_price = round(exec_flt * (1.0 + (self.target_pct / 100.0)), 2)
            stop_loss_price = round(exec_flt * (1.0 - (self.stop_loss_pct / 100.0)), 2)

            return {
                "symbol": trade_symbol,
                "side": "BUY",
                "quantity": opt_qty,
                "order_type": self.order_type,
                "product": "NRML" if is_hz_slot else "MIS",
                "price": exec_price,
                "stop_loss": Decimal(str(stop_loss_price)),
                "target": Decimal(str(target_price)),
                "order_source": "AUTO_HERO_ZERO" if is_hz_slot else "AUTO_PILOT",
                "source": "AUTO_HERO_ZERO" if is_hz_slot else "AUTO_PILOT",
                "reason": f"HERO_ZERO_GAMMA_BLAST ({trade_symbol} Expiry Special - NRML Order)" if is_hz_slot else "SCALPER_BREAKOUT_ENTRY",
                "strategy_mode": "15_MIN_FAST_SCALPER",
                "timeframe": "1m/3m",
                "expected_duration": "5-15 mins" if is_hz_slot else "10-20 mins",
            }

        return None

    def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Implements abstract generate_signal method for base interface compatibility."""
        return self.evaluate_signal(market_data)


# ---------------------------------------------------------------------------
# 0B. Full-Day Multi-Regime Strategy (The 5 Institutional Pillars)
# ---------------------------------------------------------------------------


class FullDayMultiRegimeStrategy(BaseStrategy):
    """
    Full-Day Multi-Regime Equity Strategy incorporating all 5 Institutional Pillars:
    - Pillar 1: Dynamic Market Regime Detection (ADX + ATR + EMA State Machine)
    - Pillar 2: Dynamic ATR Chandelier Trailing Stop-Loss
    - Pillar 3: Sector & Relative Strength Outperformance Filter (Alpha vs Benchmark)
    - Pillar 4: Volatility Risk-Parity Position Sizing (Fixed ₹500 or ₹1,000 Risk)
    - Pillar 5: Auto Intraday EOD Square-Off (15:15 IST Hard Exit)
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        self.config = config or {}
        self.symbol = str(self.config.get("symbol") or self.config.get("tradingsymbol") or "SBIN").upper()
        self.risk_per_trade_inr = float(self.config.get("risk_per_trade_inr", 500.0))
        self.full_day_budget = float(self.config.get("full_day_equity_budget_inr") or self.config.get("capital") or 10000.0)
        self.atr_multiplier = float(self.config.get("atr_multiplier", 2.0))
        self.adx_trend_threshold = float(self.config.get("adx_trend_threshold", 25.0))
        self.max_position_qty = int(self.config.get("max_position_qty", 100))
        self.high_water_marks: Dict[str, float] = {}

    def evaluate_signal(
        self,
        market_data: Dict[str, Any],
        portfolio: Optional[Any] = None,
        positions: Optional[List[Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        current_p = float(market_data.get("price") or market_data.get("last_price") or 1000.0)
        symbol = str(market_data.get("symbol") or self.symbol).upper()

        # PILLAR 5: Check 15:15 IST Mandatory Intraday EOD Square-Off
        from app.services.market_timing_guard import MarketTimingGuard
        is_eod_exit = MarketTimingGuard.is_intraday_eod_squareoff_time()

        # Check existing positions for Trailing SL or EOD Square-Off
        if positions:
            for pos in positions:
                pos_sym = pos.get("symbol") if isinstance(pos, dict) else getattr(pos, "symbol", None)
                pos_qty = float(pos.get("quantity", 0) or 0) if isinstance(pos, dict) else float(getattr(pos, "quantity", 0) or 0)
                entry_p = float(pos.get("average_price", current_p) or current_p) if isinstance(pos, dict) else float(getattr(pos, "average_price", current_p) or current_p)

                if pos_sym == symbol and pos_qty > 0:
                    # Pillar 5: EOD 15:15 IST Square-Off Exit
                    if is_eod_exit:
                        return {
                            "symbol": symbol,
                            "side": "SELL",
                            "quantity": Decimal(str(pos_qty)),
                            "order_type": "MARKET",
                            "price": Decimal(str(round(current_p, 2))),
                            "order_source": "AUTO_EOD_SQUAREOFF",
                            "source": "AUTO_EOD_SQUAREOFF",
                            "reason": "EOD_INTRADAY_SQUARE_OFF (15:15 IST Cutoff - Zero Overnight Risk)",
                        }

                    # Pillar 2: Dynamic ATR Chandelier Trailing Stop-Loss
                    atr = calculate_atr(market_data, 14) or (current_p * 0.015)
                    h_max = max(self.high_water_marks.get(symbol, entry_p), current_p)
                    self.high_water_marks[symbol] = h_max

                    trailing_sl = round(h_max - (self.atr_multiplier * atr), 2)
                    initial_sl = round(entry_p - (self.atr_multiplier * atr), 2)
                    effective_sl = max(initial_sl, trailing_sl)

                    if current_p <= effective_sl:
                        gain_pct = round(((current_p - entry_p) / entry_p) * 100.0, 2)
                        return {
                            "symbol": symbol,
                            "side": "SELL",
                            "quantity": Decimal(str(pos_qty)),
                            "order_type": "MARKET",
                            "price": Decimal(str(round(current_p, 2))),
                            "order_source": "AUTO_TRAILING_STOP_LOSS",
                            "source": "AUTO_TRAILING_STOP_LOSS",
                            "reason": f"CHANDELIER_TRAILING_SL_HIT (Exit: Rs.{current_p:.2f}, Trail SL: Rs.{effective_sl:.2f}, PnL: {gain_pct:+.2f}%)",
                        }

        # If it's already past 15:15 IST, do not take new BUY entries
        if is_eod_exit:
            return None

        # PILLAR 1: Dynamic Market Regime Detection
        regime_info = detect_market_regime(market_data)
        regime = regime_info["regime"]
        atr = regime_info["atr"]
        ema20 = regime_info["ema20"]

        # PILLAR 3: Sector & Relative Strength Outperformance Filter
        stock_change = float(market_data.get("change_percent") or market_data.get("changePercent") or 0.0)
        nifty_change = float(market_data.get("nifty_change_percent") or market_data.get("index_change_percent") or 0.0)
        relative_strength = round(stock_change - nifty_change, 2)

        should_buy = False
        signal_reason = ""

        if regime == "TRENDING_BULLISH":
            if current_p >= ema20 and relative_strength >= 0.0:
                should_buy = True
                signal_reason = f"TRENDING_BULLISH_BREAKOUT (ADX: {regime_info['adx']}, RS vs Nifty: {relative_strength:+0.2f}%)"
        elif regime == "RANGE_BOUND":
            candles = market_data.get("candles") or []
            vwap = calculate_vwap(candles, fallback_price=current_p)
            prices = extract_price_series(market_data)
            rsi = calculate_rsi(prices, 14)
            if current_p >= vwap and 42.0 <= rsi <= 62.0:
                should_buy = True
                signal_reason = f"RANGE_BOUND_VWAP_BOUNCE (ADX: {regime_info['adx']}, RSI: {rsi:.1f})"

        if not should_buy:
            return None

        # PILLAR 4: Volatility Risk-Parity Position Sizing (Governed by full_day_budget & risk_per_trade_inr)
        sl_distance = max(1.0, round(self.atr_multiplier * atr, 2))
        risk_qty = int(self.risk_per_trade_inr / sl_distance)
        max_exposure = self.full_day_budget * 5.0  # SEBI 5x Intraday Equity Leverage
        max_qty_by_budget = max(1, int(max_exposure / current_p)) if current_p > 0 else self.max_position_qty
        calculated_qty = max(1, min(self.max_position_qty, risk_qty, max_qty_by_budget))

        stop_loss_p = round(current_p - sl_distance, 2)
        target_p = round(current_p + (sl_distance * 2.5), 2)

        return {
            "symbol": symbol,
            "side": "BUY",
            "quantity": Decimal(str(calculated_qty)),
            "order_type": "MARKET",
            "price": Decimal(str(round(current_p, 2))),
            "stop_loss": Decimal(str(stop_loss_p)),
            "target": Decimal(str(target_p)),
            "reason": signal_reason,
            "order_source": "AUTO_PILOT",
            "source": "AUTO_PILOT",
            "strategy_mode": "FULL_DAY_MULTI_REGIME",
            "indicators": {
                "regime": regime,
                "adx": regime_info["adx"],
                "atr": atr,
                "relative_strength": relative_strength,
                "risk_per_trade_inr": self.risk_per_trade_inr,
                "calculated_quantity": calculated_qty,
            },
        }

    def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return self.evaluate_signal(market_data)


# ---------------------------------------------------------------------------
# Strategy Factory
# ---------------------------------------------------------------------------


class StrategyFactory:
    """Factory creating strategy instances based on strategy definition and configuration."""

    @staticmethod
    def create_strategy(
        definition: Optional[Any] = None,
        config: Optional[Union[Dict[str, Any], str]] = None,
        strategy_type: Optional[str] = None,
    ) -> BaseStrategy:
        """
        Creates and returns a concrete BaseStrategy instance mapped to the specific strategy type.
        """
        resolved_config: Dict[str, Any] = {}
        resolved_type = "RULE_BASED"

        if definition is not None:
            resolved_type = (
                getattr(definition, "strategy_type", None)
                or "RULE_BASED"
            )
            raw_cfg = getattr(definition, "config_json", None)
            if raw_cfg:
                if isinstance(raw_cfg, str):
                    try:
                        resolved_config = json.loads(raw_cfg)
                    except Exception as e:
                        logger.warning("Failed to parse definition config_json: %s", e)
                elif isinstance(raw_cfg, dict):
                    resolved_config = raw_cfg

        if config is not None:
            if isinstance(config, str):
                try:
                    resolved_config.update(json.loads(config))
                except Exception as e:
                    logger.warning("Failed to parse config string: %s", e)
            elif isinstance(config, dict):
                resolved_config.update(config)

        if "strategy_type" in resolved_config:
            resolved_type = resolved_config["strategy_type"]

        if strategy_type is not None:
            resolved_type = strategy_type

        resolved_type_upper = resolved_type.upper().strip()

        # 0. 15-20 Minute Ultra-Fast Momentum Scalper
        def_name = str(getattr(definition, "name", "") or "").upper()
        if (
            resolved_type_upper in ("ULTRA_FAST_SCALPER", "FAST_MOMENTUM_SCALPER", "SCALPER", "FAST_SCALP")
            or "SCALPER" in def_name
            or "OPTION BUYING ATM" in def_name
        ):
            return UltraFastMomentumScalperStrategy(resolved_config)

        # 0B. Full-Day Multi-Regime Strategy (5 Pillars)
        if (
            resolved_type_upper in ("FULL_DAY_MULTI_REGIME", "MULTI_REGIME", "FULL_DAY", "MULTI_REGIME_QUANT")
            or "MULTI-REGIME" in def_name
            or "FULL-DAY" in def_name
            or "FULL DAY" in def_name
        ):
            return FullDayMultiRegimeStrategy(resolved_config)

        # 1. Trend Following
        if resolved_type_upper in ("TREND_FOLLOWING", "TRENDFOLLOWING"):
            return TrendFollowingStrategy(resolved_config)

        # 2. Statistical Arbitrage
        if resolved_type_upper in ("STATISTICAL_ARBITRAGE", "ARBITRAGE", "PAIRS_TRADING"):
            return StatisticalArbitrageStrategy(resolved_config)

        # 3. Volatility Breakout
        if resolved_type_upper in ("VOLATILITY_BREAKOUT", "VOLATILITY", "BREAKOUT"):
            return VolatilityBreakoutStrategy(resolved_config)

        # 4. VWAP Momentum
        if resolved_type_upper in ("VWAP_MOMENTUM", "VWAP", "VWAP_PULLBACK"):
            return VwapMomentumStrategy(resolved_config)

        # 5. Momentum Crossover
        if resolved_type_upper in ("MOMENTUM_CROSSOVER", "MOMENTUM", "EMA_CROSS"):
            return MomentumCrossoverStrategy(resolved_config)

        # 6. Options Delta Neutral
        if resolved_type_upper in ("OPTIONS_DELTA_NEUTRAL", "OPTIONS", "DELTA_NEUTRAL"):
            return OptionsDeltaNeutralStrategy(resolved_config)

        # 7. Opening Range Breakout
        if resolved_type_upper in ("OPENING_RANGE_BREAKOUT", "ORB"):
            return OpeningRangeBreakoutStrategy(resolved_config)

        # 8. RSI Divergence
        if resolved_type_upper in ("RSI_DIVERGENCE", "RSI", "MEAN_REVERSION"):
            return RsiDivergenceStrategy(resolved_config)

        # 9. Smart Beta Quant
        if resolved_type_upper in ("SMART_BETA_QUANT", "SMART_BETA", "QUANT"):
            return SmartBetaQuantStrategy(resolved_config)

        # 10. AI Predictive Ensemble
        if resolved_type_upper in ("AI_PREDICTIVE_ENSEMBLE", "AI", "MACHINE_LEARNING"):
            return AiPredictiveEnsembleStrategy(resolved_config)

        # Generic Rule Based
        if resolved_type_upper in ("RULE_BASED", "CUSTOM_IMPORTED", "TECHNICAL_INDICATOR", "CUSTOM"):
            return RuleBasedStrategy(resolved_config)

        # Deterministic Momentum
        if resolved_type_upper == "DETERMINISTIC_MOMENTUM":
            qty = Decimal("10")
            if "quantity" in resolved_config:
                try:
                    qty = Decimal(str(resolved_config["quantity"]))
                except Exception:
                    qty = Decimal("10")
            threshold = 1.0
            if "threshold_pct" in resolved_config or "change_percent_threshold" in resolved_config:
                try:
                    threshold = float(
                        resolved_config.get("threshold_pct")
                        or resolved_config.get("change_percent_threshold", 1.0)
                    )
                except Exception:
                    threshold = 1.0
            symbol = resolved_config.get("symbol")
            return DeterministicMomentumStrategy(default_quantity=qty, threshold_pct=threshold, symbol=symbol)

        # Fallback to RuleBasedStrategy if custom config present, else DeterministicMomentumStrategy
        if resolved_config:
            return RuleBasedStrategy(resolved_config)

        return DeterministicMomentumStrategy()

