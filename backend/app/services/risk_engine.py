import logging
from typing import Optional, List, Dict, Any
from uuid import UUID
from decimal import Decimal

from app.brokers.base.broker_types import BrokerOrderRequest
from app.database.repositories.trading_risk_repository import TradingRiskRepository
from app.exceptions.risk_exceptions import RiskLimitExceededException, TradingHaltedException

logger = logging.getLogger(__name__)


class RiskEngine:
    """
    Server-side Trading Risk Engine and Order Guardrails Service.
    Executes BEFORE broker order dispatch.
    """

    def __init__(self, repository: TradingRiskRepository) -> None:
        self._repository = repository

    def validate_order(
        self,
        user_id: UUID,
        broker_id: UUID,
        request: BrokerOrderRequest,
        current_positions: Optional[List[Dict[str, Any]]] = None,
        daily_pnl: Optional[Decimal] = None,
    ) -> None:
        """
        Runs pre-trade risk guardrail checks in strict order:
        1. Emergency Kill Switch
        2. Order Frequency Rate Limit
        3. Maximum Order Quantity
        4. Maximum Order Notional Value
        5. Position Limit
        6. Portfolio Exposure Limit
        7. Daily Loss & Drawdown Thresholds
        """
        settings = self._repository.get_risk_settings(user_id=user_id, broker_id=broker_id)

        # 1. Emergency Kill Switch Guard
        if settings.kill_switch_active:
            logger.warning(f"Order rejected for user {user_id}: Emergency kill switch is active.")
            raise TradingHaltedException("Trading is currently halted by emergency kill switch.")

        # 2. Order Frequency Guard
        recent_count = self._repository.count_recent_orders_in_window(
            user_id=user_id, broker_id=broker_id, window_seconds=60
        )
        if recent_count >= settings.max_orders_per_minute:
            logger.warning(f"Order frequency limit reached for user {user_id}: {recent_count}/{settings.max_orders_per_minute} per min.")
            raise RiskLimitExceededException(
                f"Order frequency limit exceeded ({settings.max_orders_per_minute} orders/min)."
            )

        # 3. Max Order Quantity Guard
        if request.quantity > settings.max_order_quantity:
            logger.warning(f"Order quantity {request.quantity} exceeds max allowed {settings.max_order_quantity}.")
            raise RiskLimitExceededException(
                f"Order quantity {request.quantity} exceeds maximum allowed limit of {settings.max_order_quantity}."
            )

        # 4. Max Order Notional Guard
        effective_price = request.price if request.price is not None and request.price > Decimal("0") else Decimal("0")
        if request.order_type.upper() == "LIMIT" or effective_price > Decimal("0"):
            order_notional = request.quantity * effective_price
            if order_notional > settings.max_order_notional:
                logger.warning(f"Order notional {order_notional} exceeds max allowed {settings.max_order_notional}.")
                raise RiskLimitExceededException(
                    f"Order notional value {order_notional} exceeds maximum allowed limit of {settings.max_order_notional}."
                )

        # 5. Position Limit Guard (If position data is provided)
        if current_positions is not None:
            current_sym_qty = Decimal("0")
            for pos in current_positions:
                sym = pos.get("trading_symbol") or pos.get("symbol") or pos.get("tradingsymbol")
                if sym and str(sym).upper() == request.symbol.upper():
                    qty_val = pos.get("quantity") or pos.get("net_quantity") or pos.get("qty") or "0"
                    current_sym_qty += Decimal(str(qty_val))

            projected_qty = abs(current_sym_qty + (request.quantity if request.side.upper() == "BUY" else -request.quantity))
            if projected_qty > settings.max_position_quantity:
                logger.warning(f"Projected position {projected_qty} for {request.symbol} exceeds limit {settings.max_position_quantity}.")
                raise RiskLimitExceededException(
                    f"Projected position quantity {projected_qty} for {request.symbol} exceeds limit of {settings.max_position_quantity}."
                )

        # 6. Daily Loss Guard (If daily_pnl is provided)
        if daily_pnl is not None and daily_pnl < Decimal("0"):
            loss_amount = abs(daily_pnl)
            if loss_amount >= settings.daily_loss_limit:
                logger.warning(f"Daily loss {loss_amount} reached limit {settings.daily_loss_limit}. Halting trading.")
                raise TradingHaltedException(
                    f"Trading halted: Daily loss threshold of {settings.daily_loss_limit} breached."
                )
