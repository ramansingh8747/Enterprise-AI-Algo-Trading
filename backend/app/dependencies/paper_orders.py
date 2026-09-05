from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.database.repositories.paper_portfolio_repository import PaperPortfolioRepository
from app.database.repositories.trading_execution_repository import TradingExecutionRepository
from app.dependencies.broker import get_risk_engine
from app.dependencies.broker_session import get_broker_session_service
from app.dependencies.database import get_db
from app.dependencies.event_bus import get_trading_event_publisher
from app.dependencies.paper_portfolio import get_paper_accounting_service
from app.services.event_bus.trading_events import TradingEventPublisher
from app.services.interfaces.broker_session_service import BrokerSessionServiceInterface
from app.services.paper_accounting_service import PaperAccountingService
from app.services.paper_order_service import PaperOrderService
from app.services.risk_engine import RiskEngine
from app.services.trading_safety_service import TradingSafetyService


def get_paper_order_service(
    db: Annotated[Session, Depends(get_db)],
    accounting: Annotated[PaperAccountingService, Depends(get_paper_accounting_service)],
    risk_engine: Annotated[RiskEngine, Depends(get_risk_engine)],
    session_service: Annotated[BrokerSessionServiceInterface, Depends(get_broker_session_service)],
    trading_events: Annotated[TradingEventPublisher, Depends(get_trading_event_publisher)],
) -> PaperOrderService:
    return PaperOrderService(
        paper_repository=PaperPortfolioRepository(db),
        execution_repository=TradingExecutionRepository(db),
        accounting_service=accounting,
        risk_engine=risk_engine,
        safety_service=TradingSafetyService(risk_engine, session_service),
        trading_events=trading_events,
    )
