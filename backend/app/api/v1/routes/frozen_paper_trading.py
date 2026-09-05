import logging
from decimal import Decimal
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.v1.routes.auth import get_current_active_user
from app.schemas.auth import UserResponse
from app.schemas.frozen_paper_trading import (
    FrozenPaperFeedSimulationRequest,
    FrozenPaperSessionStateResponse,
    FrozenPaperStepRequest,
    FrozenPaperTradeAuditResponse,
    FrozenStrategyConfigResponse,
)
from app.services.frozen_strategy_paper_trading_engine import FrozenStrategyPaperTradingEngine
from app.services.frozen_strategy_service import FrozenStrategyService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/frozen-paper-trading",
    tags=["Frozen Paper Trading"],
    dependencies=[Depends(get_current_active_user)],
)

# Global in-memory singleton engine for paper sessions
_paper_engine = FrozenStrategyPaperTradingEngine()
_frozen_service = FrozenStrategyService()


@router.get(
    "/configs",
    status_code=status.HTTP_200_OK,
    response_model=List[FrozenStrategyConfigResponse],
    summary="List all registered frozen strategy configurations",
)
def list_frozen_strategy_configs() -> List[FrozenStrategyConfigResponse]:
    """Retrieves all immutable frozen research strategy configurations."""
    configs = _frozen_service.list_frozen_strategies()
    return [FrozenStrategyConfigResponse(**c.to_dict()) for c in configs]


@router.get(
    "/configs/{version_id}",
    status_code=status.HTTP_200_OK,
    response_model=FrozenStrategyConfigResponse,
    summary="Get details for a specific frozen strategy version",
)
def get_frozen_strategy_config(version_id: str) -> FrozenStrategyConfigResponse:
    """Retrieves the immutable parameters and SHA-256 hash for the specified frozen version."""
    try:
        config = _frozen_service.get_frozen_strategy(version_id)
        return FrozenStrategyConfigResponse(**config.to_dict())
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Frozen strategy configuration '{version_id}' not found.",
        )


@router.get(
    "/session/{version_id}",
    status_code=status.HTTP_200_OK,
    response_model=FrozenPaperSessionStateResponse,
    summary="Get active virtual paper trading session state",
)
def get_paper_session_state(version_id: str) -> FrozenPaperSessionStateResponse:
    """Returns the operational snapshot, positions, NAV, and >=30 trades scorecard."""
    try:
        return _paper_engine.get_session_state_response(version_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Frozen strategy '{version_id}' not found.",
        )


@router.get(
    "/trades/{version_id}",
    status_code=status.HTTP_200_OK,
    response_model=List[FrozenPaperTradeAuditResponse],
    summary="Get fresh-trade audit log for the paper session",
)
def get_trade_audit_log(version_id: str) -> List[FrozenPaperTradeAuditResponse]:
    """Returns the complete chronological audit log of virtual trades and tax deductions."""
    try:
        return _paper_engine.get_trade_audit_log(version_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Frozen strategy '{version_id}' not found.",
        )


@router.post(
    "/session/{version_id}/start",
    status_code=status.HTTP_200_OK,
    response_model=FrozenPaperSessionStateResponse,
    summary="Initialize or start a paper session with capital allocation",
)
def start_paper_session(
    version_id: str,
    initial_capital: Optional[Decimal] = Query(None, description="Custom capital bucket (default: Rs 22,727.27)"),
) -> FrozenPaperSessionStateResponse:
    """Initializes or resets a virtual paper trading session with allocated capital."""
    try:
        _paper_engine.reset_session(version_id=version_id, initial_capital=initial_capital)
        return _paper_engine.get_session_state_response(version_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Frozen strategy '{version_id}' not found.",
        )


@router.post(
    "/session/{version_id}/step",
    status_code=status.HTTP_200_OK,
    response_model=FrozenPaperSessionStateResponse,
    summary="Ingest a single candle into the paper trading state machine",
)
def step_paper_session(
    version_id: str,
    payload: FrozenPaperStepRequest,
) -> FrozenPaperSessionStateResponse:
    """Steps the paper trading engine with a new incoming market candle."""
    try:
        _paper_engine.process_candle(version_id=version_id, candle=payload.model_dump())
        return _paper_engine.get_session_state_response(version_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Frozen strategy '{version_id}' not found.",
        )


@router.post(
    "/session/{version_id}/simulate-feed",
    status_code=status.HTTP_200_OK,
    response_model=FrozenPaperSessionStateResponse,
    summary="Simulate a live feed generating >= 30 trades for statistical validation",
)
def simulate_feed(
    version_id: str,
    payload: FrozenPaperFeedSimulationRequest,
) -> FrozenPaperSessionStateResponse:
    """Simulates an independent multi-candle stream generating fresh trades for validation."""
    try:
        _paper_engine.simulate_independent_feed(version_id=version_id, feed_params=payload)
        return _paper_engine.get_session_state_response(version_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Frozen strategy '{version_id}' not found.",
        )


@router.post(
    "/session/{version_id}/reset",
    status_code=status.HTTP_200_OK,
    response_model=FrozenPaperSessionStateResponse,
    summary="Reset virtual paper trading session",
)
def reset_paper_session(version_id: str) -> FrozenPaperSessionStateResponse:
    """Resets the paper trading session state, balance, and trade log."""
    try:
        _paper_engine.reset_session(version_id=version_id)
        return _paper_engine.get_session_state_response(version_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Frozen strategy '{version_id}' not found.",
        )
