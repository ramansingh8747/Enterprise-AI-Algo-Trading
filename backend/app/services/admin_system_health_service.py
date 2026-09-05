from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config.settings import settings
from app.database.models.broker import Broker
from app.database.models.broker_session import BrokerSession
from app.schemas.admin_system_health import (
    AdminSystemHealthResponse,
    BrokerHealthComponent,
    SystemHealthComponent,
)


class AdminSystemHealthService:
    """Read-only system health aggregation for the ADMIN control center."""

    def __init__(self, db: Session, redis_transport=None, websocket_manager=None) -> None:
        self.db = db
        self.redis_transport = redis_transport
        self.websocket_manager = websocket_manager

    def _component(
        self,
        name: str,
        status: str,
        message: str,
        checked_at: datetime,
    ) -> SystemHealthComponent:
        return SystemHealthComponent(
            name=name,
            status=status,
            message=message,
            checked_at=checked_at,
        )

    def _check_database(self, checked_at: datetime) -> SystemHealthComponent:
        try:
            self.db.execute(text("SELECT 1"))
            return self._component("Database", "UP", "PostgreSQL connection is healthy.", checked_at)
        except Exception as exc:
            return self._component("Database", "DOWN", f"Database health check failed: {exc.__class__.__name__}.", checked_at)

    def _check_redis(self, checked_at: datetime) -> SystemHealthComponent:
        if not settings.REDIS_EVENT_BUS_ENABLED:
            return self._component("Redis", "DISABLED", "Redis Event Bus is disabled by configuration.", checked_at)

        if self.redis_transport is None:
            return self._component("Redis", "UNKNOWN", "Redis Event Bus is enabled but transport is not initialized.", checked_at)

        if getattr(self.redis_transport, "is_connected", False):
            return self._component("Redis", "UP", "Redis Pub/Sub transport is connected.", checked_at)

        return self._component("Redis", "DOWN", "Redis Pub/Sub transport is not connected.", checked_at)

    def _check_websocket(self, checked_at: datetime) -> SystemHealthComponent:
        if self.websocket_manager is None:
            return self._component("WebSocket", "UNKNOWN", "WebSocket connection manager is unavailable.", checked_at)

        active_connections = sum(
            len(connections)
            for connections in getattr(self.websocket_manager, "active_connections", {}).values()
        )
        return self._component(
            "WebSocket",
            "UP",
            f"WebSocket service is available ({active_connections} active connection(s)).",
            checked_at,
        )

    def _check_api(self, checked_at: datetime) -> SystemHealthComponent:
        return self._component("API", "UP", "FastAPI application is serving requests.", checked_at)

    def _broker_health(self, checked_at: datetime) -> list[BrokerHealthComponent]:
        brokers = self.db.query(Broker).order_by(Broker.broker_name.asc()).all()
        now = datetime.now(timezone.utc)
        result: list[BrokerHealthComponent] = []

        for broker in brokers:
            if not broker.is_active:
                result.append(
                    BrokerHealthComponent(
                        broker_id=broker.id,
                        broker_name=broker.broker_name,
                        broker_type=broker.broker_type,
                        status="DISABLED",
                        message="Broker configuration is inactive.",
                        checked_at=checked_at,
                    )
                )
                continue

            active_session = (
                self.db.query(BrokerSession)
                .filter(
                    BrokerSession.broker_id == broker.id,
                    BrokerSession.expires_at > now,
                )
                .first()
            )

            if active_session:
                status = "UP"
                message = "An active broker session is present."
            else:
                status = "DOWN"
                message = "No active broker session is available."

            result.append(
                BrokerHealthComponent(
                    broker_id=broker.id,
                    broker_name=broker.broker_name,
                    broker_type=broker.broker_type,
                    status=status,
                    message=message,
                    checked_at=checked_at,
                )
            )

        return result

    def check(self) -> AdminSystemHealthResponse:
        checked_at = datetime.now(timezone.utc)
        components = [
            self._check_api(checked_at),
            self._check_database(checked_at),
            self._check_redis(checked_at),
            self._check_websocket(checked_at),
        ]
        brokers = self._broker_health(checked_at)

        # API and database are the core availability dependencies. Optional or
        # deliberately disabled infrastructure must not falsely mark the whole
        # platform as DOWN during PAPER/local operation.
        core_statuses = [
            component.status
            for component in components
            if component.name in {"API", "Database"}
        ]
        supporting_statuses = [
            component.status
            for component in components
            if component.name not in {"API", "Database"}
        ]

        if any(status == "DOWN" for status in core_statuses):
            overall_status = "DOWN"
        elif any(status == "UNKNOWN" for status in supporting_statuses):
            overall_status = "DEGRADED"
        elif settings.LIVE_TRADING_ENABLED and any(
            broker.status in {"DOWN", "DISABLED"} for broker in brokers
        ):
            # Broker connectivity becomes operationally critical only when
            # LIVE execution is explicitly enabled. LIVE remains OFF by design
            # in the current environment.
            overall_status = "DOWN"
        elif any(status == "DOWN" for status in supporting_statuses):
            overall_status = "DEGRADED"
        else:
            # DISABLED components (for example Redis Event Bus in local/PAPER
            # mode) are informational and do not imply platform failure.
            overall_status = "UP"

        return AdminSystemHealthResponse(
            checked_at=checked_at,
            overall_status=overall_status,
            live_trading_enabled=settings.LIVE_TRADING_ENABLED,
            strategy_scheduler_enabled=settings.STRATEGY_SCHEDULER_ENABLED,
            components=components,
            brokers=brokers,
        )
