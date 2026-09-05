import logging
import urllib.request
import json
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Protocol
from uuid import UUID

from app.brokers.base.broker_types import BrokerQuote
from app.database.models.paper_portfolio import PaperPosition
from app.database.models.trading_execution import TradingPosition
from app.database.repositories.paper_portfolio_repository import PaperPortfolioRepository
from app.database.repositories.trading_execution_repository import TradingPositionRepository
from app.services.event_bus.trading_events import TradingEventPublisher
from app.services.event_bus.models import EventType

logger = logging.getLogger(__name__)

MONEY_PRECISION = Decimal("0.0001")

_VALUATION_QUOTE_CACHE: Dict[str, Dict[str, Any]] = {}
SYMBOL_TICKER_MAP: Dict[str, str] = {
    "NIFTY": "^NSEI", "NIFTY50": "^NSEI", "BANKNIFTY": "^NSEBANK", "NIFTYBANK": "^NSEBANK",
    "SENSEX": "^BSESN", "BSESENSEX": "^BSESN", "RELIANCE": "RELIANCE.NS", "HDFCBANK": "HDFCBANK.NS",
    "TCS": "TCS.NS", "INFY": "INFY.NS", "ICICIBANK": "ICICIBANK.NS", "SBIN": "SBIN.NS",
    "LT": "LT.NS", "TATAMOTORS": "TATAMOTORS.NS", "BHARTIARTL": "BHARTIARTL.NS",
}

def get_live_exchange_price(symbol: str) -> Optional[Decimal]:
    """Fetch live market price from exchange feed with 3-second in-memory caching."""
    clean = symbol.upper().replace(" ", "").replace("-", "").replace("_", "")
    now_ts = time.time()
    if clean in _VALUATION_QUOTE_CACHE and (now_ts - _VALUATION_QUOTE_CACHE[clean]["time"]) < 3.0:
        return _VALUATION_QUOTE_CACHE[clean]["price"]

    ticker = SYMBOL_TICKER_MAP.get(clean, f"{clean}.NS")
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=5m&range=1d"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
            meta = raw["chart"]["result"][0]["meta"]
            price_val = float(meta.get("regularMarketPrice", 0))
            if price_val > 0:
                price_dec = Decimal(str(round(price_val, 2)))
                _VALUATION_QUOTE_CACHE[clean] = {"time": now_ts, "price": price_dec}
                return price_dec
    except Exception:
        pass
    return None



@dataclass(frozen=True)
class PortfolioValuation:
    execution_mode: str
    user_id: UUID
    broker_id: Optional[UUID]
    paper_portfolio_id: Optional[UUID]
    cash_balance: Optional[Decimal]
    market_value: Decimal
    realized_pnl: Decimal
    unrealized_pnl: Decimal
    total_pnl: Decimal
    equity: Decimal
    position_count: int
    valued_at: datetime


class MarketQuoteSource(Protocol):
    def get_quotes(self, user_id: UUID, broker_id: UUID, symbols: List[str]) -> List[BrokerQuote]: ...


