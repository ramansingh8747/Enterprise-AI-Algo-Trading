from typing import Annotated
from fastapi import Depends
from sqlalchemy.orm import Session

from app.dependencies.database import get_db
from app.dependencies.broker import get_broker_service
from app.services.broker_service import BrokerService
from app.database.repositories.trading_execution_repository import TradingPositionRepository
from app.database.repositories.paper_portfolio_repository import PaperPortfolioRepository
from app.services.portfolio_valuation_service import PortfolioValuationService
from app.dependencies.event_bus import get_trading_event_publisher
from app.services.event_bus.trading_events import TradingEventPublisher


def get_portfolio_valuation_service(
    db: Annotated[Session, Depends(get_db)],
    broker_service: Annotated[BrokerService, Depends(get_broker_service)],
    trading_events: Annotated[TradingEventPublisher, Depends(get_trading_event_publisher)],
) -> PortfolioValuationService:
    return PortfolioValuationService(
        broker_service=broker_service,
        live_position_repository=TradingPositionRepository(db),
        paper_repository=PaperPortfolioRepository(db),
        trading_event_publisher=trading_events,
    )



def build_continuous_portfolio_valuation_service(event_bus, refresh_interval_seconds: float):
    from app.repositories.broker_repository import BrokerRepository
    from app.dependencies.broker_session import get_broker_session_service
    from app.brokers.factory import BrokerFactory
    from app.services.broker_service import BrokerService
    from app.services.continuous_portfolio_valuation_service import ContinuousPortfolioValuationService
    from app.dependencies.event_bus import get_trading_event_publisher

    def factory(db: Session):
        session_service = get_broker_session_service(db)
        broker_service = BrokerService(BrokerRepository(db), session_service=session_service, broker_factory=BrokerFactory())
        return PortfolioValuationService(
            broker_service=broker_service,
            live_position_repository=TradingPositionRepository(db),
            paper_repository=PaperPortfolioRepository(db),
            trading_event_publisher=get_trading_event_publisher(),
        )

    return ContinuousPortfolioValuationService(event_bus, factory, refresh_interval_seconds=refresh_interval_seconds)
