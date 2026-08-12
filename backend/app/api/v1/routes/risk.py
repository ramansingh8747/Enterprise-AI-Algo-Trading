"""
Emergency Kill Switch & Trading Risk Management REST API Routes (Step 13.21I.34.125 — GAP-007).

Provides administrator REST endpoints to view current Emergency Kill Switch status,
activate the Emergency Kill Switch, and deactivate the Emergency Kill Switch.
"""

from typing import Annotated, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies.database import get_db
from app.dependencies.auth import get_current_active_user
from app.database.models.user import User
from app.database.repositories.trading_risk_repository import TradingRiskRepository

router = APIRouter()


def get_risk_repository(db: Annotated[Session, Depends(get_db)]) -> TradingRiskRepository:
    """Dependency providing TradingRiskRepository."""
    return TradingRiskRepository(db)


@router.get("/kill-switch", summary="Get Emergency Kill Switch Status")
def get_kill_switch_status(
    current_user: Annotated[User, Depends(get_current_active_user)],
    risk_repo: Annotated[TradingRiskRepository, Depends(get_risk_repository)],
) -> Dict[str, Any]:
    """
    Retrieves current Emergency Kill Switch status for the platform.
    Requires authenticated user access.
    """
    risk_settings = risk_repo.get_risk_settings(user_id=current_user.id)
    is_active = bool(risk_settings.kill_switch_active)

    return {
        "kill_switch_active": is_active,
        "status": "ACTIVE" if is_active else "INACTIVE",
        "updated_at": risk_settings.updated_at.isoformat() if risk_settings.updated_at else datetime.now(timezone.utc).isoformat(),
        "user_id": str(current_user.id),
    }


@router.post("/kill-switch/activate", summary="Activate Emergency Kill Switch")
def activate_kill_switch(
    current_user: Annotated[User, Depends(get_current_active_user)],
    risk_repo: Annotated[TradingRiskRepository, Depends(get_risk_repository)],
) -> Dict[str, Any]:
    """
    Activates the Emergency Kill Switch platform-wide.
    Immediately halts strategy execution and blocks new order placement.
    Requires authenticated user access.
    """
    updated_settings = risk_repo.set_kill_switch(active=True, user_id=current_user.id)

    return {
        "kill_switch_active": True,
        "status": "ACTIVE",
        "message": "Emergency Kill Switch has been ACTIVATED. All automated trading and order execution is HALTED.",
        "updated_at": updated_settings.updated_at.isoformat() if updated_settings.updated_at else datetime.now(timezone.utc).isoformat(),
    }


@router.post("/kill-switch/deactivate", summary="Deactivate Emergency Kill Switch")
def deactivate_kill_switch(
    current_user: Annotated[User, Depends(get_current_active_user)],
    risk_repo: Annotated[TradingRiskRepository, Depends(get_risk_repository)],
) -> Dict[str, Any]:
    """
    Deactivates the Emergency Kill Switch platform-wide.
    Restores normal trading execution conditions.
    Requires authenticated user access.
    """
    updated_settings = risk_repo.set_kill_switch(active=False, user_id=current_user.id)

    return {
        "kill_switch_active": False,
        "status": "INACTIVE",
        "message": "Emergency Kill Switch has been DEACTIVATED. Normal trading conditions restored.",
        "updated_at": updated_settings.updated_at.isoformat() if updated_settings.updated_at else datetime.now(timezone.utc).isoformat(),
    }
