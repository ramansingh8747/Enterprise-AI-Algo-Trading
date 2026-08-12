import logging
from typing import Annotated, List, Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.api.v1.routes.auth import get_current_active_user
from app.schemas.auth import UserResponse
from app.database.repositories.paper_portfolio_repository import PaperPortfolioRepository
from app.dependencies.paper_portfolio import get_paper_portfolio_repository
from app.schemas.paper_portfolio import (
    PaperPortfolioResponse,
    PaperPositionResponse,
    PaperPortfolioSummaryResponse,
    PaperPortfolioCreateRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/paper-portfolios",
    tags=["Paper Portfolios"],
    dependencies=[Depends(get_current_active_user)],
)


@router.get(
    "",
    status_code=status.HTTP_200_OK,
    response_model=List[PaperPortfolioResponse],
    summary="List all paper portfolios owned by current user",
)
def list_paper_portfolios(
    repository: Annotated[PaperPortfolioRepository, Depends(get_paper_portfolio_repository)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> List[PaperPortfolioResponse]:
    """Retrieve all PAPER portfolios owned by the authenticated user."""
    portfolios = repository.get_all_portfolios_for_user(current_user.id)
    if not portfolios:
        # Automatically ensure default paper portfolio is initialized
        default_port = repository.get_or_create_default_portfolio(current_user.id)
        portfolios = [default_port]

    # Enforce PAPER isolation
    paper_only = [p for p in portfolios if p.execution_mode.upper() == "PAPER"]
    return [PaperPortfolioResponse.model_validate(p) for p in paper_only]


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=PaperPortfolioResponse,
    summary="Initialize or create a paper portfolio",
)
def create_paper_portfolio(
    payload: PaperPortfolioCreateRequest,
    repository: Annotated[PaperPortfolioRepository, Depends(get_paper_portfolio_repository)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> PaperPortfolioResponse:
    """Creates or retrieves a dedicated PAPER portfolio for the authenticated user."""
    portfolio = repository.get_or_create_default_portfolio(
        user_id=current_user.id,
        strategy_instance_id=payload.strategy_instance_id,
    )
    if portfolio.execution_mode.upper() != "PAPER":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Created portfolio is not in PAPER mode.",
        )

    return PaperPortfolioResponse.model_validate(portfolio)


@router.get(
    "/{portfolio_id}",
    status_code=status.HTTP_200_OK,
    response_model=PaperPortfolioResponse,
    summary="Get paper portfolio by ID",
)
def get_paper_portfolio(
    portfolio_id: UUID,
    repository: Annotated[PaperPortfolioRepository, Depends(get_paper_portfolio_repository)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> PaperPortfolioResponse:
    """Retrieve details for a specific PAPER portfolio enforcing user ownership."""
    portfolio = repository.get_portfolio_by_id(portfolio_id=portfolio_id, user_id=current_user.id)
    if not portfolio or portfolio.execution_mode.upper() != "PAPER":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paper portfolio {portfolio_id} not found or not accessible.",
        )

    return PaperPortfolioResponse.model_validate(portfolio)


@router.get(
    "/{portfolio_id}/positions",
    status_code=status.HTTP_200_OK,
    response_model=List[PaperPositionResponse],
    summary="Get positions for paper portfolio",
)
def get_paper_positions(
    portfolio_id: UUID,
    repository: Annotated[PaperPortfolioRepository, Depends(get_paper_portfolio_repository)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
    include_closed: bool = Query(default=False, description="Whether to include closed (qty=0) positions."),
) -> List[PaperPositionResponse]:
    """Retrieve positions for a specified PAPER portfolio enforcing user ownership."""
    portfolio = repository.get_portfolio_by_id(portfolio_id=portfolio_id, user_id=current_user.id)
    if not portfolio or portfolio.execution_mode.upper() != "PAPER":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paper portfolio {portfolio_id} not found or not accessible.",
        )

    positions = repository.get_all_positions_for_portfolio(portfolio_id, current_user.id)
    if not include_closed:
        positions = [pos for pos in positions if pos.quantity > Decimal("0.0000")]

    return [PaperPositionResponse.model_validate(pos) for pos in positions]


@router.get(
    "/{portfolio_id}/summary",
    status_code=status.HTTP_200_OK,
    response_model=PaperPortfolioSummaryResponse,
    summary="Get paper portfolio summary and P&L metrics",
)
def get_paper_portfolio_summary(
    portfolio_id: UUID,
    repository: Annotated[PaperPortfolioRepository, Depends(get_paper_portfolio_repository)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> PaperPortfolioSummaryResponse:
    """Calculates summary P&L metrics for a PAPER portfolio using Decimal precision arithmetic."""
    portfolio = repository.get_portfolio_by_id(portfolio_id=portfolio_id, user_id=current_user.id)
    if not portfolio or portfolio.execution_mode.upper() != "PAPER":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paper portfolio {portfolio_id} not found or not accessible.",
        )

    positions = repository.get_all_positions_for_portfolio(portfolio_id, current_user.id)
    
    total_realized = Decimal("0.0000")
    total_unrealized = Decimal("0.0000")

    for pos in positions:
        total_realized += pos.realized_pnl
        total_unrealized += pos.unrealized_pnl

    total_pnl = total_realized + total_unrealized

    return PaperPortfolioSummaryResponse(
        paper_portfolio_id=portfolio.id,
        user_id=current_user.id,
        execution_mode="PAPER",
        total_realized_pnl=total_realized,
        total_unrealized_pnl=total_unrealized,
        total_pnl=total_pnl,
        position_count=len(positions),
        updated_at=datetime.now(timezone.utc),
    )
