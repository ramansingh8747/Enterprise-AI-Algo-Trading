import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from app.database.models.broker_order import BrokerOrderRecord
from app.database.models.trading_execution import TradingExecution, TradingPosition
from app.database.repositories.trading_execution_repository import TradingExecutionRepository, TradingPositionRepository
from app.services.event_bus.trading_events import TradingEventPublisher
from app.services.event_bus.models import EventType

logger = logging.getLogger(__name__)


class ExecutionPositionService:
    """Atomically turns fills into immutable executions and net LIVE positions."""

    def __init__(self, execution_repository: TradingExecutionRepository, position_repository: TradingPositionRepository, trading_event_publisher: Optional[TradingEventPublisher] = None) -> None:
        self._executions = execution_repository
        self._positions = position_repository
        self._trading_event_publisher = trading_event_publisher

    @staticmethod
    def incremental_fill_price(old_qty: Decimal, old_avg: Decimal, new_qty: Decimal, new_avg: Decimal, delta_qty: Decimal) -> Decimal:
        if delta_qty <= 0:
            raise ValueError("Execution quantity must be positive")
        if new_avg is None:
            raise ValueError("Broker fill price is required for a new execution")
        if old_qty <= 0:
            return new_avg
        return ((new_avg * new_qty) - (old_avg * old_qty)) / delta_qty

    def reconcile_broker_order(
        self,
        *,
        user_id: UUID,
        broker_id: UUID,
        order_record: BrokerOrderRecord,
        previous_filled_quantity: Decimal,
        previous_average_fill_price: Optional[Decimal],
    ) -> Optional[TradingExecution]:
        new_filled = Decimal(str(order_record.filled_quantity or 0))
        old_filled = Decimal(str(previous_filled_quantity or 0))
        delta = new_filled - old_filled
        if delta <= 0:
            return None
        if order_record.average_fill_price is None:
            raise ValueError("Broker reported additional filled quantity without an average fill price")

        old_avg = Decimal(str(previous_average_fill_price or 0))
        new_avg = Decimal(str(order_record.average_fill_price))
        execution_price = self.incremental_fill_price(old_filled, old_avg, new_filled, new_avg, delta)
        external_id = f"{order_record.broker_order_id}:{new_filled}"

        existing = self._executions.get_by_external_id("LIVE", broker_id, external_id)
        if existing:
            return existing

        execution = TradingExecution(
            user_id=user_id,
            broker_id=broker_id,
            broker_order_record_id=order_record.id,
            strategy_instance_id=order_record.strategy_instance_id,
            signal_id=order_record.signal_id,
            execution_mode="LIVE",
            external_execution_id=external_id,
            symbol=order_record.symbol,
            side=order_record.side.upper(),
            quantity=delta,
            price=execution_price,
            executed_at=order_record.broker_updated_at or datetime.now(timezone.utc),
        )
        self._executions.db.add(execution)
        self._apply_live_position(
            user_id=user_id,
            broker_id=broker_id,
            symbol=order_record.symbol,
            side=order_record.side,
            quantity=delta,
            price=execution_price,
            strategy_instance_id=order_record.strategy_instance_id,
            executed_at=execution.executed_at,
        )
        self._executions.db.commit()
        self._executions.db.refresh(execution)
        if self._trading_event_publisher:
            self._trading_event_publisher.emit(
                EventType.EXECUTION_CREATED, user_id=user_id, broker_id=broker_id,
                strategy_instance_id=execution.strategy_instance_id, symbol=execution.symbol, execution_mode="LIVE",
                payload={"execution_id": execution.id, "order_id": order_record.broker_order_id, "quantity": execution.quantity, "price": execution.price, "side": execution.side},
            )
            position = self._positions.get_for_update(user_id, broker_id, execution.symbol)
            if position:
                self._trading_event_publisher.emit(
                    EventType.POSITION_UPDATED, user_id=user_id, broker_id=broker_id,
                    strategy_instance_id=position.strategy_instance_id, symbol=position.symbol, execution_mode="LIVE",
                    payload={"position_id": position.id, "quantity": position.quantity, "average_price": position.average_price, "realized_pnl": position.realized_pnl},
                )
        return execution

    def stage_paper_execution(
        self,
        *,
        user_id: UUID,
        broker_id: Optional[UUID],
        paper_order_id: str,
        strategy_instance_id: Optional[UUID],
        signal_id: Optional[UUID],
        symbol: str,
        side: str,
        quantity: Decimal,
        price: Decimal,
        executed_at: Optional[datetime] = None,
    ) -> TradingExecution:
        existing = self._executions.get_by_external_id("PAPER", broker_id, paper_order_id)
        if existing:
            return existing
        execution = TradingExecution(
            user_id=user_id,
            broker_id=broker_id,
            broker_order_record_id=None,
            strategy_instance_id=strategy_instance_id,
            signal_id=signal_id,
            execution_mode="PAPER",
            external_execution_id=paper_order_id,
            symbol=symbol.upper(),
            side=side.upper(),
            quantity=Decimal(str(quantity)),
            price=Decimal(str(price)),
            executed_at=executed_at or datetime.now(timezone.utc),
        )
        self._executions.db.add(execution)
        return execution

    def record_paper_execution(
        self,
        *,
        user_id: UUID,
        broker_id: Optional[UUID],
        paper_order_id: str,
        strategy_instance_id: Optional[UUID],
        signal_id: Optional[UUID],
        symbol: str,
        side: str,
        quantity: Decimal,
        price: Decimal,
        executed_at: Optional[datetime] = None,
    ) -> TradingExecution:
        execution = self.stage_paper_execution(
            user_id=user_id, broker_id=broker_id, paper_order_id=paper_order_id, strategy_instance_id=strategy_instance_id,
            signal_id=signal_id, symbol=symbol, side=side, quantity=quantity, price=price, executed_at=executed_at,
        )
        self._executions.db.commit()
        self._executions.db.refresh(execution)
        if self._trading_event_publisher:
            self._trading_event_publisher.emit(
                EventType.EXECUTION_CREATED, user_id=user_id, symbol=execution.symbol, execution_mode="PAPER",
                strategy_instance_id=execution.strategy_instance_id,
                payload={"execution_id": execution.id, "order_id": paper_order_id, "quantity": execution.quantity, "price": execution.price, "side": execution.side},
            )
        return execution

    def _apply_live_position(
        self,
        *,
        user_id: UUID,
        broker_id: UUID,
        symbol: str,
        side: str,
        quantity: Decimal,
        price: Decimal,
        strategy_instance_id: Optional[UUID],
        executed_at: datetime,
    ) -> TradingPosition:
        position = self._positions.get_for_update(user_id, broker_id, symbol)
        if position is None:
            position = TradingPosition(
                user_id=user_id,
                broker_id=broker_id,
                strategy_instance_id=strategy_instance_id,
                symbol=symbol.upper(),
                quantity=Decimal("0"),
                average_price=Decimal("0"),
                realized_pnl=Decimal("0"),
            )
            self._positions.db.add(position)
            self._positions.db.flush()

        signed_delta = quantity if side.upper() == "BUY" else -quantity
        old_qty = Decimal(str(position.quantity))
        old_avg = Decimal(str(position.average_price))
        new_qty = old_qty + signed_delta

        if old_qty == 0:
            position.quantity = new_qty
            position.average_price = price if new_qty != 0 else Decimal("0")
        elif old_qty > 0 and signed_delta > 0:
            position.average_price = ((old_qty * old_avg) + (quantity * price)) / new_qty
            position.quantity = new_qty
        elif old_qty < 0 and signed_delta < 0:
            old_abs = abs(old_qty)
            new_abs = abs(new_qty)
            position.average_price = ((old_abs * old_avg) + (quantity * price)) / new_abs
            position.quantity = new_qty
        else:
            closing_qty = min(abs(old_qty), abs(signed_delta))
            pnl = (price - old_avg) * closing_qty if old_qty > 0 else (old_avg - price) * closing_qty
            position.realized_pnl = Decimal(str(position.realized_pnl)) + pnl
            position.quantity = new_qty
            if new_qty == 0:
                position.average_price = Decimal("0")
            elif (old_qty > 0 and new_qty < 0) or (old_qty < 0 and new_qty > 0):
                position.average_price = price

        position.strategy_instance_id = position.strategy_instance_id or strategy_instance_id
        position.last_execution_at = executed_at
        self._positions.db.add(position)
        return position
