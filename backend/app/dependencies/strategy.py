from typing import Annotated
from fastapi import Depends
from sqlalchemy.orm import Session

from app.dependencies.database import get_db
from app.database.repositories.strategy_repository import StrategyRepository
from app.services.strategy_engine.strategy_runner import StrategyRunner
from app.services.strategy_engine.strategy_scheduler import StrategySchedulerService
from app.dependencies.broker import get_broker_repository, get_broker_order_service, get_broker_service, get_risk_engine, get_idempotency_repository, get_trading_risk_repository
from app.services.broker_order_service import BrokerOrderService
from app.services.broker_service import BrokerService
from app.dependencies.event_bus import get_event_bus, get_trading_event_publisher
from app.services.event_bus.bus import EventBus
from app.dependencies.paper_portfolio import get_paper_accounting_service
from app.services.paper_accounting_service import PaperAccountingService
from app.dependencies.market_data import get_market_data_provider
from app.services.market_data.market_data_provider import MarketDataProvider
from app.services.risk_engine import RiskEngine
from app.core.config.settings import settings
from app.services.trading_safety_service import TradingSafetyService
from app.database.repositories.broker_order_repository import BrokerOrderRepository
from app.database.repositories.trading_execution_repository import TradingExecutionRepository, TradingPositionRepository
from app.services.execution_position_service import ExecutionPositionService
from app.services.event_bus.trading_events import TradingEventPublisher


def get_strategy_repository(db: Annotated[Session, Depends(get_db)]) -> StrategyRepository:
    return StrategyRepository(db)


def get_strategy_runner(
    repo: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    event_bus: Annotated[EventBus, Depends(get_event_bus)],
    db: Annotated[Session, Depends(get_db)],
    paper_accounting: Annotated[PaperAccountingService, Depends(get_paper_accounting_service)],
    trading_events: Annotated[TradingEventPublisher, Depends(get_trading_event_publisher)],
) -> StrategyRunner:
    from app.repositories.implementations.broker_session_repository_impl import BrokerSessionRepositoryImpl
    from app.services.implementations.broker_session_service_impl import BrokerSessionServiceImpl
    from app.core.security.encryption import EncryptionUtility
    from app.brokers.factory import BrokerFactory
    from app.services.idempotency_service import IdempotencyService

    session_repo = BrokerSessionRepositoryImpl(db)
    session_svc = BrokerSessionServiceImpl(session_repo, EncryptionUtility())
    broker_repo = get_broker_repository(db)
    broker_svc = BrokerService(
        broker_repo,
        session_service=session_svc,
        broker_factory=BrokerFactory(),
    )
    idem_svc = IdempotencyService(get_idempotency_repository(db))
    risk_eng = RiskEngine(get_trading_risk_repository(db))
    safety = TradingSafetyService(risk_eng, session_svc)
    execution_position_service = ExecutionPositionService(
        execution_repository=TradingExecutionRepository(db),
        position_repository=TradingPositionRepository(db),
        trading_event_publisher=trading_events,
    )
    broker_order_service = BrokerOrderService(
        session_service=session_svc,
        broker_service=broker_svc,
        broker_factory=BrokerFactory,
        idempotency_service=idem_svc,
        risk_engine=risk_eng,
        safety_service=safety,
        order_repository=BrokerOrderRepository(db),
        execution_position_service=execution_position_service,
        trading_event_publisher=trading_events,
    )

    return StrategyRunner(
        repository=repo,
        broker_order_service=broker_order_service,
        event_publisher=event_bus,
        paper_accounting_service=paper_accounting,
        risk_engine=risk_eng,
        safety_service=safety,
        execution_position_service=execution_position_service,
    )


def get_strategy_scheduler_service(
    repo: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    runner: Annotated[StrategyRunner, Depends(get_strategy_runner)],
    broker_service: Annotated[BrokerService, Depends(get_broker_service)],
    risk_engine: Annotated[RiskEngine, Depends(get_risk_engine)],
    market_data_provider: Annotated[MarketDataProvider, Depends(get_market_data_provider)],
) -> StrategySchedulerService:
    return StrategySchedulerService(
        strategy_repository=repo,
        strategy_runner=runner,
        risk_engine=risk_engine,
        broker_service=broker_service,
        market_data_provider=market_data_provider,
        interval_seconds=settings.STRATEGY_SCHEDULER_INTERVAL_SECONDS,
    )


def build_strategy_scheduler(db: Session, event_bus: EventBus) -> StrategySchedulerService:
    """Build the long-lived scheduler with the unified safety boundary."""
    from app.repositories.broker_repository import BrokerRepository
    from app.repositories.implementations.broker_session_repository_impl import BrokerSessionRepositoryImpl
    from app.services.implementations.broker_session_service_impl import BrokerSessionServiceImpl
    from app.core.security.encryption import EncryptionUtility
    from app.brokers.factory import BrokerFactory
    from app.database.repositories.order_idempotency_repository import OrderIdempotencyRepository
    from app.database.repositories.trading_risk_repository import TradingRiskRepository
    from app.services.idempotency_service import IdempotencyService
    from app.database.repositories.paper_portfolio_repository import PaperPortfolioRepository

    strategy_repo = StrategyRepository(db)
    trading_events = TradingEventPublisher(event_bus)
    session_repo = BrokerSessionRepositoryImpl(db)
    session_service = BrokerSessionServiceImpl(session_repo, EncryptionUtility())
    broker_repo = BrokerRepository(db)
    broker_service = BrokerService(
        broker_repo,
        session_service=session_service,
        broker_factory=BrokerFactory(),
    )
    risk_engine = RiskEngine(TradingRiskRepository(db))
    safety = TradingSafetyService(risk_engine, session_service)
    execution_position_service = ExecutionPositionService(
        execution_repository=TradingExecutionRepository(db),
        position_repository=TradingPositionRepository(db),
        trading_event_publisher=trading_events,
    )
    broker_order_service = BrokerOrderService(
        session_service=session_service,
        broker_service=broker_service,
        broker_factory=BrokerFactory,
        idempotency_service=IdempotencyService(OrderIdempotencyRepository(db)),
        risk_engine=risk_engine,
        safety_service=safety,
        order_repository=BrokerOrderRepository(db),
        execution_position_service=execution_position_service,
        trading_event_publisher=trading_events,
    )
    paper_accounting = PaperAccountingService(PaperPortfolioRepository(db), execution_position_service=execution_position_service, trading_event_publisher=trading_events)
    market_data_provider = MarketDataProvider(event_publisher=event_bus)

    runner = StrategyRunner(
        repository=strategy_repo,
        broker_order_service=broker_order_service,
        paper_accounting_service=paper_accounting,
        event_publisher=event_bus,
        risk_engine=risk_engine,
        safety_service=safety,
        execution_position_service=execution_position_service,
    )

    return StrategySchedulerService(
        strategy_repository=strategy_repo,
        strategy_runner=runner,
        risk_engine=risk_engine,
        broker_service=broker_service,
        market_data_provider=market_data_provider,
        interval_seconds=settings.STRATEGY_SCHEDULER_INTERVAL_SECONDS,
    )
