import logging
from typing import Optional, Set
from uuid import UUID
from decimal import Decimal

from app.database.repositories.paper_portfolio_repository import PaperPortfolioRepository
from app.database.models.paper_portfolio import PaperPortfolio, PaperPosition
from app.exceptions.paper_accounting_exceptions import (
    InvalidExecutionModeException,
    InvalidPaperFillException,
    PaperPortfolioNotFoundException,
    InsufficientPaperPositionException,
    InsufficientPaperCashException,
    DuplicatePaperExecutionException,
)

logger = logging.getLogger(__name__)

PRECISION_FOUR = Decimal("0.0001")


class PaperAccountingService:
    """
    Server-side Paper Accounting Service.
    Calculates and persists position updates, average entry prices, cost basis,
    cash balance / buying power enforcement, and realized P&L for successful PAPER execution fills
    using strict Decimal precision.
    """

    def __init__(self, repository: PaperPortfolioRepository) -> None:
        self._repository = repository
        self._processed_executions: Set[str] = set()

    def record_fill(
        self,
        user_id: UUID,
        symbol: str,
        side: str,
        quantity: Decimal | float | int | str,
        price: Decimal | float | int | str,
        execution_mode: str = "PAPER",
        paper_portfolio_id: Optional[UUID] = None,
        strategy_instance_id: Optional[UUID] = None,
        execution_id: Optional[str] = None,
    ) -> PaperPosition:
        """
        Records a successful PAPER order execution fill into server-side paper position accounting.

        - Enforces strict PAPER execution mode isolation.
        - Validates positive fill quantity and non-negative price.
        - Enforces Buying Power / Available Cash validation for BUY orders.
        - Deducts cash balance on BUY, adds proceeds on SELL.
        - Locks portfolio & position rows in PostgreSQL using FOR UPDATE to prevent concurrency race conditions.
        - Calculates average entry price and cost basis for BUY/Additional BUY.
        - Calculates realized P&L for Partial/Full SELL.
        - Atomic transaction rollback on failure.
        """
        # 1. Mode Safety Isolation Guard
        if str(execution_mode).upper() != "PAPER":
            raise InvalidExecutionModeException(
                f"PaperAccountingService strictly processes PAPER executions. Rejecting mode: {execution_mode}"
            )

        # 2. Duplicate Fill Guard
        if execution_id and execution_id in self._processed_executions:
            raise DuplicatePaperExecutionException(
                f"Paper execution fill '{execution_id}' has already been processed."
            )

        # 3. Financial Precision Conversion & Fill Parameter Validation
        try:
            qty = Decimal(str(quantity))
            px = Decimal(str(price))
        except Exception as e:
            raise InvalidPaperFillException(f"Invalid decimal value for fill parameters: {e}")

        if qty <= Decimal("0"):
            raise InvalidPaperFillException("Execution quantity must be strictly greater than zero.")
        if px < Decimal("0"):
            raise InvalidPaperFillException("Execution price cannot be negative.")

        normalized_side = str(side).upper()
        if normalized_side not in ("BUY", "SELL"):
            raise InvalidPaperFillException(f"Unsupported order side: {side}")

        symbol_upper = str(symbol).upper()

        # 4. Resolve & Lock Paper Portfolio
        if paper_portfolio_id:
            portfolio = self._repository.get_portfolio_by_id(paper_portfolio_id, user_id)
            if not portfolio:
                raise PaperPortfolioNotFoundException(
                    f"Paper portfolio {paper_portfolio_id} not found for user {user_id}"
                )
            if portfolio.execution_mode.upper() != "PAPER":
                raise InvalidExecutionModeException(
                    f"Portfolio {paper_portfolio_id} execution mode is {portfolio.execution_mode}, expected PAPER."
                )
        else:
            portfolio = self._repository.get_or_create_default_portfolio(
                user_id=user_id, strategy_instance_id=strategy_instance_id
            )

        # Row-level Lock on Portfolio to prevent cash balance race condition
        locked_portfolio = self._repository.lock_portfolio_for_update(portfolio.id)
        if locked_portfolio:
            portfolio = locked_portfolio

        # 5. Row-level Lock on Position
        position = self._repository.lock_position_for_update(portfolio.id, symbol_upper)
        if not position:
            position = PaperPosition(
                paper_portfolio_id=portfolio.id,
                user_id=user_id,
                strategy_instance_id=strategy_instance_id or portfolio.strategy_instance_id,
                symbol=symbol_upper,
                quantity=Decimal("0.0000"),
                average_price=Decimal("0.0000"),
                cost_basis=Decimal("0.0000"),
                realized_pnl=Decimal("0.0000"),
                unrealized_pnl=Decimal("0.0000"),
            )

        try:
            order_cost = (qty * px).quantize(PRECISION_FOUR)

            # 6. Apply Accounting Logic & Cash / Buying Power Enforcement
            if normalized_side == "BUY":
                # Check Available Cash / Buying Power
                if portfolio.cash_balance < order_cost:
                    raise InsufficientPaperCashException(
                        f"Insufficient paper cash balance ({portfolio.cash_balance}) for required order funds ({order_cost})."
                    )

                # Deduct Cash Balance
                portfolio.cash_balance = (portfolio.cash_balance - order_cost).quantize(PRECISION_FOUR)

                if position.quantity == Decimal("0"):
                    # First BUY / New position after flat
                    position.quantity = qty.quantize(PRECISION_FOUR)
                    position.average_price = px.quantize(PRECISION_FOUR)
                    position.cost_basis = order_cost
                else:
                    # Additional BUY (Average cost expansion)
                    old_qty = position.quantity
                    old_avg = position.average_price
                    total_cost = (old_qty * old_avg) + order_cost
                    new_qty = old_qty + qty
                    new_avg = total_cost / new_qty

                    position.quantity = new_qty.quantize(PRECISION_FOUR)
                    position.average_price = new_avg.quantize(PRECISION_FOUR)
                    position.cost_basis = total_cost.quantize(PRECISION_FOUR)

            elif normalized_side == "SELL":
                if qty > position.quantity:
                    raise InsufficientPaperPositionException(
                        f"Cannot sell quantity {qty} which exceeds open paper position quantity {position.quantity}."
                    )

                # Add Sale Proceeds to Cash Balance
                proceeds = (qty * px).quantize(PRECISION_FOUR)
                portfolio.cash_balance = (portfolio.cash_balance + proceeds).quantize(PRECISION_FOUR)

                # Calculate Trade Realized P&L
                trade_realized_pnl = (px - position.average_price) * qty
                position.realized_pnl = (position.realized_pnl + trade_realized_pnl).quantize(PRECISION_FOUR)
                portfolio.realized_pnl = (portfolio.realized_pnl + trade_realized_pnl).quantize(PRECISION_FOUR)

                new_qty = position.quantity - qty
                if new_qty > Decimal("0"):
                    # Partial SELL
                    position.quantity = new_qty.quantize(PRECISION_FOUR)
                    position.cost_basis = (new_qty * position.average_price).quantize(PRECISION_FOUR)
                else:
                    # Full SELL / Position Flat
                    position.quantity = Decimal("0.0000")
                    position.average_price = Decimal("0.0000")
                    position.cost_basis = Decimal("0.0000")

            # 7. Atomically Persist Updates
            self._repository.save_position(position)
            self._repository.db.add(portfolio)
            self._repository.db.commit()
            self._repository.db.refresh(position)
            self._repository.db.refresh(portfolio)

            if execution_id:
                self._processed_executions.add(execution_id)

            logger.info(
                f"Paper fill accounted successfully: user={user_id}, symbol={symbol_upper}, side={normalized_side}, "
                f"qty={qty}, price={px}, cash_balance={portfolio.cash_balance}, new_qty={position.quantity}, "
                f"avg_price={position.average_price}, cost_basis={position.cost_basis}, realized_pnl={position.realized_pnl}"
            )
            return position

        except Exception as e:
            self._repository.db.rollback()
            logger.error(f"Paper accounting transaction failed and rolled back: {e}")
            raise e
