"""Administrator risk controls and emergency kill-switch API."""

from typing import Annotated, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies.database import get_db
from app.dependencies.auth import get_current_active_user, RoleChecker
from app.dependencies.event_bus import get_trading_event_publisher
from app.database.models.user import User, UserRole
from app.database.repositories.trading_risk_repository import TradingRiskRepository
from app.schemas.risk import AdminRiskSettingsResponse, AdminRiskSettingsUpdate
from app.core.logging.trading_audit import audit_event
from app.services.event_bus.trading_events import TradingEventPublisher
from app.services.event_bus.models import EventType

router = APIRouter(
    dependencies=[Depends(RoleChecker([UserRole.ADMIN]))],
)


def get_risk_repository(db: Annotated[Session, Depends(get_db)]) -> TradingRiskRepository:
    return TradingRiskRepository(db)


def _serialize_settings(settings) -> AdminRiskSettingsResponse:
    return AdminRiskSettingsResponse(
        max_order_quantity=settings.max_order_quantity,
        max_order_notional=settings.max_order_notional,
        max_position_quantity=settings.max_position_quantity,
        max_exposure_notional=settings.max_exposure_notional,
        max_orders_per_minute=settings.max_orders_per_minute,
        daily_loss_limit=settings.daily_loss_limit,
        max_drawdown_percent=settings.max_drawdown_percent,
        kill_switch_active=settings.kill_switch_active,
        updated_at=settings.updated_at,
    )


@router.get("/settings", response_model=AdminRiskSettingsResponse, summary="Get platform risk settings")
def get_risk_settings(
    current_user: Annotated[User, Depends(get_current_active_user)],
    risk_repo: Annotated[TradingRiskRepository, Depends(get_risk_repository)],
):
    return _serialize_settings(risk_repo.get_global_risk_settings())


@router.get("/live-metrics", summary="Get real-time risk utilization metrics")
def get_live_risk_metrics(
    current_user: Annotated[User, Depends(get_current_active_user)],
    risk_repo: Annotated[TradingRiskRepository, Depends(get_risk_repository)],
    db: Annotated[Session, Depends(get_db)],
) -> Dict[str, Any]:
    from sqlalchemy import text

    settings = risk_repo.get_global_risk_settings()

    res = db.execute(text("SELECT COALESCE(SUM(market_value), 0), COALESCE(SUM(cost_basis), 0), COUNT(*) FROM paper_positions WHERE status = 'OPEN'")).fetchone()
    current_market_val = float(res[0]) if res else 0.0
    current_cost_basis = float(res[1]) if res else 0.0
    active_positions_count = int(res[2]) if res else 0

    current_exposure = max(current_market_val, current_cost_basis)
    max_exposure = float(settings.max_exposure_notional) if float(settings.max_exposure_notional) > 0 else 1.0
    exposure_pct = round(min(100.0, (current_exposure / max_exposure) * 100.0), 2)

    res_pnl = db.execute(text("SELECT COALESCE(SUM(unrealized_pnl), 0), COALESCE(SUM(realized_pnl), 0) FROM paper_positions")).fetchone()
    unrealized = float(res_pnl[0]) if res_pnl else 0.0
    realized = float(res_pnl[1]) if res_pnl else 0.0
    current_pnl = unrealized + realized
    current_loss = abs(current_pnl) if current_pnl < 0 else 0.0
    daily_loss_limit = float(settings.daily_loss_limit) if float(settings.daily_loss_limit) > 0 else 1.0
    daily_loss_pct = round(min(100.0, (current_loss / daily_loss_limit) * 100.0), 2)

    res_orders = db.execute(text("SELECT COUNT(*) FROM trading_executions WHERE executed_at >= NOW() - INTERVAL '1 MINUTE'")).fetchone()
    orders_last_min = int(res_orders[0]) if res_orders else 0
    max_orders_pm = int(settings.max_orders_per_minute) if settings.max_orders_per_minute > 0 else 1
    order_velocity_pct = round(min(100.0, (orders_last_min / max_orders_pm) * 100.0), 2)

    risk_status = "SAFE"
    if settings.kill_switch_active or exposure_pct >= 90.0 or daily_loss_pct >= 90.0 or order_velocity_pct >= 90.0:
        risk_status = "BREACH"
    elif exposure_pct >= 70.0 or daily_loss_pct >= 70.0 or order_velocity_pct >= 70.0:
        risk_status = "WARNING"

    return {
        "current_exposure_notional": current_exposure,
        "max_exposure_notional": max_exposure,
        "exposure_utilization_pct": exposure_pct,
        "current_daily_pnl": current_pnl,
        "current_daily_loss": current_loss,
        "daily_loss_limit": daily_loss_limit,
        "daily_loss_utilization_pct": daily_loss_pct,
        "current_orders_last_min": orders_last_min,
        "max_orders_per_minute": max_orders_pm,
        "order_velocity_pct": order_velocity_pct,
        "kill_switch_active": bool(settings.kill_switch_active),
        "active_positions_count": active_positions_count,
        "risk_status": risk_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }



