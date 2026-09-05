"""
Automated Protective Stop-Loss Monitoring and Execution Service.

Enforces:
1. Stop-Loss is the ONLY automated condition permitted to trigger a SELL order.
2. SL Sell Quantity = Actual Currently Open Quantity (strictly accounts for prior partial manual exits).
3. Never uses strategy's suggested quantity.
4. Concurrency locking & idempotency to prevent duplicate SL triggers.
5. Mode Isolation: PAPER mode routes to PaperAccountingService, LIVE mode routes to BrokerOrderService.
6. Updates Position status to CLOSED when remaining open quantity reaches zero.
7. Comprehensive audit trail and EventBus event notifications.
"""

import asyncio
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Set
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.brokers.base.broker_types import BrokerOrderRequest
from app.core.logging.trading_audit import audit_event
from app.database.models.paper_portfolio import PaperPosition
from app.database.models.trading_execution import TradingPosition
from app.database.repositories.paper_portfolio_repository import PaperPortfolioRepository
from app.database.repositories.trading_execution_repository import TradingPositionRepository
from app.services.event_bus.interfaces import EventPublisher
from app.services.event_bus.models import Event, EventType
from app.services.event_bus.topics import Topic
from app.services.paper_accounting_service import PaperAccountingService
from app.services.broker_order_service import BrokerOrderService

logger = logging.getLogger(__name__)


