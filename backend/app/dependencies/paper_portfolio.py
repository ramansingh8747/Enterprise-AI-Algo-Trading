from fastapi import Depends
from sqlalchemy.orm import Session

from app.dependencies.database import get_db
from app.database.repositories.paper_portfolio_repository import PaperPortfolioRepository
from app.services.paper_accounting_service import PaperAccountingService
from app.services.paper_valuation_service import PaperValuationService


def get_paper_portfolio_repository(db: Session = Depends(get_db)) -> PaperPortfolioRepository:
    """Dependency provider for PaperPortfolioRepository."""
    return PaperPortfolioRepository(db=db)


def get_paper_accounting_service(
    repository: PaperPortfolioRepository = Depends(get_paper_portfolio_repository),
) -> PaperAccountingService:
    """Dependency provider for PaperAccountingService."""
    return PaperAccountingService(repository=repository)


def get_paper_valuation_service(
    repository: PaperPortfolioRepository = Depends(get_paper_portfolio_repository),
) -> PaperValuationService:
    """Dependency provider for PaperValuationService."""
    return PaperValuationService(repository=repository)
