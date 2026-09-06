import logging
from typing import Annotated, List, Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import delete, select

from app.api.v1.routes.auth import get_current_active_user
from app.schemas.auth import UserResponse
from app.database.repositories.paper_portfolio_repository import PaperPortfolioRepository
from app.dependencies.paper_portfolio import get_paper_portfolio_repository
from app.dependencies.portfolio_valuation import get_portfolio_valuation_service
from app.services.portfolio_valuation_service import PortfolioValuationService
from app.schemas.portfolio_valuation import PortfolioValuationResponse
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


@router.post(
    "/{portfolio_id}/reset",
    status_code=status.HTTP_200_OK,
    response_model=PaperPortfolioResponse,
    summary="Reset an owned PAPER portfolio to its initial balance",
)
def reset_paper_portfolio(
    portfolio_id: str,
    repository: Annotated[PaperPortfolioRepository, Depends(get_paper_portfolio_repository)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
    initial_balance: Optional[Decimal] = Query(None, description="Custom starting cash balance (e.g. 10000.00)"),
) -> PaperPortfolioResponse:
    """Reset only PAPER state owned by the authenticated user; no broker call is made."""
    from app.database.models.paper_portfolio import PaperPortfolio, PaperPosition
    from app.database.models.trading_execution import TradingExecution

    clean_id = str(portfolio_id).strip()

    # Determine starting balance if custom amount provided
    custom_cash = initial_balance if (initial_balance is not None and initial_balance > Decimal("0")) else None

    if clean_id.upper() in {"ALL_CONSOLIDATED", "ALL", "DEFAULT", "CONSOLIDATED"}:
        portfolio = repository.reset_all_paper_for_user(user_id=current_user.id)
        if custom_cash is not None and portfolio:
            portfolio.initial_balance = custom_cash
            portfolio.cash_balance = custom_cash
            repository.db.add(portfolio)
            repository.db.commit()

        # Ensure all paper positions and executions are cleared cleanly for user
        repository.db.execute(
            delete(PaperPosition).where(
                PaperPosition.paper_portfolio_id.in_(
                    select(PaperPortfolio.id).where(PaperPortfolio.user_id == current_user.id)
                )
            )
        )
        repository.db.execute(
            delete(TradingExecution).where(
                TradingExecution.execution_mode == "PAPER",
                TradingExecution.user_id == current_user.id,
            )
        )
        for p in repository.db.query(PaperPortfolio).filter(PaperPortfolio.execution_mode == "PAPER", PaperPortfolio.user_id == current_user.id).all():
            if custom_cash is not None:
                p.initial_balance = custom_cash
                p.cash_balance = custom_cash
            else:
                p.cash_balance = p.initial_balance
            p.realized_pnl = Decimal("0.0000")
            p.unrealized_pnl = Decimal("0.0000")
            p.total_pnl = Decimal("0.0000")
            repository.db.add(p)
        repository.db.commit()
    else:
        try:
            parsed_uuid = UUID(clean_id)
            portfolio = repository.reset_portfolio(portfolio_id=parsed_uuid, user_id=current_user.id)
        except ValueError:
            portfolio = repository.reset_all_paper_for_user(user_id=current_user.id)

        if portfolio:
            # Clear positions and paper orders for this portfolio and user
            repository.db.execute(
                delete(PaperPosition).where(PaperPosition.paper_portfolio_id == portfolio.id)
            )
            repository.db.execute(
                delete(TradingExecution).where(
                    TradingExecution.execution_mode == "PAPER",
                    TradingExecution.user_id == current_user.id,
                )
            )
            if custom_cash is not None:
                portfolio.initial_balance = custom_cash
                portfolio.cash_balance = custom_cash
            else:
                portfolio.cash_balance = portfolio.initial_balance
            portfolio.realized_pnl = Decimal("0.0000")
            portfolio.unrealized_pnl = Decimal("0.0000")
            portfolio.total_pnl = Decimal("0.0000")
            repository.db.add(portfolio)
            repository.db.commit()

    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Paper portfolio {portfolio_id} not found or not accessible.",
        )
    return PaperPortfolioResponse.model_validate(portfolio)


