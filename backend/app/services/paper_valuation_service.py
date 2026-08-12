import logging
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from app.database.repositories.paper_portfolio_repository import PaperPortfolioRepository
from app.database.models.paper_portfolio import PaperPosition
from app.brokers.base.broker_types import BrokerQuote
from app.exceptions.paper_accounting_exceptions import (
    InvalidExecutionModeException,
    PaperPortfolioNotFoundException,
    PaperPositionNotFoundException,
    StaleQuoteDataException,
    InvalidQuoteException,
)

logger = logging.getLogger(__name__)

PRECISION_FOUR = Decimal("0.0001")


class PaperValuationService:
    """
    Server-side Paper Position Valuation Service.
    Calculates current market price valuation and unrealized P&L for open PaperPositions
    using fresh, validated market quotes and strict Decimal precision arithmetic.
    """

    def __init__(
        self,
        repository: PaperPortfolioRepository,
        max_quote_age_seconds: int = 10,
    ) -> None:
        self._repository = repository
        self.max_quote_age_seconds = max_quote_age_seconds

    def _validate_quote_timestamp(self, quote_data: Dict[str, Any] | BrokerQuote) -> datetime:
        """Validates market quote timestamp staleness (Fail-Closed)."""
        raw_ts = None
        if isinstance(quote_data, dict):
            raw_ts = quote_data.get("timestamp") or quote_data.get("generatedAt") or quote_data.get("time")
        elif hasattr(quote_data, "timestamp"):
            raw_ts = getattr(quote_data, "timestamp")

        if not raw_ts:
            raise StaleQuoteDataException("Market quote missing a valid timestamp (Fail-Closed).")

        try:
            if isinstance(raw_ts, (int, float)):
                ts_dt = datetime.fromtimestamp(raw_ts, tz=timezone.utc)
            elif isinstance(raw_ts, str):
                ts_dt = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
            elif isinstance(raw_ts, datetime):
                ts_dt = raw_ts.astimezone(timezone.utc) if raw_ts.tzinfo else raw_ts.replace(tzinfo=timezone.utc)
            else:
                raise ValueError(f"Unsupported timestamp type: {type(raw_ts)}")
        except Exception as e:
            raise StaleQuoteDataException(f"Invalid market quote timestamp format: {e}")

        now = datetime.now(timezone.utc)
        age = (now - ts_dt).total_seconds()
        if age > self.max_quote_age_seconds:
            raise StaleQuoteDataException(
                f"Market quote is stale ({age:.1f}s old, max allowed {self.max_quote_age_seconds}s)."
            )

        if (ts_dt - now).total_seconds() > 1.0:
            raise StaleQuoteDataException("Market quote timestamp is in the future.")

        return ts_dt

    def _validate_quote_price(self, quote_data: Dict[str, Any] | BrokerQuote) -> Decimal:
        """Extracts and validates quote price using strict Decimal conversion (Fail-Closed)."""
        raw_price = None
        if isinstance(quote_data, dict):
            raw_price = quote_data.get("last_price") or quote_data.get("price") or quote_data.get("lastPrice")
        elif isinstance(quote_data, BrokerQuote):
            raw_price = quote_data.last_price
        elif hasattr(quote_data, "last_price"):
            raw_price = getattr(quote_data, "last_price")
        elif hasattr(quote_data, "price"):
            raw_price = getattr(quote_data, "price")

        if raw_price is None:
            raise InvalidQuoteException("Market quote missing last_price.")

        try:
            price_decimal = Decimal(str(raw_price))
        except (InvalidOperation, TypeError, ValueError) as e:
            raise InvalidQuoteException(f"Invalid Decimal price format: {e}")

        if price_decimal.is_nan() or price_decimal.is_infinite():
            raise InvalidQuoteException("Market quote price cannot be NaN or Infinity.")

        if price_decimal <= Decimal("0"):
            raise InvalidQuoteException(f"Market quote price must be strictly positive, got {price_decimal}.")

        return price_decimal

    def value_position(
        self,
        user_id: UUID,
        paper_portfolio_id: UUID,
        symbol: str,
        quote: Dict[str, Any] | BrokerQuote,
        execution_mode: str = "PAPER",
    ) -> PaperPosition:
        """
        Calculates and persists unrealized P&L for a single PaperPosition based on validated market quote.
        """
        # 1. Execution Mode Guard
        if str(execution_mode).upper() != "PAPER":
            raise InvalidExecutionModeException(
                f"PaperValuationService strictly processes PAPER position valuation. Rejecting mode: {execution_mode}"
            )

        # 2. Portfolio Ownership Guard
        portfolio = self._repository.get_portfolio_by_id(paper_portfolio_id, user_id)
        if not portfolio:
            raise PaperPortfolioNotFoundException(
                f"Paper portfolio {paper_portfolio_id} not found for user {user_id}"
            )
        if portfolio.execution_mode.upper() != "PAPER":
            raise InvalidExecutionModeException(
                f"Portfolio {paper_portfolio_id} execution mode is {portfolio.execution_mode}, expected PAPER."
            )

        # 3. Position Row Locking
        symbol_upper = str(symbol).upper()
        position = self._repository.lock_position_for_update(paper_portfolio_id, symbol_upper)
        if not position:
            raise PaperPositionNotFoundException(
                f"Paper position for {symbol_upper} not found in portfolio {paper_portfolio_id}"
            )

        # 4. Stale Data Guard & Price Validation
        quote_ts = self._validate_quote_timestamp(quote)
        last_price = self._validate_quote_price(quote)

        try:
            # 5. Calculate Unrealized P&L
            if position.quantity == Decimal("0.0000"):
                # Closed position
                position.unrealized_pnl = Decimal("0.0000")
            else:
                # Open position (Long)
                unrealized = (last_price - position.average_price) * position.quantity
                position.unrealized_pnl = unrealized.quantize(PRECISION_FOUR)

            # 6. Save & Commit (Realized P&L remains UNTOUCHED)
            self._repository.save_position(position)
            self._repository.db.commit()
            self._repository.db.refresh(position)

            logger.info(
                f"Paper position valued: user={user_id}, symbol={symbol_upper}, last_price={last_price}, "
                f"qty={position.quantity}, avg_price={position.average_price}, "
                f"unrealized_pnl={position.unrealized_pnl}, realized_pnl={position.realized_pnl}, quote_ts={quote_ts}"
            )
            return position

        except Exception as e:
            self._repository.db.rollback()
            logger.error(f"Paper position valuation failed and rolled back: {e}")
            raise e

    def value_portfolio_positions(
        self,
        user_id: UUID,
        paper_portfolio_id: UUID,
        quotes_by_symbol: Dict[str, Dict[str, Any] | BrokerQuote],
        execution_mode: str = "PAPER",
    ) -> List[PaperPosition]:
        """
        Calculates and updates unrealized P&L for all positions in a paper portfolio.
        Skips positions that lack a valid quote without altering their state (Fail-Closed).
        """
        if str(execution_mode).upper() != "PAPER":
            raise InvalidExecutionModeException("PaperValuationService strictly processes PAPER valuation.")

        positions = self._repository.get_all_positions_for_portfolio(paper_portfolio_id, user_id)
        updated_positions: List[PaperPosition] = []

        for pos in positions:
            quote = quotes_by_symbol.get(pos.symbol) or quotes_by_symbol.get(pos.symbol.upper())
            if not quote:
                logger.warning(f"No quote provided for position {pos.symbol} in portfolio {paper_portfolio_id}. Skipping valuation.")
                continue

            try:
                valued_pos = self.value_position(
                    user_id=user_id,
                    paper_portfolio_id=paper_portfolio_id,
                    symbol=pos.symbol,
                    quote=quote,
                    execution_mode="PAPER",
                )
                updated_positions.append(valued_pos)
            except Exception as e:
                logger.error(f"Error valuing position {pos.symbol}: {e}")
                # Fail-Closed per symbol without breaking other symbols

        return updated_positions