class StopLossService:
    """
    Dedicated Stop-Loss Monitoring Engine.
    Periodically evaluates real-time / current market quotes against all open PAPER and LIVE positions
    with registered Stop-Loss limits.
    """

    def __init__(
        self,
        db: Session,
        paper_repository: Optional[PaperPortfolioRepository] = None,
        position_repository: Optional[TradingPositionRepository] = None,
        paper_accounting_service: Optional[PaperAccountingService] = None,
        broker_order_service: Optional[BrokerOrderService] = None,
        event_publisher: Optional[EventPublisher] = None,
    ) -> None:
        self.db = db
        self._paper_repo = paper_repository or PaperPortfolioRepository(db)
        self._pos_repo = position_repository or TradingPositionRepository(db)
        self._paper_accounting = paper_accounting_service
        self._broker_order_service = broker_order_service
        self._event_publisher = event_publisher
        self._in_flight_triggers: Set[str] = set()

    def _publish_event(
        self,
        event_type: EventType,
        user_id: UUID,
        symbol: str,
        execution_mode: str,
        payload: Dict[str, Any],
        strategy_instance_id: Optional[UUID] = None,
        broker_id: Optional[UUID] = None,
    ) -> None:
        if not self._event_publisher:
            return
        try:
            event = Event(
                event_id=uuid4(),
                event_type=event_type,
                timestamp=datetime.now(timezone.utc),
                user_id=user_id,
                strategy_instance_id=strategy_instance_id,
                broker_id=broker_id,
                symbol=symbol,
                execution_mode=execution_mode,
                payload=payload,
            )
            topic = Topic.user(user_id)
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                loop.create_task(self._event_publisher.publish(topic, event))
            else:
                asyncio.run(self._event_publisher.publish(topic, event))
        except Exception as exc:
            logger.warning("StopLossService event publish error: %s", exc)

    def update_trailing_stop_loss(
        self,
        position: Any,
        current_market_price: Decimal,
        is_live: bool = False,
    ) -> Optional[Decimal]:
        """
        Evaluates and dynamically shifts the Stop-Loss upward to lock in profits
        as the position gains value (Trailing Stop Loss / Profit Lock-in).

        Logic:
        1. If profit >= +1.5%: Shift Stop-Loss to Break-Even (entry price + buffer).
        2. If profit >= +3.0%: Shift Stop-Loss to +1.5% profit level (or 1.5% trailing distance).
        3. If profit >= +5.0%: Shift Stop-Loss to +3.5% profit level.
        4. Guarantee: Stop-Loss NEVER moves downward, only ratchets upwards.
        """
        if getattr(position, "status", "") != "OPEN" or getattr(position, "quantity", Decimal("0")) <= Decimal("0"):
            return None

        avg_price = getattr(position, "average_price", None)
        current_sl = getattr(position, "stop_loss", None)

        if avg_price is None or avg_price <= Decimal("0") or current_sl is None:
            return None

        # Calculate gain percentage
        profit_ratio = (current_market_price - avg_price) / avg_price

        candidate_sl = None

        if profit_ratio >= Decimal("0.05"):  # >= +5% profit
            # Lock in +3.5% profit minimum (or 1.5% trailing from current price)
            lock_in_sl = (avg_price * Decimal("1.035")).quantize(Decimal("0.01"))
            trailing_sl = (current_market_price * Decimal("0.985")).quantize(Decimal("0.01"))
            candidate_sl = max(lock_in_sl, trailing_sl)
        elif profit_ratio >= Decimal("0.03"):  # >= +3% profit
            # Lock in +1.5% profit
            lock_in_sl = (avg_price * Decimal("1.015")).quantize(Decimal("0.01"))
            trailing_sl = (current_market_price * Decimal("0.985")).quantize(Decimal("0.01"))
            candidate_sl = max(lock_in_sl, trailing_sl)
        elif profit_ratio >= Decimal("0.015"):  # >= +1.5% profit
            # Shift to Break-Even (Cost price + 0.1% buffer for regulatory charges)
            candidate_sl = (avg_price * Decimal("1.001")).quantize(Decimal("0.01"))

        if candidate_sl is not None and candidate_sl > current_sl:
            old_sl = current_sl
            position.stop_loss = candidate_sl
            if hasattr(self.db, "commit"):
                try:
                    self.db.commit()
                except Exception:
                    pass

            mode_str = "LIVE" if is_live else "PAPER"
            logger.info(
                "TRAILING STOP-LOSS UPDATED (%s): %s avg_entry=%s price=%s old_SL=%s new_SL=%s (+%.2f%% profit locked)",
                mode_str, position.symbol, avg_price, current_market_price, old_sl, candidate_sl, float(profit_ratio * 100)
            )

            audit_event(
                "TRAILING_STOP_LOSS_UPDATED",
                user_id=position.user_id,
                outcome="SUCCESS",
                resource_type="trading_position" if is_live else "paper_position",
                resource_id=str(position.id),
                symbol=position.symbol,
                average_price=str(avg_price),
                current_price=str(current_market_price),
                old_stop_loss=str(old_sl),
                new_stop_loss=str(candidate_sl),
                profit_pct=str(round(float(profit_ratio * 100), 2)),
                execution_mode=mode_str,
            )

            self._publish_event(
                EventType.POSITION_UPDATED,
                user_id=position.user_id,
                symbol=position.symbol,
                execution_mode=mode_str,
                strategy_instance_id=getattr(position, "strategy_instance_id", None),
                payload={
                    "position_id": str(position.id),
                    "symbol": position.symbol,
                    "stop_loss": str(candidate_sl),
                    "old_stop_loss": str(old_sl),
                    "trailing_updated": True,
                    "profit_pct": round(float(profit_ratio * 100), 2),
                    "execution_mode": mode_str,
                },
            )
            return candidate_sl

        return None

    def evaluate_paper_position_sl(
        self,
        position: PaperPosition,
        current_market_price: Decimal,
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluates and executes an automatic protective Stop-Loss SELL for a PAPER position.
        """
        if position.status != "OPEN" or position.quantity <= Decimal("0") or position.stop_loss is None:
            return None

        # 1. Update Trailing Stop Loss if position is in profit
        self.update_trailing_stop_loss(position, current_market_price, is_live=False)

        # LONG position SL check: market price drops to or below stop loss
        if current_market_price > position.stop_loss:
            return None

        # Lock key for idempotency
        trigger_key = f"PAPER_SL:{position.id}:{position.quantity}"
        if trigger_key in self._in_flight_triggers:
            logger.info("Stop-loss trigger already in flight for position %s", position.id)
            return None

        self._in_flight_triggers.add(trigger_key)
        try:
            # 1. Row lock position for update
            locked_pos = self._paper_repo.lock_position_for_update(position.paper_portfolio_id, position.symbol)
            if not locked_pos or locked_pos.status != "OPEN" or locked_pos.quantity <= Decimal("0"):
                return None

            # Actual open quantity (accounts for any manual partial sells)
            actual_open_quantity = locked_pos.quantity
            sl_price = current_market_price
            paper_order_id = f"AUTO-SL-PAPER-{uuid4().hex[:12]}"

            logger.warning(
                "AUTOMATIC STOP-LOSS TRIGGERED (PAPER): %s open_qty=%s SL=%s current_price=%s user_id=%s",
                position.symbol, actual_open_quantity, position.stop_loss, sl_price, position.user_id
            )

            audit_event(
                "AUTO_STOP_LOSS_TRIGGERED",
                user_id=position.user_id,
                outcome="TRIGGERED",
                resource_type="paper_position",
                resource_id=str(position.id),
                symbol=position.symbol,
                stop_loss=str(position.stop_loss),
                current_price=str(sl_price),
                open_quantity=str(actual_open_quantity),
                execution_mode="PAPER",
            )

            # Execute Paper SELL for the EXACT currently open quantity
            if self._paper_accounting:
                self._paper_accounting.record_fill(
                    user_id=position.user_id,
                    symbol=position.symbol,
                    side="SELL",
                    quantity=actual_open_quantity,
                    price=sl_price,
                    execution_mode="PAPER",
                    paper_portfolio_id=position.paper_portfolio_id,
                    strategy_instance_id=position.strategy_instance_id,
                    execution_id=paper_order_id,
                )

            # Refresh locked position and mark CLOSED if quantity is 0
            self.db.refresh(locked_pos)
            if locked_pos.quantity <= Decimal("0"):
                locked_pos.status = "CLOSED"
                locked_pos.stop_loss = None
                self.db.commit()

            audit_event(
                "AUTO_STOP_LOSS_EXECUTED",
                user_id=position.user_id,
                outcome="SUCCESS",
                resource_type="paper_order",
                resource_id=paper_order_id,
                symbol=position.symbol,
                side="SELL",
                quantity=str(actual_open_quantity),
                price=str(sl_price),
                order_source="AUTO_STOP_LOSS",
                execution_mode="PAPER",
            )

            result = {
                "position_id": str(position.id),
                "symbol": position.symbol,
                "order_id": paper_order_id,
                "executed_quantity": str(actual_open_quantity),
                "executed_price": str(sl_price),
                "status": "CLOSED",
                "execution_mode": "PAPER",
                "order_source": "AUTO_STOP_LOSS",
            }

            self._publish_event(
                EventType.POSITION_UPDATED,
                user_id=position.user_id,
                symbol=position.symbol,
                execution_mode="PAPER",
                strategy_instance_id=position.strategy_instance_id,
                payload=result,
            )

            return result
        finally:
            self._in_flight_triggers.discard(trigger_key)

    def evaluate_live_position_sl(
        self,
        position: TradingPosition,
        current_market_price: Decimal,
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluates and executes an automatic protective Stop-Loss SELL for a LIVE position.
        """
        if position.status != "OPEN" or position.quantity == Decimal("0") or position.stop_loss is None:
            return None

        # 1. Update Trailing Stop Loss if position is in profit
        self.update_trailing_stop_loss(position, current_market_price, is_live=True)

        is_long = position.quantity > Decimal("0")
        if is_long and current_market_price > position.stop_loss:
            return None
        if not is_long and current_market_price < position.stop_loss:
            return None

        trigger_key = f"LIVE_SL:{position.id}:{position.quantity}"
        if trigger_key in self._in_flight_triggers:
            return None

        self._in_flight_triggers.add(trigger_key)
        try:
            locked_pos = self._pos_repo.get_for_update(position.user_id, position.broker_id, position.symbol)
            if not locked_pos or locked_pos.status != "OPEN" or locked_pos.quantity == Decimal("0"):
                return None

            actual_open_qty = abs(locked_pos.quantity)
            side = "SELL" if is_long else "BUY"

            logger.warning(
                "AUTOMATIC STOP-LOSS TRIGGERED (LIVE): %s open_qty=%s SL=%s current_price=%s user_id=%s broker_id=%s",
                position.symbol, actual_open_qty, position.stop_loss, current_market_price, position.user_id, position.broker_id
            )

            audit_event(
                "AUTO_STOP_LOSS_TRIGGERED",
                user_id=position.user_id,
                broker_id=position.broker_id,
                outcome="TRIGGERED",
                resource_type="trading_position",
                resource_id=str(position.id),
                symbol=position.symbol,
                stop_loss=str(position.stop_loss),
                current_price=str(current_market_price),
                open_quantity=str(actual_open_qty),
                execution_mode="LIVE",
            )

            if not self._broker_order_service:
                raise RuntimeError("BrokerOrderService is required for LIVE Stop-Loss execution.")

            order_request = BrokerOrderRequest(
                symbol=position.symbol,
                exchange="NSE",
                quantity=actual_open_qty,
                side=side,
                order_type="MARKET",
                product="CNC",
                variety="regular",
                price=current_market_price,
            )

            idempotency_key = f"AUTO-SL-{position.id}-{actual_open_qty}-{current_market_price}"
            order = self._broker_order_service.place_order(
                user_id=position.user_id,
                broker_id=position.broker_id,
                request=order_request,
                idempotency_key=idempotency_key,
                strategy_instance_id=position.strategy_instance_id,
                order_source="AUTO_STOP_LOSS",
            )

            audit_event(
                "AUTO_STOP_LOSS_EXECUTED",
                user_id=position.user_id,
                broker_id=position.broker_id,
                outcome="SUCCESS",
                resource_type="broker_order",
                resource_id=order.order_id,
                symbol=position.symbol,
                side=side,
                quantity=str(actual_open_qty),
                price=str(current_market_price),
                order_source="AUTO_STOP_LOSS",
                execution_mode="LIVE",
            )

            return {
                "position_id": str(position.id),
                "symbol": position.symbol,
                "order_id": order.order_id,
                "executed_quantity": str(actual_open_qty),
                "executed_price": str(current_market_price),
                "execution_mode": "LIVE",
                "order_source": "AUTO_STOP_LOSS",
            }
        finally:
            self._in_flight_triggers.discard(trigger_key)

    def scan_and_enforce_all_stop_losses(self, quotes: Dict[str, Decimal]) -> List[Dict[str, Any]]:
        """
        Scans all open Paper and Live positions with active Stop-Loss and executes protective exits.
        """
        results = []
        # 1. Paper Positions
        paper_positions = self._paper_repo.list_all_open_positions_with_stop_loss()
        for pos in paper_positions:
            price = quotes.get(pos.symbol.upper())
            if price is not None:
                res = self.evaluate_paper_position_sl(pos, price)
                if res:
                    results.append(res)

        # 2. Live Positions
        live_positions = self._pos_repo.list_all_open_with_stop_loss()
        for pos in live_positions:
            price = quotes.get(pos.symbol.upper())
            if price is not None:
                res = self.evaluate_live_position_sl(pos, price)
                if res:
                    results.append(res)

        return results
