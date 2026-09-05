import logging
from typing import Optional, Set
from uuid import UUID
from decimal import Decimal
from app.services.transaction_cost_service import TransactionCostService

from app.database.repositories.paper_portfolio_repository import PaperPortfolioRepository
from app.database.models.paper_portfolio import PaperPortfolio, PaperPosition
from app.services.execution_position_service import ExecutionPositionService
from app.services.event_bus.trading_events import TradingEventPublisher
from app.services.event_bus.models import EventType
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
    cash balance / buying power enforcement, slippage simulation, transaction costs & taxes (STT, GST, SEBI, Stamp Duty, Brokerage),
    and net realized P&L for successful PAPER execution fills using strict Decimal precision.
    """

    def __init__(self, repository: PaperPortfolioRepository, execution_position_service: Optional[ExecutionPositionService] = None, trading_event_publisher: Optional[TradingEventPublisher] = None) -> None:
        self._repository = repository
        self._execution_position_service = execution_position_service
        self._trading_event_publisher = trading_event_publisher
        self._processed_executions: Set[str] = set()

    def get_risk_snapshot(self, user_id: UUID, strategy_instance_id: Optional[UUID] = None) -> tuple[list[dict], Decimal]:
        """Return authoritative PAPER positions and current cost exposure across all user strategies for portfolio-wide risk checks."""
        portfolio = self._repository.get_or_create_default_portfolio(
            user_id=user_id, strategy_instance_id=strategy_instance_id
        )
        positions = []
        if hasattr(self._repository, "get_all_positions_for_user"):
            try:
                user_pos = self._repository.get_all_positions_for_user(user_id)
                if isinstance(user_pos, list) and user_pos:
                    positions = user_pos
            except Exception:
                positions = []

        if not positions and portfolio:
            positions = self._repository.get_all_positions_for_portfolio(portfolio.id, user_id)

        if not isinstance(positions, list):
            positions = []

        snapshot = []
        exposure = Decimal("0")
        for position in positions:
            qty = Decimal(str(getattr(position, "quantity", 0)))
            avg = Decimal(str(getattr(position, "average_price", 0)))
            snapshot.append({
                "symbol": getattr(position, "symbol", ""),
                "quantity": str(qty),
                "avg_price": str(avg),
            })
            exposure += abs(qty * avg)
        return snapshot, exposure

    def record_fill(
        self,
        user_id: UUID,
        symbol: str,
        side: str,
        quantity: Decimal | float | int | str,
        price: Decimal | float | int | str,
        broker_id: Optional[UUID] = None,
        execution_mode: str = "PAPER",
        paper_portfolio_id: Optional[UUID] = None,
        strategy_instance_id: Optional[UUID] = None,
        signal_id: Optional[UUID] = None,
        execution_id: Optional[str] = None,
        product: str = "CNC",
        apply_slippage: bool = False,
        volatility_pct: Optional[Decimal] = None,
        apply_transaction_costs: bool = False,
    ) -> PaperPosition:
        """
        Records a successful PAPER order execution fill into server-side paper position accounting.

        - Enforces strict PAPER execution mode isolation.
        - Validates positive fill quantity and non-negative price.
        - Applies realistic market slippage simulation (0.05% - 0.10%).
        - Applies Indian Regulatory Taxes & Brokerage (STT, Stamp Duty, Exchange Charges, SEBI, GST).
        - Enforces Buying Power / Available Cash validation for BUY orders.
        - Deducts cash balance on BUY, adds net proceeds on SELL.
        - Locks portfolio & position rows in PostgreSQL using FOR UPDATE to prevent concurrency race conditions.
        - Calculates average entry price and cost basis for BUY/Additional BUY.
        - Calculates net realized P&L for Partial/Full SELL.
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
        if execution_id and self._execution_position_service and self._execution_position_service._executions.get_by_external_id("PAPER", broker_id, execution_id):
            raise DuplicatePaperExecutionException(
                f"Paper execution fill '{execution_id}' already exists in the execution ledger."
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
                user_id=user_id, strategy_instance_id=None
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
            # Apply Slippage Simulation if requested
            if apply_slippage:
                px, _, _ = TransactionCostService.calculate_slippage(
                    price=px, side=normalized_side, volatility_pct=volatility_pct
                )

            order_cost = (qty * px).quantize(PRECISION_FOUR)
            charges = Decimal("0.00")
            if apply_transaction_costs:
                cost_breakdown = TransactionCostService.calculate_transaction_costs(
                    traded_value=order_cost, side=normalized_side, product=product
                )
                charges = Decimal(str(cost_breakdown["total_charges"]))

            # 6. Apply Accounting Logic & Cash / Buying Power Enforcement
            if normalized_side == "BUY":
                total_required = order_cost + charges
                # Check Available Cash / Buying Power
                if portfolio.cash_balance < total_required:
                    raise InsufficientPaperCashException(
                        f"Insufficient paper cash balance ({portfolio.cash_balance}) for required order funds ({total_required})."
                    )

                # Deduct Cash Balance
                portfolio.cash_balance = (portfolio.cash_balance - total_required).quantize(PRECISION_FOUR)

                if position.quantity == Decimal("0"):
                    # First BUY / New position after flat
                    position.quantity = qty.quantize(PRECISION_FOUR)
                    position.average_price = px.quantize(PRECISION_FOUR)
                    position.cost_basis = total_required
                else:
                    # Additional BUY (Average cost expansion)
                    old_qty = position.quantity
                    old_avg = position.average_price
                    total_cost = (old_qty * old_avg) + total_required
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

                # Add Net Sale Proceeds to Cash Balance
                net_proceeds = (order_cost - charges).quantize(PRECISION_FOUR)
                portfolio.cash_balance = (portfolio.cash_balance + net_proceeds).quantize(PRECISION_FOUR)

                # Calculate Net Trade Realized P&L (gross pnl minus exit charges)
                trade_realized_pnl = ((px - position.average_price) * qty - charges).quantize(PRECISION_FOUR)
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
                    position.unrealized_pnl = Decimal("0.0000")
                    position.market_value = Decimal("0.0000")

            # 7. Atomically Persist Position + PAPER Execution Ledger
            self._repository.save_position(position)
            self._repository.db.add(portfolio)
            if execution_id and self._execution_position_service:
                self._execution_position_service.stage_paper_execution(
                    user_id=user_id,
                    broker_id=broker_id,
                    paper_order_id=execution_id,
                    strategy_instance_id=strategy_instance_id,
                    signal_id=signal_id,
                    symbol=symbol_upper,
                    side=normalized_side,
                    quantity=qty,
                    price=px,
                )
            self._repository.db.commit()
            self._repository.db.refresh(position)
            self._repository.db.refresh(portfolio)

            if execution_id:
                self._processed_executions.add(execution_id)

            if self._trading_event_publisher:
                execution = None
                if execution_id and self._execution_position_service:
                    execution = self._execution_position_service._executions.get_by_external_id("PAPER", broker_id, execution_id)
                if execution:
                    self._trading_event_publisher.emit(
                        EventType.EXECUTION_CREATED, user_id=user_id, symbol=symbol_upper, execution_mode="PAPER",
                        strategy_instance_id=strategy_instance_id,
                        payload={"execution_id": execution.id, "order_id": execution_id, "quantity": qty, "price": px, "side": normalized_side},
                    )
                self._trading_event_publisher.emit(
                    EventType.POSITION_UPDATED, user_id=user_id, symbol=symbol_upper, execution_mode="PAPER",
                    strategy_instance_id=position.strategy_instance_id,
                    payload={"position_id": position.id, "quantity": position.quantity, "average_price": position.average_price, "realized_pnl": position.realized_pnl},
                )

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
