from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config.settings import settings
from app.database.models.broker import Broker
from app.database.repositories.trading_risk_repository import TradingRiskRepository
from app.schemas.admin_live_gate import AdminLiveGateResponse
from app.schemas.live_activation import LiveActivationResponse
from app.services.live_readiness_service import LiveReadinessService
from app.services.pre_live_operational_service import PreLiveOperationalService
from app.services.interfaces.broker_session_service import BrokerSessionServiceInterface


class AdminLiveGateService:
    """Aggregates the existing LIVE readiness and pre-live operational gates.

    This service is read-only. It never enables LIVE trading and never invokes an
    order placement, modification, or cancellation operation.
    """

    def __init__(self, db: Session, session_service: BrokerSessionServiceInterface) -> None:
        self.db = db
        self.session_service = session_service

    async def evaluate(self, user_id: UUID, broker_id: UUID, probe_broker: bool = True) -> AdminLiveGateResponse:
        readiness = await LiveReadinessService(self.db, self.session_service).verify(
            user_id=user_id,
            broker_id=broker_id,
            probe_broker=probe_broker,
        )
        operational = await PreLiveOperationalService(self.db, self.session_service).verify(
            user_id=user_id,
            broker_id=broker_id,
        )
        risk = TradingRiskRepository(self.db).get_global_risk_settings()

        if readiness.verdict == "LIVE_READY" and operational.verdict == "READY_FOR_CONTROLLED_LIVE_ACTIVATION":
            overall = "READY_FOR_CONTROLLED_LIVE_ACTIVATION"
        elif readiness.verdict == "NOT_READY" or operational.verdict == "NOT_READY":
            overall = "NOT_READY"
        else:
            overall = "CONDITIONAL"

        if not settings.LIVE_TRADING_ENABLED:
            execution_state = "DISABLED"
        elif overall != "READY_FOR_CONTROLLED_LIVE_ACTIVATION" or risk.kill_switch_active:
            execution_state = "BLOCKED"
        else:
            execution_state = "READY"

        return AdminLiveGateResponse(
            broker_id=str(broker_id),
            verified_at=datetime.now(timezone.utc).isoformat(),
            overall_verdict=overall,
            live_trading_enabled=settings.LIVE_TRADING_ENABLED,
            strategy_scheduler_enabled=settings.STRATEGY_SCHEDULER_ENABLED,
            kill_switch_active=bool(risk.kill_switch_active),
            execution_state=execution_state,
            readiness=readiness,
            operational=operational,
            safety_message=(
                "LIVE execution is OFF. This gate is verification-only and cannot enable LIVE trading."
                if not settings.LIVE_TRADING_ENABLED
                else "LIVE execution remains blocked unless every server-side safety gate is satisfied."
            ),
        )