@router.put("/settings", response_model=AdminRiskSettingsResponse, summary="Update platform risk settings")
def update_risk_settings(
    payload: AdminRiskSettingsUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    risk_repo: Annotated[TradingRiskRepository, Depends(get_risk_repository)],
    event_publisher: Annotated[TradingEventPublisher, Depends(get_trading_event_publisher)],
):
    settings = risk_repo.update_global_risk_settings(**payload.model_dump())
    audit_event(
        "RISK_SETTINGS_UPDATED",
        user_id=current_user.id,
        outcome="SUCCESS",
        max_order_quantity=str(settings.max_order_quantity),
        max_order_notional=str(settings.max_order_notional),
        max_position_quantity=str(settings.max_position_quantity),
        max_exposure_notional=str(settings.max_exposure_notional),
        max_orders_per_minute=settings.max_orders_per_minute,
        daily_loss_limit=str(settings.daily_loss_limit),
        max_drawdown_percent=str(settings.max_drawdown_percent),
    )
    event_publisher.emit(
        EventType.RISK_SETTINGS_UPDATED,
        user_id=current_user.id,
        payload={"updated_at": settings.updated_at, "kill_switch_active": settings.kill_switch_active},
    )
    return _serialize_settings(settings)


@router.get("/kill-switch", summary="Get Emergency Kill Switch Status")
def get_kill_switch_status(
    current_user: Annotated[User, Depends(get_current_active_user)],
    risk_repo: Annotated[TradingRiskRepository, Depends(get_risk_repository)],
) -> Dict[str, Any]:
    settings = risk_repo.get_global_risk_settings()
    return {
        "kill_switch_active": bool(settings.kill_switch_active),
        "status": "ACTIVE" if settings.kill_switch_active else "INACTIVE",
        "updated_at": settings.updated_at.isoformat() if settings.updated_at else datetime.now(timezone.utc).isoformat(),
        "user_id": str(current_user.id),
    }


@router.post("/kill-switch/activate", summary="Activate Emergency Kill Switch")
def activate_kill_switch(
    current_user: Annotated[User, Depends(get_current_active_user)],
    risk_repo: Annotated[TradingRiskRepository, Depends(get_risk_repository)],
    event_publisher: Annotated[TradingEventPublisher, Depends(get_trading_event_publisher)],
) -> Dict[str, Any]:
    # Platform-wide: deliberately do not scope this mutation to the admin user.
    updated_settings = risk_repo.set_kill_switch(active=True)
    audit_event("KILL_SWITCH_ACTIVATED", user_id=current_user.id, outcome="SUCCESS")
    event_publisher.emit(
        EventType.KILL_SWITCH_ACTIVATED,
        user_id=current_user.id,
        payload={"scope": "GLOBAL", "updated_at": updated_settings.updated_at},
    )
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
    event_publisher: Annotated[TradingEventPublisher, Depends(get_trading_event_publisher)],
) -> Dict[str, Any]:
    updated_settings = risk_repo.set_kill_switch(active=False)
    audit_event("KILL_SWITCH_DEACTIVATED", user_id=current_user.id, outcome="SUCCESS")
    event_publisher.emit(
        EventType.KILL_SWITCH_DEACTIVATED,
        user_id=current_user.id,
        payload={"scope": "GLOBAL", "updated_at": updated_settings.updated_at},
    )
    return {
        "kill_switch_active": False,
        "status": "INACTIVE",
        "message": "Emergency Kill Switch has been DEACTIVATED. Normal trading conditions restored.",
        "updated_at": updated_settings.updated_at.isoformat() if updated_settings.updated_at else datetime.now(timezone.utc).isoformat(),
    }
