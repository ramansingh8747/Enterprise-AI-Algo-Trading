from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.models.user import UserRole
from app.dependencies.auth import RoleChecker
from app.dependencies.database import get_db
from app.schemas.admin_portfolio import AdminPortfolioListResponse, AdminPortfolioItem
from app.services.admin_portfolio_service import AdminPortfolioService

router = APIRouter(
    prefix="/admin/portfolios",
    tags=["Admin Portfolios"],
    dependencies=[Depends(RoleChecker([UserRole.ADMIN]))],
)


@router.get("", response_model=AdminPortfolioListResponse)
def list_admin_portfolios(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(None, max_length=100),
    execution_mode: Optional[str] = Query(None, pattern="^(PAPER|LIVE)$"),
    user_id: Optional[UUID] = None,
    broker_id: Optional[UUID] = None,
    strategy_instance_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
) -> AdminPortfolioListResponse:
    return AdminPortfolioService(db).list_portfolios(
        page=page, page_size=page_size, search=search, execution_mode=execution_mode,
        user_id=user_id, broker_id=broker_id, strategy_instance_id=strategy_instance_id,
    )


@router.get("/{portfolio_ref}", response_model=AdminPortfolioItem)
def get_admin_portfolio(
    portfolio_ref: UUID,
    source: str = Query(..., pattern="^(PAPER_PORTFOLIO|LIVE_ACCOUNT)$"),
    db: Session = Depends(get_db),
) -> AdminPortfolioItem:
    item = AdminPortfolioService(db).get_portfolio(portfolio_ref, source)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio/account not found")
    return item
