"""
Dynamic Position Sizing & Capital Allocation Service.

Calculates mathematically sound order quantities based on:
1. Portfolio / Account Capital (e.g. ₹1,00,000 to ₹10,00,000)
2. Risk Budget per Trade (e.g. 1.0% of portfolio capital)
3. Volatility / Stop-Loss Distance (|Entry Price - Stop Loss Price|)
4. Maximum Single-Stock Capital Allocation Cap (e.g. max 20% of capital)
"""

from decimal import Decimal, ROUND_FLOOR
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class PositionSizer:
    """Computes dynamic risk-adjusted position sizes for equity cash and derivatives."""

    @classmethod
    def calculate_quantity(
        cls,
        price: Decimal,
        stop_loss: Optional[Decimal],
        portfolio_capital: Decimal,
        risk_pct_per_trade: float = 1.0,
        max_capital_allocation_pct: float = 20.0,
        default_quantity: Optional[Decimal] = None,
    ) -> Decimal:
        """
        Calculates optimal share quantity based on capital risk and stop-loss distance.

        Formula:
            Risk Amount = Portfolio Capital * (Risk % / 100)
            Risk per Share = |Price - Stop Loss| (default 2% of price if SL not given)
            Risk Quantity = floor(Risk Amount / Risk per Share)
            Allocation Quantity = floor((Portfolio Capital * (Max Allocation % / 100)) / Price)
            Final Quantity = max(1, min(Risk Quantity, Allocation Quantity))
        """
        fallback_qty = default_quantity if default_quantity is not None and default_quantity > Decimal("0") else Decimal("10")

        if price is None or price <= Decimal("0") or portfolio_capital is None or portfolio_capital <= Decimal("0"):
            return fallback_qty

        # Guard: If price of 1 share exceeds total available capital, quantity is 0 (unaffordable)
        if price > portfolio_capital:
            logger.info("Share price ₹%s exceeds total portfolio capital ₹%s. Cannot afford 1 share.", price, portfolio_capital)
            return Decimal("0")

        try:
            # 1. Total Risk Budget for this trade (e.g. ₹1,00,000 * 1.0% = ₹1,000)
            risk_pct_decimal = Decimal(str(max(0.1, min(10.0, risk_pct_per_trade)))) / Decimal("100")
            risk_budget = portfolio_capital * risk_pct_decimal

            # 2. Risk per share
            if stop_loss is not None and stop_loss > Decimal("0") and abs(price - stop_loss) > Decimal("0.01"):
                risk_per_share = abs(price - stop_loss)
            else:
                # Default 2% protective stop distance
                risk_per_share = price * Decimal("0.02")

            if risk_per_share <= Decimal("0"):
                return fallback_qty

            raw_risk_qty = risk_budget / risk_per_share

            # 3. Maximum Capital Allocation Limit per Single Stock (e.g. max 20% to 100% of capital)
            max_alloc_decimal = Decimal(str(max(1.0, min(100.0, max_capital_allocation_pct)))) / Decimal("100")
            max_notional_allowed = portfolio_capital * max_alloc_decimal
            max_shares_by_notional = max_notional_allowed / price

            # 4. Target Quantity is constrained by risk budget AND single-stock capital cap
            target_qty = min(raw_risk_qty, max_shares_by_notional)

            # Round down to whole integer shares
            final_qty = target_qty.quantize(Decimal("1"), rounding=ROUND_FLOOR)
            return max(Decimal("1"), final_qty)

        except Exception as exc:
            logger.warning("Error calculating dynamic position sizing: %s. Using fallback quantity %s", exc, fallback_qty)
            return fallback_qty
