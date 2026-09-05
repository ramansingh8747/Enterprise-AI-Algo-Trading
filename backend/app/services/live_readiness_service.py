from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config.settings import settings
from app.database.models.broker import Broker
from app.database.models.broker_session import BrokerSession
from app.database.models.order_idempotency import OrderIdempotencyRecord
from app.database.models.trading_risk_settings import TradingRiskSettings
from app.schemas.live_readiness import LiveReadinessResponse, ReadinessCheck
from app.services.interfaces.broker_session_service import BrokerSessionServiceInterface


class LiveReadinessService:
    """Non-invasive pre-production gate. It never places, modifies, or cancels orders."""

    SUPPORTED_LIVE_PROVIDERS = {"zerodha"}

    def __init__(self, db: Session, session_service: BrokerSessionServiceInterface) -> None:
        self.db = db
        self.session_service = session_service

    def _check(self, name: str, status: str, message: str, **details: Any) -> ReadinessCheck:
        return ReadinessCheck(name=name, status=status, message=message, details=details)

    def _get_effective_risk(self, user_id: UUID, broker_id: UUID) -> TradingRiskSettings | None:
        stmt = select(TradingRiskSettings).where(
            TradingRiskSettings.user_id == user_id,
            TradingRiskSettings.broker_id == broker_id,
        )
        row = self.db.execute(stmt).scalar_one_or_none()
        if row:
            return row
        stmt = select(TradingRiskSettings).where(
            TradingRiskSettings.user_id == user_id,
            TradingRiskSettings.broker_id.is_(None),
        )
        row = self.db.execute(stmt).scalar_one_or_none()
        if row:
            return row
        stmt = select(TradingRiskSettings).where(
            TradingRiskSettings.user_id.is_(None),
            TradingRiskSettings.broker_id.is_(None),
        )
        return self.db.execute(stmt).scalar_one_or_none()

    async def verify(self, user_id: UUID, broker_id: UUID, probe_broker: bool = False) -> LiveReadinessResponse:
        checks: list[ReadinessCheck] = []
        verified_at = datetime.now(timezone.utc).isoformat()

        # DB health is intentionally read-only.
        try:
            self.db.execute(text("SELECT 1"))
            checks.append(self._check("database", "PASS", "Database connectivity is healthy."))
            self.db.execute(select(OrderIdempotencyRecord.id).limit(1)).first()
            checks.append(self._check("idempotency_ledger", "PASS", "Order idempotency ledger is queryable."))
        except Exception as exc:
            self.db.rollback()
            checks.append(self._check("database", "FAIL", "Database readiness check failed.", error=type(exc).__name__))

        broker = self.db.get(Broker, broker_id)
        if not broker:
            checks.append(self._check("broker_configuration", "FAIL", "Broker account was not found."))
            return self._response(broker_id, verified_at, checks)

        if not broker.is_active:
            checks.append(self._check("broker_configuration", "FAIL", "Broker account is disabled."))
        else:
            checks.append(self._check("broker_configuration", "PASS", "Broker account is active.", provider=broker.broker_type))

        provider_name = broker.broker_type.lower().strip()
        if provider_name not in self.SUPPORTED_LIVE_PROVIDERS:
            checks.append(self._check(
                "broker_provider",
                "FAIL",
                "Broker provider is not approved for LIVE readiness; only the implemented Zerodha path is eligible.",
                provider=provider_name,
            ))
        else:
            # Readiness deliberately does not instantiate or call a broker SDK.
            # Provider eligibility is based on the approved production registry.
            checks.append(self._check(
                "broker_provider",
                "PASS",
                "Broker provider is eligible for LIVE readiness; no broker network call was made.",
                provider=provider_name,
            ))

        if settings.LIVE_TRADING_ENABLED:
            checks.append(self._check("live_configuration", "PASS", "LIVE_TRADING_ENABLED is explicitly enabled."))
        else:
            checks.append(self._check(
                "live_configuration", "WARN",
                "LIVE_TRADING_ENABLED is false. This is the required safe pre-production default.",
            ))

        if settings.DEBUG or settings.ENVIRONMENT.lower() != "production":
            checks.append(self._check(
                "production_configuration", "WARN",
                "Application is not running with production configuration (DEBUG=false and ENVIRONMENT=production).",
                environment=settings.ENVIRONMENT,
                debug=settings.DEBUG,
            ))
        else:
            checks.append(self._check("production_configuration", "PASS", "Production configuration is active."))

        if settings.STRATEGY_SCHEDULER_ENABLED:
            checks.append(self._check(
                "scheduler_gate", "WARN",
                "Automated strategy scheduler is enabled. Keep it disabled during readiness verification unless intentionally controlled.",
            ))
        else:
            checks.append(self._check("scheduler_gate", "PASS", "Automated strategy scheduler is disabled during readiness verification."))

        if settings.BROKER_RECONCILIATION_ENABLED:
            checks.append(self._check("reconciliation", "PASS", "Broker reconciliation is enabled."))
        else:
            checks.append(self._check("reconciliation", "FAIL", "Broker reconciliation is disabled; LIVE readiness requires reconciliation."))

        if settings.AUDIT_LOG_ENABLED:
            checks.append(self._check("audit_logging", "PASS", "Trading audit logging is enabled."))
        else:
            checks.append(self._check("audit_logging", "FAIL", "Trading audit logging is disabled; LIVE readiness requires audit logging."))

        risk = self._get_effective_risk(user_id, broker_id)
        if risk is None:
            checks.append(self._check("risk_limits", "FAIL", "No persisted risk configuration exists for this user/broker."))
        else:
            invalid = []
            for field in ("max_order_quantity", "max_order_notional", "max_position_quantity", "max_exposure_notional", "daily_loss_limit"):
                if getattr(risk, field) <= 0:
                    invalid.append(field)
            if risk.max_orders_per_minute <= 0:
                invalid.append("max_orders_per_minute")
            if invalid:
                checks.append(self._check("risk_limits", "FAIL", "One or more risk limits are invalid.", invalid_fields=invalid))
            elif risk.kill_switch_active:
                checks.append(self._check("risk_limits", "FAIL", "Kill switch is ACTIVE; LIVE readiness is blocked."))
            else:
                checks.append(self._check(
                    "risk_limits", "PASS", "Risk limits are present, positive, and kill switch is inactive.",
                    max_order_quantity=str(risk.max_order_quantity),
                    max_order_notional=str(risk.max_order_notional),
                    max_position_quantity=str(risk.max_position_quantity),
                    max_exposure_notional=str(risk.max_exposure_notional),
                    max_orders_per_minute=risk.max_orders_per_minute,
                    daily_loss_limit=str(risk.daily_loss_limit),
                ))

        session = self.session_service.get_active_session(user_id, broker_id)
        if session:
            checks.append(self._check(
                "broker_session", "PASS", "An unexpired broker session is available.",
                expires_at=session.expires_at.isoformat(),
            ))
        else:
            checks.append(self._check(
                "broker_session", "WARN",
                "No active broker session is available. LIVE readiness remains conditional until authentication is completed.",
            ))

        if probe_broker:
            if not session:
                checks.append(self._check("broker_connectivity", "FAIL", "Broker connectivity probe requires an active session."))
            elif provider_name != "zerodha":
                checks.append(self._check("broker_connectivity", "FAIL", "Only Zerodha has a live read-only connectivity probe."))
            else:
                try:
                    from app.brokers.providers.zerodha.zerodha_broker import ZerodhaBroker
                    provider = ZerodhaBroker(session_service=self.session_service, broker_id=broker_id)
                    provider.set_user_context(user_id)
                    profile = provider.get_profile()
                    checks.append(self._check(
                        "broker_connectivity", "PASS",
                        "Zerodha authenticated read-only profile probe succeeded; no order API was called.",
                        account_id=profile.account_id,
                    ))
                except Exception as exc:
                    checks.append(self._check(
                        "broker_connectivity", "FAIL",
                        "Zerodha read-only connectivity probe failed.",
                        error=type(exc).__name__,
                    ))
        else:
            checks.append(self._check(
                "broker_connectivity", "WARN",
                "Broker network connectivity was not probed. Use the controlled session verification action before activation.",
            ))

        if settings.REDIS_EVENT_BUS_ENABLED and settings.REDIS_URL:
            checks.append(self._check("event_bus", "PASS", "Redis EventBus is configured."))
        elif settings.REDIS_EVENT_BUS_ENABLED:
            checks.append(self._check("event_bus", "FAIL", "Redis EventBus is enabled but REDIS_URL is missing."))
        else:
            checks.append(self._check(
                "event_bus", "WARN",
                "Redis EventBus is disabled. Local EventBus remains available; enable Redis for multi-worker production broadcasting.",
            ))

        # This flag is explicit and immutable for the response contract: the gate never touches broker order APIs.
        return self._response(broker_id, verified_at, checks)

    def _response(self, broker_id: UUID, verified_at: str, checks: list[ReadinessCheck]) -> LiveReadinessResponse:
        failed = [c for c in checks if c.status == "FAIL"]
        warnings = [c for c in checks if c.status == "WARN"]
        if failed:
            verdict = "NOT_READY"
        elif warnings:
            verdict = "CONDITIONAL"
        else:
            verdict = "LIVE_READY"
        return LiveReadinessResponse(
            verdict=verdict,
            broker_id=str(broker_id),
            verified_at=verified_at,
            order_execution_attempted=False,
            checks=checks,
        )