class PortfolioValuationService:
    """Application-owned valuation for LIVE and PAPER positions.

    Market prices are sourced from the authenticated broker. No frontend price or
    hardcoded/demo price is accepted as an authoritative valuation input.
    """

    def __init__(
        self,
        broker_service: MarketQuoteSource,
        live_position_repository: TradingPositionRepository,
        paper_repository: PaperPortfolioRepository,
        max_quote_age_seconds: int = 10,
        trading_event_publisher: Optional[TradingEventPublisher] = None,
    ) -> None:
        self._broker_service = broker_service
        self._live_positions = live_position_repository
        self._paper = paper_repository
        self.max_quote_age_seconds = max_quote_age_seconds
        self._trading_event_publisher = trading_event_publisher

    @staticmethod
    def _price(quote: BrokerQuote) -> Decimal:
        try:
            price = Decimal(str(quote.last_price))
        except (InvalidOperation, TypeError, ValueError) as exc:
            raise ValueError(f"Invalid market price for {quote.symbol}") from exc
        if not price.is_finite() or price <= 0:
            raise ValueError(f"Market price for {quote.symbol} must be positive and finite")
        return price

    def _quotes(self, user_id: UUID, broker_id: UUID, symbols: List[str]) -> Dict[str, BrokerQuote]:
        if not symbols:
            return {}
        quotes = self._broker_service.get_quotes(user_id, broker_id, sorted(set(symbols)))
        return {str(q.symbol).upper(): q for q in quotes}

    def value_live(self, user_id: UUID, broker_id: UUID) -> PortfolioValuation:
        positions = self._live_positions.list_for_account(user_id, broker_id)
        quotes = self._quotes(user_id, broker_id, [p.symbol for p in positions])
        valued_at = datetime.now(timezone.utc)
        market_value = Decimal("0")
        realized = Decimal("0")
        unrealized = Decimal("0")

        for position in positions:
            quote = quotes.get(position.symbol.upper())
            if quote is None:
                logger.warning("No broker quote available for LIVE position %s; valuation skipped", position.symbol)
                continue
            last_price = self._price(quote)
            qty = Decimal(str(position.quantity))
            avg = Decimal(str(position.average_price))
            position.last_price = last_price
            position.market_value = (qty * last_price).quantize(MONEY_PRECISION)
            position.unrealized_pnl = ((last_price - avg) * qty).quantize(MONEY_PRECISION)
            position.valuation_at = valued_at
            market_value += position.market_value
            realized += Decimal(str(position.realized_pnl))
            unrealized += position.unrealized_pnl

        self._live_positions.db.commit()
        total_pnl = (realized + unrealized).quantize(MONEY_PRECISION)
        result = PortfolioValuation(
            execution_mode="LIVE", user_id=user_id, broker_id=broker_id, paper_portfolio_id=None,
            cash_balance=None, market_value=market_value.quantize(MONEY_PRECISION),
            realized_pnl=realized.quantize(MONEY_PRECISION), unrealized_pnl=unrealized.quantize(MONEY_PRECISION),
            total_pnl=total_pnl, equity=market_value.quantize(MONEY_PRECISION),
            position_count=len(positions), valued_at=valued_at,
        )
        if self._trading_event_publisher:
            self._trading_event_publisher.emit(
                EventType.PORTFOLIO_VALUATION_UPDATED, user_id=user_id, broker_id=broker_id, execution_mode="LIVE",
                payload={"equity": result.equity, "market_value": result.market_value, "realized_pnl": result.realized_pnl, "unrealized_pnl": result.unrealized_pnl, "total_pnl": result.total_pnl, "position_count": result.position_count, "valued_at": result.valued_at},
            )
        return result

    def value_paper(self, user_id: UUID, paper_portfolio_id: UUID, broker_id: UUID) -> PortfolioValuation:
        portfolio = self._paper.get_portfolio_by_id(paper_portfolio_id, user_id)
        if portfolio is None or str(portfolio.execution_mode).upper() != "PAPER":
            raise ValueError("Paper portfolio not found or not in PAPER mode")
        positions = self._paper.get_all_positions_for_portfolio(paper_portfolio_id, user_id)
        
        try:
            quotes = self._quotes(user_id, broker_id, [p.symbol for p in positions if Decimal(str(p.quantity)) > 0])
        except Exception as exc:
            logger.info("Broker live quotes not available for paper valuation (%s); using position book prices.", exc)
            quotes = {}

        valued_at = datetime.now(timezone.utc)
        market_value = Decimal("0")
        unrealized = Decimal("0")

        for position in positions:
            qty = Decimal(str(position.quantity))
            if qty <= 0:
                position.unrealized_pnl = Decimal("0.0000")
                position.market_value = Decimal("0.0000")
                position.last_price = None
                position.valuation_at = valued_at
                continue

            quote = quotes.get(position.symbol.upper())
            if quote is not None:
                last_price = self._price(quote)
            else:
                live_p = get_live_exchange_price(position.symbol)
                if live_p is not None:
                    last_price = live_p
                else:
                    last_price = Decimal(str(position.last_price or position.average_price or "0.0000"))

            avg = Decimal(str(position.average_price))
            position.last_price = last_price
            position.market_value = (qty * last_price).quantize(MONEY_PRECISION)
            position.unrealized_pnl = ((last_price - avg) * qty).quantize(MONEY_PRECISION)
            position.valuation_at = valued_at
            market_value += position.market_value
            unrealized += position.unrealized_pnl

        self._paper.db.commit()
        cash = Decimal(str(portfolio.cash_balance))
        realized = Decimal(str(portfolio.realized_pnl))
        total_pnl = (realized + unrealized).quantize(MONEY_PRECISION)
        equity = (cash + market_value).quantize(MONEY_PRECISION)
        result = PortfolioValuation(
            execution_mode="PAPER", user_id=user_id, broker_id=broker_id, paper_portfolio_id=paper_portfolio_id,
            cash_balance=cash, market_value=market_value.quantize(MONEY_PRECISION),
            realized_pnl=realized.quantize(MONEY_PRECISION), unrealized_pnl=unrealized.quantize(MONEY_PRECISION),
            total_pnl=total_pnl, equity=equity, position_count=len([p for p in positions if Decimal(str(p.quantity)) > 0]),
            valued_at=valued_at,
        )
        if self._trading_event_publisher:
            self._trading_event_publisher.emit(
                EventType.PORTFOLIO_VALUATION_UPDATED, user_id=user_id, broker_id=broker_id, execution_mode="PAPER",
                payload={"paper_portfolio_id": paper_portfolio_id, "cash_balance": result.cash_balance, "equity": result.equity, "market_value": result.market_value, "realized_pnl": result.realized_pnl, "unrealized_pnl": result.unrealized_pnl, "total_pnl": result.total_pnl, "position_count": result.position_count, "valued_at": result.valued_at},
            )
        return result
    def revalue_live_from_quote(self, user_id: UUID, broker_id: UUID, quote: BrokerQuote) -> PortfolioValuation:
        """Revalue LIVE positions from an already validated quote event."""
        positions = self._live_positions.list_for_account(user_id, broker_id)
        symbol = str(quote.symbol).upper()
        valued_at = datetime.now(timezone.utc)
        last_price = self._price(quote)
        market_value = Decimal("0")
        realized = Decimal("0")
        unrealized = Decimal("0")
        for position in positions:
            qty = Decimal(str(position.quantity))
            if position.symbol.upper() == symbol:
                position.last_price = last_price
                position.market_value = (qty * last_price).quantize(MONEY_PRECISION)
                position.unrealized_pnl = ((last_price - Decimal(str(position.average_price))) * qty).quantize(MONEY_PRECISION)
                position.valuation_at = valued_at
            market_value += Decimal(str(position.market_value or 0))
            realized += Decimal(str(position.realized_pnl))
            unrealized += Decimal(str(position.unrealized_pnl))
        self._live_positions.db.commit()
        result = PortfolioValuation(
            execution_mode="LIVE", user_id=user_id, broker_id=broker_id, paper_portfolio_id=None,
            cash_balance=None, market_value=market_value.quantize(MONEY_PRECISION),
            realized_pnl=realized.quantize(MONEY_PRECISION), unrealized_pnl=unrealized.quantize(MONEY_PRECISION),
            total_pnl=(realized + unrealized).quantize(MONEY_PRECISION),
            equity=market_value.quantize(MONEY_PRECISION),
            position_count=sum(1 for p in positions if Decimal(str(p.quantity)) != 0), valued_at=valued_at,
        )
        self._emit_quote_valuation(result, user_id, broker_id, symbol, "LIVE")
        return result

    def revalue_paper_from_quote(self, user_id: UUID, paper_portfolio_id: UUID, broker_id: UUID, quote: BrokerQuote) -> PortfolioValuation:
        """Revalue one PAPER portfolio from an already validated quote event."""
        portfolio = self._paper.get_portfolio_by_id(paper_portfolio_id, user_id)
        if portfolio is None or str(portfolio.execution_mode).upper() != "PAPER":
            raise ValueError("Paper portfolio not found or not in PAPER mode")
        positions = self._paper.get_all_positions_for_portfolio(paper_portfolio_id, user_id)
        symbol = str(quote.symbol).upper()
        valued_at = datetime.now(timezone.utc)
        last_price = self._price(quote)
        market_value = Decimal("0")
        unrealized = Decimal("0")
        for position in positions:
            qty = Decimal(str(position.quantity))
            if qty <= 0:
                position.market_value = Decimal("0.0000")
                position.unrealized_pnl = Decimal("0.0000")
                continue
            if position.symbol.upper() == symbol:
                avg_px = Decimal(str(position.average_price or 0))
                if avg_px > Decimal("0"):
                    dev = abs(last_price - avg_px) / avg_px
                    if dev > Decimal("0.35"):
                        logger.warning("Valuation discarded outlier price %s for %s (avg %s)", last_price, symbol, avg_px)
                        market_value += Decimal(str(position.market_value or 0))
                        unrealized += Decimal(str(position.unrealized_pnl or 0))
                        continue
                position.last_price = last_price
                position.market_value = (qty * last_price).quantize(MONEY_PRECISION)
                position.unrealized_pnl = ((last_price - Decimal(str(position.average_price))) * qty).quantize(MONEY_PRECISION)
                position.valuation_at = valued_at
            market_value += Decimal(str(position.market_value or 0))
            unrealized += Decimal(str(position.unrealized_pnl))
        self._paper.db.commit()
        cash = Decimal(str(portfolio.cash_balance))
        realized = Decimal(str(portfolio.realized_pnl))
        result = PortfolioValuation(
            execution_mode="PAPER", user_id=user_id, broker_id=broker_id, paper_portfolio_id=paper_portfolio_id,
            cash_balance=cash, market_value=market_value.quantize(MONEY_PRECISION),
            realized_pnl=realized.quantize(MONEY_PRECISION), unrealized_pnl=unrealized.quantize(MONEY_PRECISION),
            total_pnl=(realized + unrealized).quantize(MONEY_PRECISION), equity=(cash + market_value).quantize(MONEY_PRECISION),
            position_count=sum(1 for p in positions if Decimal(str(p.quantity)) > 0), valued_at=valued_at,
        )
        self._emit_quote_valuation(result, user_id, broker_id, symbol, "PAPER")
        return result

    def _emit_quote_valuation(self, result: PortfolioValuation, user_id: UUID, broker_id: UUID, symbol: str, mode: str) -> None:
        if not self._trading_event_publisher:
            return
        self._trading_event_publisher.emit(
            EventType.PORTFOLIO_VALUATION_UPDATED,
            user_id=user_id, broker_id=broker_id, symbol=symbol, execution_mode=mode,
            payload={
                "paper_portfolio_id": result.paper_portfolio_id,
                "cash_balance": result.cash_balance,
                "equity": result.equity,
                "market_value": result.market_value,
                "realized_pnl": result.realized_pnl,
                "unrealized_pnl": result.unrealized_pnl,
                "total_pnl": result.total_pnl,
                "position_count": result.position_count,
                "valued_at": result.valued_at,
                "trigger": "market_quote",
            },
        )

