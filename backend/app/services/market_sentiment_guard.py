"""
Market Sentiment & Index Trend Filter Guard (NIFTY & BANKNIFTY).

Guards individual stock strategies against counter-trend entries when broad benchmark indices
are experiencing heavy sell-offs or bloodbath regimes.

Core Principle: "Trade with the broad market trend."
- If Nifty 50 or BankNifty is down > -1.25% (heavy market sell-off), aggressive BUY entries
  on individual shares are filtered/paused to avoid getting trapped in market-wide drops.
- Exits and SELL signals are ALWAYS permitted for capital protection.
"""

from typing import Any, Dict, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

BANKING_SYMBOLS = {
    "HDFCBANK",
    "ICICIBANK",
    "SBIN",
    "KOTAKBANK",
    "AXISBANK",
    "INDUSINDBK",
    "BANKBARODA",
    "PNB",
    "FEDERALBNK",
    "AUBANK",
    "BANDHANBNK",
    "IDFCFIRSTB",
}

# In-memory index sentiment cache
_INDEX_SENTIMENT_CACHE: Dict[str, Dict[str, Any]] = {
    "NIFTY": {"change_percent": -0.15, "trend": "NEUTRAL"},
    "BANKNIFTY": {"change_percent": 0.20, "trend": "BULLISH"},
}


class MarketSentimentGuard:
    """
    Validates broad market index sentiment (NIFTY 50 / BANK NIFTY) before allowing
    individual stock entries.
    """

    HEAVY_DOWNTREND_THRESHOLD_PCT: float = -1.25  # Beyond -1.25% drop is considered high-risk sell-off

    @classmethod
    def get_benchmark_for_symbol(cls, symbol: str) -> str:
        """Resolves whether symbol is benchmarked against BANKNIFTY or NIFTY 50."""
        sym_clean = symbol.strip().upper().replace(".NS", "").replace(".BO", "")
        if sym_clean in BANKING_SYMBOLS or "BANK" in sym_clean:
            return "BANKNIFTY"
        return "NIFTY"

    @classmethod
    def update_index_sentiment(cls, index_symbol: str, change_percent: float, current_price: Optional[float] = None) -> None:
        """Updates in-memory sentiment state for NIFTY or BANKNIFTY."""
        idx_key = "BANKNIFTY" if "BANK" in index_symbol.upper() else "NIFTY"
        trend = "BULLISH" if change_percent >= 0.5 else ("BEARISH" if change_percent <= -0.5 else "NEUTRAL")
        _INDEX_SENTIMENT_CACHE[idx_key] = {
            "change_percent": float(change_percent),
            "current_price": current_price,
            "trend": trend,
        }

    @classmethod
    def get_index_sentiment(cls, index_symbol: str) -> Dict[str, Any]:
        """Retrieves latest cached index sentiment metrics."""
        idx_key = "BANKNIFTY" if "BANK" in index_symbol.upper() else "NIFTY"
        return dict(_INDEX_SENTIMENT_CACHE.get(idx_key, {"change_percent": 0.0, "trend": "NEUTRAL"}))

    @classmethod
    def is_market_sentiment_supportive(
        cls,
        symbol: str,
        side: str,
        market_data: Optional[Dict[str, Any]] = None,
        custom_index_change: Optional[float] = None,
        enforce_filter: bool = True,
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Evaluates whether broad market sentiment permits this signal.

        - SELL signals / Exits: ALWAYS permitted.
        - Index symbols (NIFTY/BANKNIFTY themselves): Filter does not self-suppress.
        - BUY signals on individual equities: Suppressed if the parent index benchmark is in a steep sell-off (<= -1.25%).
        """
        side_upper = str(side).upper().strip()
        sym_upper = str(symbol).upper().strip()

        benchmark_idx = cls.get_benchmark_for_symbol(sym_upper)

        # 1. SELL / Exit signals are never blocked by market sentiment
        if side_upper == "SELL":
            return (True, "SELL/Exit signals always permitted regardless of index sentiment.", {"benchmark": benchmark_idx})

        # 2. If signal is for the index itself, bypass individual stock sentiment guard
        if sym_upper in ("NIFTY", "NIFTY50", "BANKNIFTY", "NIFTYBANK", "SENSEX"):
            return (True, "Direct index trading bypassed from sentiment guard.", {"benchmark": benchmark_idx})

        # 3. If filter is explicitly disabled in strategy config
        if not enforce_filter:
            return (True, "Market sentiment filter disabled by strategy configuration.", {"benchmark": benchmark_idx})

        # Resolve index change percent
        index_chg = None
        if custom_index_change is not None:
            index_chg = float(custom_index_change)
        elif market_data:
            raw_idx_chg = (
                market_data.get("nifty_change_percent")
                or market_data.get("index_change_percent")
                or market_data.get("benchmark_change_percent")
            )
            if raw_idx_chg is not None:
                try:
                    index_chg = float(raw_idx_chg)
                except (ValueError, TypeError):
                    index_chg = None

        if index_chg is None:
            cached_data = cls.get_index_sentiment(benchmark_idx)
            index_chg = float(cached_data.get("change_percent", 0.0))

        sentiment_info = {
            "benchmark_index": benchmark_idx,
            "index_change_percent": round(index_chg, 2),
            "regime": "HEAVY_DOWNTREND" if index_chg <= cls.HEAVY_DOWNTREND_THRESHOLD_PCT else ("UPTREND" if index_chg > 0 else "NORMAL"),
        }

        # If broad benchmark is crashing (<= -1.25%), suppress risky BUY entry
        if index_chg <= cls.HEAVY_DOWNTREND_THRESHOLD_PCT:
            reason = (
                f"Suppressed counter-trend BUY on {sym_upper}: Benchmark {benchmark_idx} is in heavy sell-off "
                f"({index_chg:+.2f}%). Protecting against broad market bloodbath."
            )
            logger.info(reason)
            return (False, reason, sentiment_info)

        return (
            True,
            f"Market sentiment supportive ({benchmark_idx}: {index_chg:+.2f}%).",
            sentiment_info,
        )
