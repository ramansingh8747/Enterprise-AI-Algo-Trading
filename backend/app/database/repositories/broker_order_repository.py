import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Iterable, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.database.models.broker_order import BrokerOrderRecord
from app.database.repositories.base_repository import BaseRepository


class BrokerOrderRepository(BaseRepository[BrokerOrderRecord]):
    """Persistence and reconciliation helpers for the broker order ledger."""

    def __init__(self, db: Session) -> None:
        super().__init__(BrokerOrderRecord, db)

    def get_by_broker_order_id(self, broker_id: UUID, broker_order_id: str) -> Optional[BrokerOrderRecord]:
        stmt = select(BrokerOrderRecord).where(
            BrokerOrderRecord.broker_id == broker_id,
            BrokerOrderRecord.broker_order_id == broker_order_id,
        )
        return self.db.scalars(stmt).first()

    def list_for_account(self, user_id: UUID, broker_id: UUID, limit: int = 100) -> list[BrokerOrderRecord]:
        stmt = (
            select(BrokerOrderRecord)
            .where(BrokerOrderRecord.user_id == user_id, BrokerOrderRecord.broker_id == broker_id)
            .order_by(BrokerOrderRecord.updated_at.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())


    @staticmethod
    def normalize_status(status: str, quantity: Decimal, filled_quantity: Decimal) -> str:
        raw = str(status or "UNKNOWN").strip().upper()
        if filled_quantity > 0 and filled_quantity < quantity and raw not in {"CANCELLED", "REJECTED"}:
            return "PARTIAL"
        if raw in {"COMPLETE", "COMPLETED", "FILLED"}:
            return "FILLED"
        if raw in {"CANCELLED", "CANCELED"}:
            return "CANCELLED"
        if raw in {"REJECTED", "FAILED", "FAILURE"}:
            return "REJECTED"
        if raw in {"OPEN", "PENDING", "TRIGGER PENDING", "AMO REQ RECEIVED", "VALIDATION PENDING"}:
            return "OPEN"
        if raw in {"UNKNOWN", "SUBMITTED"}:
            return "SUBMITTED"
        return raw

    def upsert_from_broker(
        self,
        *,
        user_id: UUID,
        broker_id: UUID,
        broker_order: Any,
        raw_payload: Optional[dict[str, Any]] = None,
        strategy_instance_id: Optional[UUID] = None,
        signal_id: Optional[UUID] = None,
        order_source: Optional[str] = None,
    ) -> BrokerOrderRecord:
        now = datetime.now(timezone.utc)
        broker_order_id = str(broker_order.order_id)
        record = self.get_by_broker_order_id(broker_id, broker_order_id)
        if record is None:
            record = BrokerOrderRecord(
                user_id=user_id,
                broker_id=broker_id,
                broker_order_id=broker_order_id,
                symbol=broker_order.symbol,
                side=broker_order.side.lower(),
                quantity=Decimal(str(broker_order.quantity)),
                status=str(broker_order.status).upper(),
                order_source=order_source or "MANUAL_BUY",
            )
            self.db.add(record)

        record.user_id = user_id
        record.symbol = broker_order.symbol
        record.exchange = getattr(broker_order, "exchange", None)
        record.side = broker_order.side.lower()
        record.quantity = Decimal(str(broker_order.quantity))
        record.filled_quantity = Decimal(str(getattr(broker_order, "filled_quantity", 0) or 0))
        avg = getattr(broker_order, "average_fill_price", None)
        record.average_fill_price = Decimal(str(avg)) if avg is not None else record.average_fill_price
        record.order_type = getattr(broker_order, "order_type", None)
        record.product = getattr(broker_order, "product", None)
        record.variety = getattr(broker_order, "variety", None)
        price = getattr(broker_order, "price", None)
        record.price = Decimal(str(price)) if price is not None else record.price
        trigger = getattr(broker_order, "trigger_price", None)
        record.trigger_price = Decimal(str(trigger)) if trigger is not None else record.trigger_price
        record.status = self.normalize_status(
            broker_order.status,
            Decimal(str(broker_order.quantity)),
            Decimal(str(getattr(broker_order, "filled_quantity", 0) or 0)),
        )
        record.last_broker_sync_at = now
        record.broker_created_at = getattr(broker_order, "broker_created_at", None)
        record.broker_updated_at = getattr(broker_order, "broker_updated_at", None)
        if order_source is not None:
            record.order_source = order_source
        if strategy_instance_id is not None:
            record.strategy_instance_id = strategy_instance_id
        if signal_id is not None:
            record.signal_id = signal_id
        if raw_payload is not None:
            record.raw_payload = json.dumps(raw_payload, default=str, sort_keys=True)

        try:
            self.db.commit()
            self.db.refresh(record)
            return record
        except IntegrityError:
            self.db.rollback()
            existing = self.get_by_broker_order_id(broker_id, broker_order_id)
            if existing is None:
                raise
            return existing
        except SQLAlchemyError:
            self.db.rollback()
            raise
