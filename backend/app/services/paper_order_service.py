from decimal import Decimal
from uuid import UUID, uuid4

from app.brokers.base.broker_types import BrokerOrderRequest
from app.core.logging.trading_audit import audit_event
from app.database.repositories.paper_portfolio_repository import PaperPortfolioRepository
from app.database.repositories.trading_execution_repository import TradingExecutionRepository
from app.services.event_bus.models import EventType
from app.services.event_bus.trading_events import TradingEventPublisher
from app.services.paper_accounting_service import PaperAccountingService
from app.services.risk_engine import RiskEngine
from app.services.trading_safety_service import TradingSafetyService
from app.schemas.paper_order import PaperOrderCreateRequest, PaperOrderResponse
from app.exceptions.strategy_exceptions import ExecutionPolicyViolationException


class PaperOrderService:
    """Server-authoritative PAPER order orchestration.

    A PAPER order is validated by the same server-side risk/safety boundary used
    by strategy execution, then immediately filled into the persistent paper
    accounting/execution ledger. No broker order API is called.
    """

    def __init__(
        self,
        paper_repository: PaperPortfolioRepository,
        execution_repository: TradingExecutionRepository,
        accounting_service: PaperAccountingService,
        risk_engine: RiskEngine,
        safety_service: TradingSafetyService,
        trading_events: TradingEventPublisher,
    ) -> None:
        self._paper = paper_repository
        self._executions = execution_repository
        self._accounting = accounting_service
        self._risk = risk_engine
        self._safety = safety_service
        self._events = trading_events

    def create_order(self, *, user_id: UUID, payload: PaperOrderCreateRequest) -> PaperOrderResponse:
        mode = self._safety.validate_mode("PAPER")
        self._safety.validate_paper_execution()

        # 1. Market Hours Timing Validation (NSE 09:15 AM - 03:15 PM IST)
        from app.services.market_timing_guard import MarketTimingGuard
        if payload.side.upper() == "BUY":
            is_open, reason = MarketTimingGuard.is_market_open_for_new_orders()
            if not is_open:
                raise ExecutionPolicyViolationException(f"Trading blocked: {reason}")
        else:
            is_open, reason = MarketTimingGuard.is_market_open_for_exits()
            if not is_open:
                raise ExecutionPolicyViolationException(f"Trading blocked: {reason}")

        # 2. Enforcement of Execution Source Policy (Auto-Pilot vs Auto-SL)
        if payload.order_source and str(payload.order_source).upper().strip() == "AUTO_STOP_LOSS":
            order_source = "AUTO_STOP_LOSS"
        else:
            order_source = "AUTO_PILOT"
        norm_source = order_source

        if payload.quantity <= Decimal("0"):
            raise ValueError("Order quantity must be strictly greater than zero.")

        if payload.strategy_instance_id:
            portfolio = self._paper.get_or_create_default_portfolio(
                user_id=user_id,
                strategy_instance_id=payload.strategy_instance_id,
            )
        else:
            portfolio = self._paper.get_or_create_default_portfolio(user_id=user_id)

        # 2. AUTO_STOP_LOSS Guard on Existing Open Position
        if norm_source == "AUTO_STOP_LOSS":
            existing_pos = self._paper.get_position(portfolio.id, payload.symbol)
            if not existing_pos or existing_pos.status != "OPEN" or existing_pos.quantity <= Decimal("0"):
                raise ValueError("AUTO_STOP_LOSS order requires an existing valid open position.")

        positions, exposure = self._accounting.get_risk_snapshot(
            user_id=user_id,
            strategy_instance_id=payload.strategy_instance_id,
        )
        request = BrokerOrderRequest(
            symbol=payload.symbol.strip().upper(),
            exchange="NSE",
            quantity=payload.quantity,
            side=payload.side.upper(),
            order_type=payload.order_type.upper(),
            product="CNC",
            variety="regular",
            price=payload.price,
        )
        self._safety.validate_order(
            user_id=user_id,
            broker_id=payload.broker_id,
            request=request,
            execution_mode=mode,
            current_positions=positions,
            current_exposure_notional=exposure,
        )

        paper_order_id = f"PAPER-{uuid4().hex[:16]}"
        position = self._accounting.record_fill(
            user_id=user_id,
            broker_id=payload.broker_id,
            symbol=request.symbol,
            side=request.side,
            quantity=request.quantity,
            price=payload.price,
            execution_mode="PAPER",
            paper_portfolio_id=portfolio.id,
            strategy_instance_id=payload.strategy_instance_id,
            signal_id=payload.signal_id,
            execution_id=paper_order_id,
            product=request.product or "CNC",
            apply_slippage=True,
            apply_transaction_costs=True,
        )

        # Register Stop-Loss and Target if provided and position is OPEN
        if hasattr(position, "stop_loss") and payload.stop_loss is not None:
            position.stop_loss = payload.stop_loss
        if hasattr(position, "target") and payload.target is not None:
            position.target = payload.target
        if hasattr(position, "status"):
            qty = getattr(position, "quantity", Decimal("0"))
            position.status = "OPEN" if qty > Decimal("0") else "CLOSED"
        if hasattr(self._paper, "db") and hasattr(self._paper.db, "commit"):
            self._paper.db.commit()

        execution = self._executions.get_by_external_id(
            "PAPER", payload.broker_id, paper_order_id
        )
        if execution is None:
            raise RuntimeError("PAPER execution ledger record was not persisted")

        if hasattr(execution, "order_source"):
            execution.order_source = norm_source
        if hasattr(self._executions, "db") and hasattr(self._executions.db, "commit"):
            self._executions.db.commit()

        audit_event(
            "PAPER_ORDER_EXECUTED",
            user_id=user_id,
            broker_id=payload.broker_id,
            outcome="SUCCESS",
            resource_type="paper_order",
            resource_id=paper_order_id,
            symbol=request.symbol,
            side=request.side,
            quantity=str(request.quantity),
            price=str(payload.price),
            order_source=norm_source,
            execution_mode="PAPER",
            paper_portfolio_id=str(portfolio.id),
        )
        self._events.emit(
            EventType.ORDER_CREATED,
            user_id=user_id,
            broker_id=payload.broker_id,
            strategy_instance_id=payload.strategy_instance_id,
            symbol=request.symbol,
            execution_mode="PAPER",
            payload={
                "order_id": paper_order_id,
                "status": "FILLED",
                "side": request.side,
                "quantity": request.quantity,
                "price": payload.price,
                "order_source": norm_source,
                "paper_portfolio_id": portfolio.id,
                "position_id": position.id,
            },
        )
        return PaperOrderResponse.from_execution(
            execution,
            paper_portfolio_id=getattr(portfolio, "id", None),
            stop_loss=getattr(position, "stop_loss", None),
            target=getattr(position, "target", None),
        )

    def list_orders(self, *, user_id: UUID, limit: int = 100) -> list[PaperOrderResponse]:
        executions = self._executions.list_paper_for_user(user_id=user_id, limit=limit)
        return [PaperOrderResponse.from_execution(execution) for execution in executions]
