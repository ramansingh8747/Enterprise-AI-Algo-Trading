from typing import Annotated
from fastapi import Depends
from sqlalchemy.orm import Session

from app.dependencies.database import get_db
from app.database.repositories.strategy_repository import StrategyRepository
from app.services.strategy_engine.strategy_runner import StrategyRunner
from app.services.strategy_engine.strategy_scheduler import StrategySchedulerService
from app.dependencies.broker import get_broker_order_service
from app.services.broker_order_service import BrokerOrderService
from app.dependencies.event_bus import get_event_bus
from app.services.event_bus.bus import EventBus


def get_strategy_repository(db: Annotated[Session, Depends(get_db)]) -> StrategyRepository:
    """FastAPI dependency constructing scoped StrategyRepository."""
    return StrategyRepository(db)


def get_strategy_runner(
    repo: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    event_bus: Annotated[EventBus, Depends(get_event_bus)],
    db: Annotated[Session, Depends(get_db)],
) -> StrategyRunner:
    """FastAPI dependency constructing StrategyRunner."""
    broker_order_service = None
    try:
        from app.dependencies.broker import (
            get_broker_repository,
            get_idempotency_repository,
            get_trading_risk_repository,
        )
        from app.dependencies.broker_session import get_broker_session_service
        from app.services.broker_service import BrokerService
        from app.brokers.factory import BrokerFactory
        from app.services.idempotency_service import IdempotencyService
        from app.services.risk_engine import RiskEngine

        session_svc = get_broker_session_service(db)
        broker_repo = get_broker_repository(db)
        broker_svc = BrokerService(broker_repo, session_service=session_svc, broker_factory=BrokerFactory())
        idem_svc = IdempotencyService(get_idempotency_repository(db))
        risk_eng = RiskEngine(get_trading_risk_repository(db))
        broker_order_service = BrokerOrderService(
            session_service=session_svc,
            broker_service=broker_svc,
            broker_factory=BrokerFactory,
            idempotency_service=idem_svc,
            risk_engine=risk_eng,
        )
    except Exception:
        broker_order_service = None

    return StrategyRunner(
        repository=repo,
        broker_order_service=broker_order_service,
        event_publisher=event_bus,
    )


def get_strategy_scheduler_service(
    repo: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    runner: Annotated[StrategyRunner, Depends(get_strategy_runner)],
) -> StrategySchedulerService:
    """FastAPI dependency constructing StrategySchedulerService."""
    return StrategySchedulerService(
        strategy_repository=repo,
        strategy_runner=runner,
        interval_seconds=5.0,
    )