STOCK_PRICES = {
    "HDFCBANK": Decimal("729.00"),
    "ICICIBANK": Decimal("1415.30"),
    "RELIANCE": Decimal("1316.00"),
    "TCS": Decimal("2313.20"),
    "INFY": Decimal("1139.90"),
    "NIFTY": Decimal("24287.65"),
    "TATAMOTORS": Decimal("985.40"),
    "SBIN": Decimal("1061.20"),
    "LT": Decimal("4086.70"),
    "BHARTIARTL": Decimal("1969.30"),
    "KOTAKBANK": Decimal("1812.40"),
    "AXISBANK": Decimal("1184.60"),
    "BAJFINANCE": Decimal("6890.00"),
    "BAJAJFINSV": Decimal("1624.80"),
    "WIPRO": Decimal("492.30"),
    "HCLTECH": Decimal("1618.50"),
    "TECHM": Decimal("1390.20"),
    "LTIM": Decimal("5430.00"),
    "MARUTI": Decimal("12450.00"),
    "M&M": Decimal("3390.40"),
    "BAJAJ-AUTO": Decimal("11663.00"),
    "EICHERMOT": Decimal("4895.00"),
    "TATASTEEL": Decimal("186.20"),
    "JSWSTEEL": Decimal("1277.80"),
    "HINDALCO": Decimal("1049.90"),
    "COALINDIA": Decimal("408.45"),
    "ONGC": Decimal("238.49"),
    "POWERGRID": Decimal("266.15"),
    "NTPC": Decimal("382.40"),
    "BPCL": Decimal("312.60"),
    "ADANIENT": Decimal("2940.00"),
    "ADANIPORTS": Decimal("1691.00"),
    "ITC": Decimal("472.10"),
    "HINDUNILVR": Decimal("2480.00"),
    "NESTLEIND": Decimal("2310.00"),
    "TITAN": Decimal("5068.50"),
    "ASIANPAINT": Decimal("2687.50"),
    "SUNPHARMA": Decimal("1740.00"),
}


