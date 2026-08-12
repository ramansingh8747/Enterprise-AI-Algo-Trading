from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.dependencies.database import get_db
from app.repositories.broker_repository import BrokerRepository
from app.services.broker_service import BrokerService
from app.brokers.factory import BrokerFactory


from app.services.interfaces.broker_session_service import BrokerSessionServiceInterface
from app.dependencies.broker_session import get_broker_session_service
from app.services.broker_order_service import BrokerOrderService


from app.database.repositories.order_idempotency_repository import OrderIdempotencyRepository
from app.services.idempotency_service import IdempotencyService
from app.database.repositories.trading_risk_repository import TradingRiskRepository
from app.services.risk_engine import RiskEngine


# ---------------------------------------------------------------------------
# Repository factory
# ---------------------------------------------------------------------------

def get_broker_repository(db: Annotated[Session, Depends(get_db)]) -> BrokerRepository:
    """FastAPI dependency that constructs a scoped BrokerRepository."""
    return BrokerRepository(db)


def get_idempotency_repository(db: Annotated[Session, Depends(get_db)]) -> OrderIdempotencyRepository:
    """FastAPI dependency that constructs a scoped OrderIdempotencyRepository."""
    return OrderIdempotencyRepository(db)


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


def get_broker_order_service(
    session_service: Annotated[BrokerSessionServiceInterface, Depends(get_broker_session_service)],
    broker_service: Annotated[BrokerService, Depends(get_broker_service)],
    idempotency_service: Annotated[IdempotencyService, Depends(get_idempotency_service)],
    risk_engine: Annotated[RiskEngine, Depends(get_risk_engine)],
) -> BrokerOrderService:
    """FastAPI dependency that constructs a BrokerOrderService."""
    return BrokerOrderService(
        session_service=session_service,
        broker_service=broker_service,
        broker_factory=BrokerFactory,
        idempotency_service=idempotency_service,
        risk_engine=risk_engine,
    )
