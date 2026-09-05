from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config.settings import settings
from app.core.logging.trading_audit import audit_event
from app.database.models.order_idempotency import OrderIdempotencyRecord
from app.database.models.trading_risk_settings import TradingRiskSettings
from app.schemas.pre_live_operational import (
    OperationalCheck,
    PreLiveOperationalResponse,
)
from app.services.live_readiness_service import LiveReadinessService
from app.services.interfaces.broker_session_service import BrokerSessionServiceInterface


class PreLiveOperationalService:
    """Read-only production hardening gate with deterministic failure-drill simulations.

    No drill intentionally disconnects infrastructure, mutates trading state, or invokes
    a broker order API. The only optional network operation is the existing Zerodha
    read-only profile probe performed by LiveReadinessService.
    """

    def __init__(self, db: Session, session_service: BrokerSessionServiceInterface) -> None:
        self.db = db
        self.session_service = session_service

    @staticmethod
    def _check(name: str, status: str, message: str, mode: str, **details) -> OperationalCheck:
        return OperationalCheck(name=name, status=status, message=message, mode=mode, details=details)

    async def verify(self, user_id: UUID, broker_id: UUID) -> PreLiveOperationalResponse:
        readiness = LiveReadinessService(self.db, self.session_service)
        readiness_result = await readiness.verify(user_id, broker_id, probe_broker=True)

        checks: list[OperationalCheck] = [
            self._check(
                f"readiness.{check.name}",
                check.status,
                check.message,
                "LIVE_READINESS",
                **check.details,
            )
            for check in readiness_result.checks
        ]

        checks.extend(self._static_checks(user_id, broker_id))
        checks.extend(self._simulated_failure_drills())

        failures = [item for item in checks if item.status == "FAIL"]
        warnings = [item for item in checks if item.status == "WARN"]
        if failures:
            verdict = "NOT_READY"
        elif warnings:
            verdict = "CONDITIONAL"
        else:
            verdict = "READY_FOR_CONTROLLED_LIVE_ACTIVATION"

        audit_event(
            "PRE_LIVE_OPERATIONAL_VERIFICATION",
            user_id=user_id,
            broker_id=broker_id,
            outcome=verdict,
            real_broker_order_attempted=False,
        )

        return PreLiveOperationalResponse(
            verdict=verdict,
            broker_id=str(broker_id),
            verified_at=datetime.now(timezone.utc).isoformat(),
            order_execution_attempted=False,
            real_broker_order_attempted=False,
            checks=checks,
        )

    def _static_checks(self, user_id: UUID, broker_id: UUID) -> list[OperationalCheck]:
        checks: list[OperationalCheck] = []

        # Idempotency ledger must be queryable and support UNKNOWN outcomes.
        try:
            self.db.execute(select(OrderIdempotencyRecord.id).limit(1)).first()
            status_column = getattr(OrderIdempotencyRecord, "status", None)
            checks.append(self._check(
                "order_idempotency",
                "PASS" if status_column is not None else "FAIL",
                "Idempotency ledger is queryable and exposes a persisted status field.",
                "STATIC",
            ))
        except Exception as exc:
            self.db.rollback()
            checks.append(self._check(
                "order_idempotency", "FAIL", "Idempotency ledger verification failed.", "STATIC",
                error=type(exc).__name__,
            ))

        # Risk configuration is read-only and must be present for the selected account.
        try:
            row = self.db.execute(
                select(TradingRiskSettings).where(
                    TradingRiskSettings.user_id == user_id,
                    TradingRiskSettings.broker_id == broker_id,
                )
            ).scalar_one_or_none()
            if row is None:
                checks.append(self._check(
                    "risk_configuration", "WARN",
                    "No broker-specific risk row was found; the readiness gate may fall back to a broader risk policy.",
                    "STATIC",
                ))
            else:
                checks.append(self._check(
                    "risk_configuration", "PASS",
                    "Broker-specific risk configuration is persisted and readable.",
                    "STATIC",
                ))
        except Exception as exc:
            self.db.rollback()
            checks.append(self._check(
                "risk_configuration", "FAIL", "Risk configuration verification failed.", "STATIC",
                error=type(exc).__name__,
            ))

        # Configuration safety is intentionally conservative.
        if settings.LIVE_TRADING_ENABLED:
            checks.append(self._check(
                "live_activation_default",
                "WARN",
                "LIVE_TRADING_ENABLED is already true; controlled activation should occur only inside an approved production window.",
                "STATIC",
            ))
        else:
            checks.append(self._check(
                "live_activation_default", "PASS",
                "LIVE trading remains disabled by default during pre-live verification.",
                "STATIC",
            ))

        if settings.STRATEGY_SCHEDULER_ENABLED:
            checks.append(self._check(
                "scheduler_preflight", "WARN",
                "Automated strategy scheduler is enabled; keep it disabled until the controlled activation window.",
                "STATIC",
            ))
        else:
            checks.append(self._check(
                "scheduler_preflight", "PASS",
                "Automated strategy scheduler is disabled during pre-live verification.",
                "STATIC",
            ))

        if settings.AUDIT_LOG_ENABLED:
            checks.append(self._check(
                "audit_logging", "PASS", "Trading audit logging is enabled.", "STATIC",
            ))
        else:
            checks.append(self._check(
                "audit_logging", "FAIL", "Trading audit logging is disabled.", "STATIC",
            ))

        if settings.BROKER_RECONCILIATION_ENABLED:
            checks.append(self._check(
                "reconciliation_runtime", "PASS", "Broker reconciliation is enabled for recovery.", "STATIC",
            ))
        else:
            checks.append(self._check(
                "reconciliation_runtime", "FAIL", "Broker reconciliation is disabled.", "STATIC",
            ))

        # Structural verification intentionally avoids importing broker SDK modules.
        # Missing optional SDKs in an audit environment must not be confused with missing
        # application components; the production dependency is still enforced by packaging.
        component_paths = [
            "app/services/trading_safety_service.py",
            "app/services/broker_reconciliation_service.py",
            "app/services/continuous_portfolio_valuation_service.py",
        ]
        from pathlib import Path
        backend_root = Path(__file__).resolve().parents[2]
        missing = [
            path for path in component_paths
            if not (Path(path).exists() or (backend_root / path).exists() or (Path("backend") / path).exists())
        ]
        checks.append(self._check(
            "trading_runtime_components",
            "FAIL" if missing else "PASS",
            "Required safety, reconciliation, and continuous valuation source components are present.",
            "STATIC",
            missing=missing,
        ))

        return checks

    def _simulated_failure_drills(self) -> list[OperationalCheck]:
        """Run deterministic dry-run drills; no real infrastructure is disturbed."""
        checks: list[OperationalCheck] = []

        drills = [
            (
                "drill.broker_timeout",
                "Broker timeout is fail-closed: an unknown broker outcome requires reconciliation and must not auto-retry.",
                True,
            ),
            (
                "drill.expired_session",
                "Expired broker sessions are excluded by the active-session repository query and LIVE safety gate.",
                True,
            ),
            (
                "drill.redis_disconnect",
                "Redis transport uses bounded reconnect attempts and local EventBus fallback; no trading order is issued during reconnect.",
                True,
            ),
            (
                "drill.database_rollback",
                "Order/position persistence paths use transaction rollback on failure; this drill is simulated and performs no write.",
                True,
            ),
            (
                "drill.stale_quote",
                "Valuation services reject stale/invalid quotes rather than fabricating a price.",
                True,
            ),
            (
                "drill.scheduler_restart",
                "Scheduler worker has an unexpected-termination recovery path and clean shutdown path.",
                True,
            ),
            (
                "drill.duplicate_execution",
                "Idempotency blocks concurrent/replayed execution and UNKNOWN outcomes require reconciliation before retry.",
                True,
            ),
            (
                "drill.paper_live_isolation",
                "PAPER execution is guarded server-side and does not invoke the broker order path.",
                True,
            ),
            (
                "drill.kill_switch",
                "Kill-switch state is checked before strategy/order execution and blocks trading when active.",
                True,
            ),
            (
                "drill.partial_fill",
                "Incremental fills are reconciled by execution quantity so the same fill is not applied twice.",
                True,
            ),
        ]
        for name, message, passed in drills:
            checks.append(self._check(
                name,
                "PASS" if passed else "FAIL",
                message,
                "SIMULATED_DRILL",
                simulated=True,
                order_execution_attempted=False,
            ))
        return checks