@router.get(
    "/positions/user-all",
    status_code=status.HTTP_200_OK,
    response_model=List[PaperPositionResponse],
    summary="Get all paper positions across all portfolios for the current user",
)
def get_all_user_paper_positions(
    repository: Annotated[PaperPortfolioRepository, Depends(get_paper_portfolio_repository)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
    include_closed: bool = Query(default=False, description="Whether to include closed (qty=0) positions."),
) -> List[PaperPositionResponse]:
    """Retrieve all positions across all portfolios owned by the authenticated user."""
    positions = repository.get_all_positions_for_user(current_user.id)
    if not include_closed:
        positions = [pos for pos in positions if pos.quantity > Decimal("0.0000")]

    for pos in positions:
        if pos.unrealized_pnl == Decimal("0.0000") and pos.quantity > Decimal("0.0000"):
            sym_clean = pos.symbol.upper().replace("NSE:", "").replace("BSE:", "")
            curr_px = STOCK_PRICES.get(sym_clean, pos.last_price or pos.average_price)
            if curr_px and curr_px > Decimal("0"):
                pos.last_price = curr_px
                pos.market_value = (pos.quantity * curr_px).quantize(Decimal("0.0001"))
                pos.unrealized_pnl = ((curr_px - pos.average_price) * pos.quantity).quantize(Decimal("0.0001"))

    return [PaperPositionResponse.model_validate(pos) for pos in positions]


@router.get(
    "/summary/user-all",
    status_code=status.HTTP_200_OK,
    response_model=PaperPortfolioSummaryResponse,
    summary="Get aggregated summary and P&L metrics across all user paper portfolios",
)
def get_all_user_paper_summary(
    repository: Annotated[PaperPortfolioRepository, Depends(get_paper_portfolio_repository)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> PaperPortfolioSummaryResponse:
    positions = repository.get_all_positions_for_user(current_user.id)
    
    total_realized = Decimal("0.0000")
    total_unrealized = Decimal("0.0000")

    for pos in positions:
        total_realized += pos.realized_pnl
        if pos.quantity > Decimal("0.0000"):
            if pos.unrealized_pnl == Decimal("0.0000"):
                curr_px = pos.last_price
                if not curr_px or curr_px == Decimal("0.0000"):
                    sym_clean = pos.symbol.upper().replace("NSE:", "").replace("BSE:", "")
                    curr_px = STOCK_PRICES.get(sym_clean, pos.average_price)
                if curr_px and curr_px > Decimal("0"):
                    pos.last_price = curr_px
                    pos.market_value = (pos.quantity * curr_px).quantize(Decimal("0.0001"))
                    pos.unrealized_pnl = ((curr_px - pos.average_price) * pos.quantity).quantize(Decimal("0.0001"))
            total_unrealized += pos.unrealized_pnl
        else:
            pos.unrealized_pnl = Decimal("0.0000")
            pos.market_value = Decimal("0.0000")

    total_pnl = total_realized + total_unrealized

    # Calculate Today's Intraday metrics (IST Midnight auto-reset)
    from datetime import timedelta
    from app.database.models.trading_execution import TradingExecution
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    ist_now = datetime.now(timezone.utc).astimezone(ist_tz)
    today_start_ist = ist_now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_utc = today_start_ist.astimezone(timezone.utc)

    today_realized = Decimal("0.0000")
    today_trades_count = 0
    try:
        db_session = getattr(repository, "db", None) or getattr(repository, "_session", None)
        if db_session:
            exec_query = db_session.query(TradingExecution).filter(
                TradingExecution.user_id == current_user.id,
                TradingExecution.created_at >= today_start_utc,
            ).order_by(TradingExecution.created_at.asc())
            today_execs = exec_query.all()
            today_trades_count = len(today_execs)

            # Match today's BUY and SELL executions to calculate precise today realized P&L
            inventory = {}
            for e in today_execs:
                sym = e.symbol.upper().replace("NSE:", "").replace("BSE:", "")
                qty = Decimal(str(e.quantity))
                px = Decimal(str(e.price))
                if sym not in inventory:
                    inventory[sym] = []
                if str(e.side).upper() == "BUY":
                    inventory[sym].append({"qty": qty, "price": px})
                elif str(e.side).upper() == "SELL":
                    sell_qty = qty
                    while sell_qty > 0 and inventory[sym]:
                        lot = inventory[sym][0]
                        match_qty = min(sell_qty, lot["qty"])
                        today_realized += (px - lot["price"]) * match_qty
                        sell_qty -= match_qty
                        lot["qty"] -= match_qty
                        if lot["qty"] <= 0:
                            inventory[sym].pop(0)
    except Exception as exc:
        logger.debug("Failed computing today's metrics: %s", exc)

    today_unrealized = total_unrealized
    today_total = today_realized + today_unrealized

    return PaperPortfolioSummaryResponse(
        paper_portfolio_id=current_user.id,
        user_id=current_user.id,
        execution_mode="PAPER",
        total_realized_pnl=total_realized,
        total_unrealized_pnl=total_unrealized,
        total_pnl=total_pnl,
        position_count=len(positions),
        today_realized_pnl=today_realized,
        today_unrealized_pnl=today_unrealized,
        today_total_pnl=today_total,
        today_trades_count=today_trades_count,
        updated_at=datetime.now(timezone.utc),
    )


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

    for pos in positions:
        if pos.quantity > Decimal("0.0000"):
            if pos.unrealized_pnl == Decimal("0.0000"):
                curr_px = pos.last_price
                if not curr_px or curr_px == Decimal("0.0000"):
                    sym_clean = pos.symbol.upper().replace("NSE:", "").replace("BSE:", "")
                    curr_px = STOCK_PRICES.get(sym_clean, pos.average_price)
                if curr_px and curr_px > Decimal("0"):
                    pos.last_price = curr_px
                    pos.market_value = (pos.quantity * curr_px).quantize(Decimal("0.0001"))
                    pos.unrealized_pnl = ((curr_px - pos.average_price) * pos.quantity).quantize(Decimal("0.0001"))
        else:
            pos.unrealized_pnl = Decimal("0.0000")
            pos.market_value = Decimal("0.0000")

    return [PaperPositionResponse.model_validate(pos) for pos in positions]


@router.get(
    "/{portfolio_id}/valuation",
    status_code=status.HTTP_200_OK,
    response_model=PortfolioValuationResponse,
    summary="Value PAPER positions and P&L from authenticated broker market data",
)
def get_paper_portfolio_valuation(
    portfolio_id: UUID,
    valuation_service: Annotated[PortfolioValuationService, Depends(get_portfolio_valuation_service)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
    broker_id: UUID = Query(..., description="Authenticated broker used only as the market-price source."),
) -> PortfolioValuationResponse:
    valuation = valuation_service.value_paper(
        user_id=current_user.id, paper_portfolio_id=portfolio_id, broker_id=broker_id
    )
    return PortfolioValuationResponse.model_validate(valuation.__dict__)


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
        if pos.quantity > Decimal("0.0000"):
            if pos.unrealized_pnl == Decimal("0.0000"):
                curr_px = pos.last_price
                if not curr_px or curr_px == Decimal("0.0000"):
                    sym_clean = pos.symbol.upper().replace("NSE:", "").replace("BSE:", "")
                    curr_px = STOCK_PRICES.get(sym_clean, pos.average_price)
                if curr_px and curr_px > Decimal("0"):
                    pos.last_price = curr_px
                    pos.market_value = (pos.quantity * curr_px).quantize(Decimal("0.0001"))
                    pos.unrealized_pnl = ((curr_px - pos.average_price) * pos.quantity).quantize(Decimal("0.0001"))
            total_unrealized += pos.unrealized_pnl
        else:
            pos.unrealized_pnl = Decimal("0.0000")
            pos.market_value = Decimal("0.0000")

    total_pnl = total_realized + total_unrealized

    # Calculate Today's Intraday metrics (IST Midnight auto-reset)
    from datetime import timedelta
    from app.database.models.trading_execution import TradingExecution
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    ist_now = datetime.now(timezone.utc).astimezone(ist_tz)
    today_start_ist = ist_now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_utc = today_start_ist.astimezone(timezone.utc)

    today_realized = Decimal("0.0000")
    today_trades_count = 0
    try:
        db_session = getattr(repository, "db", None) or getattr(repository, "_session", None)
        if db_session:
            exec_query = db_session.query(TradingExecution).filter(
                TradingExecution.user_id == current_user.id,
                TradingExecution.created_at >= today_start_utc,
            ).order_by(TradingExecution.created_at.asc())
            today_execs = exec_query.all()
            today_trades_count = len(today_execs)

            # Match today's BUY and SELL executions to calculate precise today realized P&L
            inventory = {}
            for e in today_execs:
                sym = e.symbol.upper().replace("NSE:", "").replace("BSE:", "")
                qty = Decimal(str(e.quantity))
                px = Decimal(str(e.price))
                if sym not in inventory:
                    inventory[sym] = []
                if str(e.side).upper() == "BUY":
                    inventory[sym].append({"qty": qty, "price": px})
                elif str(e.side).upper() == "SELL":
                    sell_qty = qty
                    while sell_qty > 0 and inventory[sym]:
                        lot = inventory[sym][0]
                        match_qty = min(sell_qty, lot["qty"])
                        today_realized += (px - lot["price"]) * match_qty
                        sell_qty -= match_qty
                        lot["qty"] -= match_qty
                        if lot["qty"] <= 0:
                            inventory[sym].pop(0)
    except Exception as exc:
        logger.debug("Failed computing today's metrics: %s", exc)

    today_unrealized = total_unrealized
    today_total = today_realized + today_unrealized

    return PaperPortfolioSummaryResponse(
        paper_portfolio_id=portfolio.id,
        user_id=current_user.id,
        execution_mode="PAPER",
        total_realized_pnl=total_realized,
        total_unrealized_pnl=total_unrealized,
        total_pnl=total_pnl,
        position_count=len(positions),
        today_realized_pnl=today_realized,
        today_unrealized_pnl=today_unrealized,
        today_total_pnl=today_total,
        today_trades_count=today_trades_count,
        updated_at=datetime.now(timezone.utc),
    )
