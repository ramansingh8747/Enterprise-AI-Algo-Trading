from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config.settings import settings
from app.schemas.live_activation import LiveActivationResponse
from app.services.live_readiness_service import LiveReadinessService
from app.services.pre_live_operational_service import PreLiveOperationalService
from app.services.interfaces.broker_session_service import BrokerSessionServiceInterface


class LiveActivationService:
    """Final safety gate. It authorizes a future activation but never enables LIVE itself."""

    def __init__(self, db: Session, session_service: BrokerSessionServiceInterface) -> None:
        self.db = db
        self.session_service = session_service

    async def authorize(self, user_id: UUID, broker_id: UUID, confirmed: bool) -> LiveActivationResponse:
        readiness = LiveReadinessService(self.db, self.session_service)
        result = await readiness.verify(user_id, broker_id, probe_broker=True)
        operational = await PreLiveOperationalService(self.db, self.session_service).verify(
            user_id=user_id, broker_id=broker_id
        )
        blocking = [f"readiness.{check.name}: {check.message}" for check in result.checks if check.status == "FAIL"]
        blocking.extend(
            f"operational.{check.name}: {check.message}"
            for check in operational.checks
            if check.status == "FAIL"
        )

        if result.verdict != "LIVE_READY":
            blocking.append(f"Readiness verdict is {result.verdict}; all checks must PASS before activation.")
        if operational.verdict != "READY_FOR_CONTROLLED_LIVE_ACTIVATION":
            blocking.append(
                f"Pre-live operational verdict is {operational.verdict}; all hardening checks must pass before activation."
            )
        if not confirmed:
            blocking.append("Explicit administrator confirmation is required for controlled activation.")

        instructions = [
            "Keep LIVE_TRADING_ENABLED=false until the activation window is approved.",
            "Set LIVE_TRADING_ENABLED=true only in the controlled production environment.",
            "Keep STRATEGY_SCHEDULER_ENABLED=false until broker/session/risk checks are re-run after activation.",
            "Run the readiness gate again immediately before starting any LIVE strategy.",
            "Do not use this endpoint as an order execution endpoint; it never places, modifies, or cancels orders.",
        ]

        return LiveActivationResponse(
            verdict="ACTIVATION_AUTHORIZED" if not blocking else "ACTIVATION_BLOCKED",
            broker_id=str(broker_id),
            verified_at=datetime.now(timezone.utc).isoformat(),
            confirmation_required=not confirmed,
            order_execution_attempted=False,
            live_trading_enabled=settings.LIVE_TRADING_ENABLED,
            instructions=instructions,
            blocking_reasons=blocking,
        )
