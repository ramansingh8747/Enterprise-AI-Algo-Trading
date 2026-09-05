from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.database.models.broker import Broker
from app.database.models.broker_order import BrokerOrderRecord
from app.database.models.broker_session import BrokerSession
from app.database.models.trading_execution import TradingPosition
from app.dependencies.broker import build_runtime_broker_order_service
from app.schemas.admin_reconciliation import ReconciliationAccount, ReconciliationMetric, ReconciliationSummary
from app.services.event_bus.trading_events import TradingEventPublisher
from app.services.event_bus.models import EventType


class AdminReconciliationService:
    """Read-only reconciliation of application ledger state against active broker state."""

    def __init__(self, db: Session, trading_events: Optional[TradingEventPublisher] = None) -> None:
        self.db = db
        self.trading_events = trading_events

    @staticmethod
    def _decimal(value: Any) -> Decimal:
        return Decimal(str(value or "0"))

    @staticmethod
    def _normal_status(status: Any) -> str:
        raw = str(status or "UNKNOWN").upper()
        if raw in {"COMPLETE", "COMPLETED", "FILLED"}:
            return "FILLED"
        if raw in {"CANCELLED", "CANCELED"}:
            return "CANCELLED"
        if raw in {"REJECTED", "FAILED", "FAILURE"}:
            return "REJECTED"
        if raw in {"OPEN", "PENDING", "TRIGGER PENDING", "AMO REQ RECEIVED", "VALIDATION PENDING"}:
            return "OPEN"
        if raw in {"SUBMITTED", "UNKNOWN"}:
            return "SUBMITTED"
        return raw

    def _compare_orders(self, user_id: UUID, broker_id: UUID, provider_orders: list[Any]) -> ReconciliationMetric:
        internal = self.db.query(BrokerOrderRecord).filter(
            BrokerOrderRecord.user_id == user_id,
            BrokerOrderRecord.broker_id == broker_id,
        ).all()
        internal_by_id = {str(row.broker_order_id): row for row in internal}
        external_by_id = {str(getattr(row, "order_id", "")): row for row in provider_orders}
        details: list[dict] = []

        for order_id in sorted(set(internal_by_id) | set(external_by_id)):
            left = internal_by_id.get(order_id)
            right = external_by_id.get(order_id)
            if left is None:
                details.append({"type": "EXTERNAL_ONLY", "order_id": order_id, "external_status": self._normal_status(getattr(right, "status", None))})
                continue
            if right is None:
                details.append({"type": "INTERNAL_ONLY", "order_id": order_id, "internal_status": self._normal_status(left.status)})
                continue
            external_status = self._normal_status(getattr(right, "status", None))
            external_filled = self._decimal(getattr(right, "filled_quantity", 0))
            if self._normal_status(left.status) != external_status or self._decimal(left.filled_quantity) != external_filled:
                details.append({
                    "type": "FIELD_MISMATCH", "order_id": order_id,
                    "internal_status": self._normal_status(left.status), "external_status": external_status,
                    "internal_filled_quantity": str(left.filled_quantity), "external_filled_quantity": str(external_filled),
                })

        return ReconciliationMetric(
            status="MISMATCH" if details else "MATCHED",
            internal_count=len(internal_by_id), external_count=len(external_by_id),
            difference_count=len(details), details=details[:100],
        )

    def _compare_positions(self, user_id: UUID, broker_id: UUID, provider_positions: list[Any]) -> ReconciliationMetric:
        internal = self.db.query(TradingPosition).filter(
            TradingPosition.user_id == user_id,
            TradingPosition.broker_id == broker_id,
            TradingPosition.quantity != 0,
        ).all()
        internal_by_symbol = {str(row.symbol).upper(): row for row in internal}
        external_by_symbol = {str(getattr(row, "symbol", "")).upper(): row for row in provider_positions}
        details: list[dict] = []

        for symbol in sorted(set(internal_by_symbol) | set(external_by_symbol)):
            left = internal_by_symbol.get(symbol)
            right = external_by_symbol.get(symbol)
            if left is None:
                details.append({"type": "EXTERNAL_ONLY", "symbol": symbol, "external_quantity": str(getattr(right, "quantity", 0))})
                continue
            if right is None:
                details.append({"type": "INTERNAL_ONLY", "symbol": symbol, "internal_quantity": str(left.quantity)})
                continue
            external_qty = self._decimal(getattr(right, "quantity", 0))
            external_avg = self._decimal(getattr(right, "avg_price", 0))
            if self._decimal(left.quantity) != external_qty or self._decimal(left.average_price) != external_avg:
                details.append({
                    "type": "FIELD_MISMATCH", "symbol": symbol,
                    "internal_quantity": str(left.quantity), "external_quantity": str(external_qty),
                    "internal_average_price": str(left.average_price), "external_average_price": str(external_avg),
                })

        return ReconciliationMetric(
            status="MISMATCH" if details else "MATCHED",
            internal_count=len(internal_by_symbol), external_count=len(external_by_symbol),
            difference_count=len(details), details=details[:100],
        )

    def _account(self, session: BrokerSession, broker: Broker) -> ReconciliationAccount:
        checked_at = datetime.now(timezone.utc)
        try:
            runtime_service = build_runtime_broker_order_service(self.db)
            provider = runtime_service._get_provider(session.user_id, session.broker_id)
            external_orders = provider.get_orders() or []
            external_positions = provider.get_positions() or []
            orders = self._compare_orders(session.user_id, session.broker_id, external_orders)
            positions = self._compare_positions(session.user_id, session.broker_id, external_positions)
            # BrokerInterface currently exposes profile/holdings/positions/orders, but no cash/balance API.
            cash = ReconciliationMetric(status="UNAVAILABLE", details=[{"reason": "BrokerInterface does not expose an account cash/balance method yet."}])
            statuses = {orders.status, positions.status, cash.status}
            overall = "MISMATCH" if "MISMATCH" in statuses else "UNAVAILABLE" if "UNAVAILABLE" in statuses else "MATCHED"
            account = ReconciliationAccount(
                user_id=session.user_id, broker_id=session.broker_id,
                broker_name=broker.broker_name, broker_type=broker.broker_type,
                session_status="ACTIVE" if session.expires_at > checked_at else "EXPIRED",
                overall_status=overall, checked_at=checked_at,
                cash=cash, positions=positions, orders=orders,
            )
            if self.trading_events:
                self.trading_events.emit(
                    EventType.RECONCILIATION_COMPLETED,
                    user_id=session.user_id, broker_id=session.broker_id,
                    execution_mode="LIVE", payload={"status": overall, "orders": orders.status, "positions": positions.status, "cash": cash.status},
                )
            return account
        except Exception as exc:
            return ReconciliationAccount(
                user_id=session.user_id, broker_id=session.broker_id,
                broker_name=broker.broker_name, broker_type=broker.broker_type,
                session_status="ACTIVE" if session.expires_at > checked_at else "EXPIRED",
                overall_status="ERROR", checked_at=checked_at,
                cash=ReconciliationMetric(status="ERROR"), positions=ReconciliationMetric(status="ERROR"),
                orders=ReconciliationMetric(status="ERROR"), error=str(exc),
            )

    def reconcile(self) -> ReconciliationSummary:
        checked_at = datetime.now(timezone.utc)
        rows = self.db.query(BrokerSession, Broker).join(Broker, Broker.id == BrokerSession.broker_id).filter(
            Broker.is_active.is_(True),
            BrokerSession.expires_at > checked_at,
        ).all()
        accounts = [self._account(session, broker) for session, broker in rows]

        def aggregate(name: str) -> ReconciliationMetric:
            metrics = [getattr(account, name) for account in accounts]
            statuses = {metric.status for metric in metrics}
            details = [item for metric in metrics for item in metric.details][:100]
            return ReconciliationMetric(
                status="ERROR" if "ERROR" in statuses else "MISMATCH" if "MISMATCH" in statuses else "UNAVAILABLE" if "UNAVAILABLE" in statuses else "MATCHED",
                internal_count=sum(metric.internal_count for metric in metrics),
                external_count=sum(metric.external_count for metric in metrics),
                difference_count=sum(metric.difference_count for metric in metrics),
                details=details,
            )

        cash, positions, orders = aggregate("cash"), aggregate("positions"), aggregate("orders")
        statuses = {account.overall_status for account in accounts}
        overall = "ERROR" if "ERROR" in statuses else "MISMATCH" if "MISMATCH" in statuses else "UNAVAILABLE" if "UNAVAILABLE" in statuses else "MATCHED"
        return ReconciliationSummary(
            checked_at=checked_at, overall_status=overall,
            accounts_checked=len(accounts),
            matched_accounts=sum(a.overall_status == "MATCHED" for a in accounts),
            mismatched_accounts=sum(a.overall_status == "MISMATCH" for a in accounts),
            unavailable_accounts=sum(a.overall_status == "UNAVAILABLE" for a in accounts),
            error_accounts=sum(a.overall_status == "ERROR" for a in accounts),
            cash=cash, positions=positions, orders=orders, accounts=accounts,
        )
