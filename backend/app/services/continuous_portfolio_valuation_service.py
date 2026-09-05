import asyncio
import logging
from typing import Callable, Dict, Optional, Set

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.database.models.paper_portfolio import PaperPosition
from app.database.models.trading_execution import TradingPosition
from app.database.repositories.paper_portfolio_repository import PaperPortfolioRepository
from app.services.event_bus.bus import EventBus
from app.services.event_bus.models import Event, EventType
from app.services.event_bus.topics import Topic
from app.services.portfolio_valuation_service import PortfolioValuationService

logger = logging.getLogger(__name__)


class ContinuousPortfolioValuationService:
    """Revalues application-owned portfolios from validated market quote events."""

    def __init__(self, event_bus: EventBus, valuation_factory: Callable[[Session], PortfolioValuationService], refresh_interval_seconds: float = 30.0) -> None:
        self._event_bus = event_bus
        self._valuation_factory = valuation_factory
        self.refresh_interval_seconds = refresh_interval_seconds
        self._running = False
        self._refresh_task: Optional[asyncio.Task] = None
        self._subscriber_tasks: Dict[str, asyncio.Task] = {}
        self._subscribers: Dict[str, object] = {}
        self._lock = asyncio.Lock()
        self._quote_semaphore = asyncio.Semaphore(5)

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        await self._refresh_subscriptions()
        self._refresh_task = asyncio.create_task(self._refresh_loop())
        logger.info("Continuous portfolio valuation started")

    async def stop(self) -> None:
        self._running = False
        if self._refresh_task:
            self._refresh_task.cancel()
            try:
                await self._refresh_task
            except asyncio.CancelledError:
                pass
            self._refresh_task = None
        for subscriber in list(self._subscribers.values()):
            try:
                await subscriber.close()
            except Exception:
                logger.exception("Failed closing valuation subscriber")
        for task in list(self._subscriber_tasks.values()):
            task.cancel()
        self._subscribers.clear()
        self._subscriber_tasks.clear()
        logger.info("Continuous portfolio valuation stopped")

    async def _refresh_loop(self) -> None:
        while self._running:
            try:
                await asyncio.sleep(self.refresh_interval_seconds)
                await self._refresh_subscriptions()
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Portfolio valuation subscription refresh failed")

    def _symbols(self) -> Set[str]:
        db = SessionLocal()
        try:
            live = db.execute(select(TradingPosition.symbol).where(TradingPosition.quantity != 0)).scalars().all()
            paper = db.execute(select(PaperPosition.symbol).where(PaperPosition.quantity != 0)).scalars().all()
            return {str(symbol).upper() for symbol in [*live, *paper] if symbol}
        finally:
            db.close()

    async def _refresh_subscriptions(self) -> None:
        desired = {Topic.market(symbol) for symbol in self._symbols()}
        async with self._lock:
            for topic in desired - set(self._subscribers):
                subscriber = await self._event_bus.subscribe(topic)
                self._subscribers[topic] = subscriber
                self._subscriber_tasks[topic] = asyncio.create_task(self._consume(topic, subscriber))
            for topic in set(self._subscribers) - desired:
                subscriber = self._subscribers.pop(topic)
                task = self._subscriber_tasks.pop(topic, None)
                if task:
                    task.cancel()
                await subscriber.close()

    async def _consume(self, topic: str, subscriber: object) -> None:
        try:
            while self._running:
                event = await subscriber.consume()
                if event.event_type != EventType.QUOTE_UPDATED or not event.broker_id:
                    continue
                async with self._quote_semaphore:
                    await asyncio.to_thread(self._handle_quote, event)
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("Valuation event consumer stopped for %s", topic)

    def _handle_quote(self, event: Event) -> None:
        db = SessionLocal()
        try:
            valuation = self._valuation_factory(db)
            from app.brokers.base.broker_types import BrokerQuote
            from app.services.market_data_sanitizer import MarketDataSanitizer
            payload = event.payload
            symbol = str(event.symbol or (payload.get("symbol") if isinstance(payload, dict) else "") or "")
            paper_repo = PaperPortfolioRepository(db)
            fallback_price = None
            try:
                for portfolio in paper_repo.get_all_portfolios_for_user(event.user_id):
                    for position in paper_repo.get_all_positions_for_portfolio(portfolio.id, event.user_id):
                        if str(position.symbol).upper() == symbol.upper() and position.average_price > Decimal("0"):
                            fallback_price = float(position.average_price)
                            break
                    if fallback_price:
                        break
            except Exception:
                pass

            sanitized = MarketDataSanitizer.sanitize_tick(payload, symbol=symbol, fallback_price=fallback_price)
            if sanitized.get("is_outlier"):
                logger.warning("Valuation discarded outlier tick for symbol=%s (raw_price=%s)", symbol, sanitized.get("raw_outlier_price"))
                return

            quote = BrokerQuote(
                symbol=symbol,
                bid=sanitized.get("bid") or sanitized.get("last_price") or sanitized.get("price"),
                ask=sanitized.get("ask") or sanitized.get("last_price") or sanitized.get("price"),
                last_price=sanitized.get("last_price") or sanitized.get("price"),
            )
            valuation.revalue_live_from_quote(event.user_id, event.broker_id, quote)

            for portfolio in paper_repo.get_all_portfolios_for_user(event.user_id):
                if str(portfolio.execution_mode).upper() != "PAPER":
                    continue
                positions = paper_repo.get_all_positions_for_portfolio(portfolio.id, event.user_id)
                if any(str(position.symbol).upper() == quote.symbol.upper() and str(position.quantity) != "0" for position in positions):
                    valuation.revalue_paper_from_quote(event.user_id, portfolio.id, event.broker_id, quote)
        except Exception:
            db.rollback()
            logger.exception("Continuous valuation failed for user=%s symbol=%s", event.user_id, event.symbol)
        finally:
            db.close()
