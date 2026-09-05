from fastapi import Depends
from app.dependencies.event_bus import get_trading_event_publisher
from app.services.event_bus.trading_events import TradingEventPublisher
from sqlalchemy.orm import Session

from app.dependencies.database import get_db
from app.database.repositories.paper_portfolio_repository import PaperPortfolioRepository
from app.services.paper_accounting_service import PaperAccountingService
from app.services.paper_valuation_service import PaperValuationService
from app.dependencies.broker import get_execution_position_service
from app.services.execution_position_service import ExecutionPositionService


def get_paper_portfolio_repository(db: Session = Depends(get_db)) -> PaperPortfolioRepository:
    """Dependency provider for PaperPortfolioRepository."""
    return PaperPortfolioRepository(db=db)


def get_paper_accounting_service(
    repository: PaperPortfolioRepository = Depends(get_paper_portfolio_repository),
    execution_position_service: ExecutionPositionService = Depends(get_execution_position_service),
    trading_events: TradingEventPublisher = Depends(get_trading_event_publisher),
) -> PaperAccountingService:
    """Dependency provider for PaperAccountingService with durable execution ledger wiring."""
    return PaperAccountingService(
        repository=repository,
        execution_position_service=execution_position_service,
        trading_event_publisher=trading_events,
    )


def get_paper_valuation_service(
    repository: PaperPortfolioRepository = Depends(get_paper_portfolio_repository),
) -> PaperValuationService:
    """Dependency provider for PaperValuationService."""
    return PaperValuationService(repository=repository)
