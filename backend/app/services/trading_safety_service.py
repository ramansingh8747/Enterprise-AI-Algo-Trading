"""Unified server-side trading safety and risk orchestration."""

import logging
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from app.core.config.settings import settings
from app.exceptions.broker_exceptions import BrokerSessionExpiredException
from app.exceptions.risk_exceptions import TradingHaltedException
from app.services.interfaces.broker_session_service import BrokerSessionServiceInterface
from app.services.risk_engine import RiskEngine
from app.core.logging.trading_audit import audit_event
from app.brokers.base.broker_types import BrokerOrderRequest

logger = logging.getLogger(__name__)


class TradingSafetyService:
    """
    Single server-side safety boundary for strategy and direct broker execution.

    PAPER orders are validated by the same RiskEngine but are never allowed to
    cross into BrokerOrderService. LIVE execution is fail-closed unless the
    application explicitly enables live trading and an unexpired broker session
    exists for the authenticated user/broker pair.
    """

    def __init__(
        self,
        risk_engine: RiskEngine,
        session_service: BrokerSessionServiceInterface,
    ) -> None:
        self._risk_engine = risk_engine
        self._session_service = session_service

    def validate_mode(self, execution_mode: str) -> str:
        mode = str(execution_mode).upper().strip()
        if mode not in {"PAPER", "LIVE"}:
            raise TradingHaltedException(
                f"Unsupported trading execution mode '{execution_mode}'."
            )
        return mode

    def validate_paper_execution(self) -> None:
        """PAPER execution has no broker/session side effect by design."""
        return None

    def validate_live_execution(self, user_id: UUID, broker_id: UUID) -> None:
        """Fail closed before any live broker SDK operation."""
        if not settings.LIVE_TRADING_ENABLED:
            audit_event("LIVE_TRADING_GATE", user_id=user_id, broker_id=broker_id, outcome="BLOCKED", reason="LIVE_TRADING_DISABLED")
            logger.warning(
                "LIVE trading blocked: LIVE_TRADING_ENABLED=false user_id=%s broker_id=%s",
                user_id,
                broker_id,
            )
            raise TradingHaltedException(
                "LIVE trading is disabled by server configuration. "
                "Enable LIVE_TRADING_ENABLED explicitly before placing live orders."
            )

        session = self._session_service.get_active_session(user_id, broker_id)
        if not session:
            audit_event("LIVE_TRADING_GATE", user_id=user_id, broker_id=broker_id, outcome="BLOCKED", reason="BROKER_SESSION_UNAVAILABLE")
            raise BrokerSessionExpiredException(
                "No active broker session is available for LIVE trading."
            )
        audit_event("LIVE_TRADING_GATE", user_id=user_id, broker_id=broker_id, outcome="ALLOWED")

    def validate_order(
        self,
        user_id: UUID,
        broker_id: UUID,
        request: BrokerOrderRequest,
        execution_mode: str,
        *,
        current_positions: Optional[List[Dict[str, Any]]] = None,
        daily_pnl: Optional[Decimal] = None,
        current_exposure_notional: Optional[Decimal] = None,
    ) -> None:
        """Apply mode isolation, LIVE gate and all available server-side risk checks."""
        mode = self.validate_mode(execution_mode)

        if mode == "LIVE":
            self.validate_live_execution(user_id=user_id, broker_id=broker_id)
        else:
            self.validate_paper_execution()

        self._risk_engine.validate_order(
            user_id=user_id,
            broker_id=broker_id,
            request=request,
            current_positions=current_positions,
            daily_pnl=daily_pnl,
            current_exposure_notional=current_exposure_notional,
        )
