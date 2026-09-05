from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.dependencies.database import get_db
from app.dependencies.event_bus import get_trading_event_publisher
from app.repositories.broker_repository import BrokerRepository
from app.services.broker_service import BrokerService
from app.brokers.factory import BrokerFactory


from app.services.interfaces.broker_session_service import BrokerSessionServiceInterface
from app.dependencies.broker_session import get_broker_session_service
from app.services.broker_order_service import BrokerOrderService


from app.database.repositories.order_idempotency_repository import OrderIdempotencyRepository
from app.database.repositories.broker_order_repository import BrokerOrderRepository
from app.services.idempotency_service import IdempotencyService
from app.database.repositories.trading_risk_repository import TradingRiskRepository
from app.services.risk_engine import RiskEngine
from app.services.trading_safety_service import TradingSafetyService
from app.database.repositories.trading_execution_repository import TradingExecutionRepository, TradingPositionRepository
from app.services.execution_position_service import ExecutionPositionService
from app.services.event_bus.trading_events import TradingEventPublisher


# ---------------------------------------------------------------------------
# Repository factory
# ---------------------------------------------------------------------------

def get_broker_repository(db: Annotated[Session, Depends(get_db)]) -> BrokerRepository:
    """FastAPI dependency that constructs a scoped BrokerRepository."""
    return BrokerRepository(db)


def get_idempotency_repository(db: Annotated[Session, Depends(get_db)]) -> OrderIdempotencyRepository:
    """FastAPI dependency that constructs a scoped OrderIdempotencyRepository."""
    return OrderIdempotencyRepository(db)



def get_broker_order_repository(db: Annotated[Session, Depends(get_db)]) -> BrokerOrderRepository:
    """FastAPI dependency for the application-owned broker order ledger."""
    return BrokerOrderRepository(db)


def get_trading_risk_repository(db: Annotated[Session, Depends(get_db)]) -> TradingRiskRepository:
    """FastAPI dependency that constructs a scoped TradingRiskRepository."""
    return TradingRiskRepository(db)


# ---------------------------------------------------------------------------
# Service factory
# ---------------------------------------------------------------------------

def get_broker_service(
    repo: Annotated[BrokerRepository, Depends(get_broker_repository)],
    session_service: Annotated[BrokerSessionServiceInterface, Depends(get_broker_session_service)],
) -> BrokerService:
    """FastAPI dependency that constructs a BrokerService."""
    return BrokerService(repo, session_service=session_service, broker_factory=BrokerFactory())


def get_idempotency_service(
    repo: Annotated[OrderIdempotencyRepository, Depends(get_idempotency_repository)],
) -> IdempotencyService:
    """FastAPI dependency that constructs an IdempotencyService."""
    return IdempotencyService(repo)


def get_risk_engine(
    repo: Annotated[TradingRiskRepository, Depends(get_trading_risk_repository)],
) -> RiskEngine:
    """FastAPI dependency that constructs a RiskEngine."""
    return RiskEngine(repo)


def get_execution_position_service(
    db: Annotated[Session, Depends(get_db)],
    trading_events: Annotated[TradingEventPublisher, Depends(get_trading_event_publisher)],
) -> ExecutionPositionService:
    return ExecutionPositionService(
        execution_repository=TradingExecutionRepository(db),
        position_repository=TradingPositionRepository(db),
        trading_event_publisher=trading_events,
    )


def get_broker_order_service(
    session_service: Annotated[BrokerSessionServiceInterface, Depends(get_broker_session_service)],
    broker_service: Annotated[BrokerService, Depends(get_broker_service)],
    idempotency_service: Annotated[IdempotencyService, Depends(get_idempotency_service)],
    risk_engine: Annotated[RiskEngine, Depends(get_risk_engine)],
    order_repository: Annotated[BrokerOrderRepository, Depends(get_broker_order_repository)],
    execution_position_service: Annotated[ExecutionPositionService, Depends(get_execution_position_service)],
    trading_events: Annotated[TradingEventPublisher, Depends(get_trading_event_publisher)],
) -> BrokerOrderService:
    """FastAPI dependency that constructs a BrokerOrderService."""
    return BrokerOrderService(
        session_service=session_service,
        broker_service=broker_service,
        broker_factory=BrokerFactory,
        idempotency_service=idempotency_service,
        risk_engine=risk_engine,
        safety_service=TradingSafetyService(risk_engine, session_service),
        order_repository=order_repository,
        execution_position_service=execution_position_service,
        trading_event_publisher=trading_events,
    )


def build_runtime_broker_order_service(db: Session) -> BrokerOrderService:
    """Build a non-FastAPI-scoped broker order service for background reconciliation."""
    session_repo = __import__(
        "app.repositories.implementations.broker_session_repository_impl",
        fromlist=["BrokerSessionRepositoryImpl"],
    ).BrokerSessionRepositoryImpl(db)
    session_service = __import__(
        "app.services.implementations.broker_session_service_impl",
        fromlist=["BrokerSessionServiceImpl"],
    ).BrokerSessionServiceImpl(session_repo, __import__(
        "app.core.security.encryption", fromlist=["EncryptionUtility"]
    ).EncryptionUtility())
    broker_service = BrokerService(BrokerRepository(db), session_service=session_service, broker_factory=BrokerFactory())
    idem = IdempotencyService(OrderIdempotencyRepository(db))
    risk = RiskEngine(TradingRiskRepository(db))
    execution = ExecutionPositionService(
        execution_repository=TradingExecutionRepository(db),
        position_repository=TradingPositionRepository(db),
        trading_event_publisher=get_trading_event_publisher(),
    )
    return BrokerOrderService(
        session_service=session_service,
        broker_service=broker_service,
        broker_factory=BrokerFactory,
        idempotency_service=idem,
        risk_engine=risk,
        safety_service=TradingSafetyService(risk, session_service),
        order_repository=BrokerOrderRepository(db),
        execution_position_service=execution,
        trading_event_publisher=get_trading_event_publisher(),
    )
