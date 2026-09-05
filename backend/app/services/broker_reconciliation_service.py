"""Background broker reconciliation for restart/failure recovery."""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.database.models.broker_session import BrokerSession
from app.services.broker_order_service import BrokerOrderService
from app.dependencies.broker import build_runtime_broker_order_service
from app.core.config.settings import settings
from app.core.logging.trading_audit import audit_event

logger = logging.getLogger(__name__)

class BrokerReconciliationService:
    """Periodically reconciles every active broker session into the application ledger."""

    def __init__(self, interval_seconds: float = 30.0) -> None:
        self.interval_seconds = max(5.0, interval_seconds)
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._last_run: Optional[datetime] = None

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop(), name="broker-reconciliation")
        logger.info("Broker reconciliation service started (interval=%.1fs)", self.interval_seconds)

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _loop(self) -> None:
        # Run immediately on startup so a process restart reconciles outstanding orders.
        while self._running:
            await asyncio.to_thread(self.run_once)
            try:
                await asyncio.sleep(self.interval_seconds)
            except asyncio.CancelledError:
                break

    def run_once(self) -> int:
        db = SessionLocal()
        count = 0
        try:
            sessions = (
                db.query(BrokerSession)
                .filter(BrokerSession.expires_at > datetime.now(timezone.utc))
                .all()
            )
            for session in sessions:
                try:
                    service = build_runtime_broker_order_service(db)
                    orders = service.reconcile_orders(
                        user_id=session.user_id,
                        broker_id=session.broker_id,
                    )
                    count += len(orders)
                except Exception as exc:
                    db.rollback()
                    audit_event(
                        "BROKER_RECONCILIATION",
                        user_id=session.user_id,
                        broker_id=session.broker_id,
                        outcome="FAILED",
                        error=str(exc),
                    )
                    logger.warning(
                        "Broker reconciliation failed for user=%s broker=%s: %s",
                        session.user_id, session.broker_id, exc,
                    )
            self._last_run = datetime.now(timezone.utc)
            return count
        finally:
            db.close()
