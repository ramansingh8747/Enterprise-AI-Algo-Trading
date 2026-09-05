"""Structured audit logging for safety-critical trading operations.

No credentials, access tokens, or order secrets are ever written by this helper.
The application logger is the sink so deployments can route these records to a
durable centralized log/audit platform without coupling trading transactions to
a second database transaction.
"""
import logging
from typing import Any, Optional
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from uuid import UUID

from app.core.config.settings import settings

logger = logging.getLogger("trading.audit")

_SENSITIVE = {"password", "secret", "token", "access_token", "api_key", "api_secret", "jwt"}

def _sanitize(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: ("[REDACTED]" if str(k).lower() in _SENSITIVE else _sanitize(v)) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_sanitize(v) for v in value]
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, (datetime,)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, Enum):
        return value.value
    return value

def audit_event(action: str, *, user_id: Optional[UUID] = None,
                broker_id: Optional[UUID] = None, outcome: str = "INFO",
                **details: Any) -> None:
    """Write a structured audit record to logs, durable DB storage and admin events.

    Persistence is best-effort by design: audit infrastructure must never make a
    trading transaction fail. Sensitive fields are sanitized before either sink.
    """
    if not settings.AUDIT_LOG_ENABLED:
        return

    safe_details = _sanitize(details)
    logger.info(
        "TRADING_AUDIT action=%s outcome=%s user_id=%s broker_id=%s details=%s",
        action, outcome, user_id, broker_id, safe_details,
    )

    try:
        from app.database.session import SessionLocal
        from app.database.models.audit_event import AuditEvent
        with SessionLocal() as db:
            try:
                db.add(AuditEvent(
                    action=action,
                    outcome=outcome,
                    user_id=user_id,
                    broker_id=broker_id,
                    resource_type=safe_details.get("resource_type") if isinstance(safe_details, dict) else None,
                    resource_id=str(safe_details.get("resource_id")) if isinstance(safe_details, dict) and safe_details.get("resource_id") is not None else None,
                    details=safe_details if isinstance(safe_details, dict) else {"value": safe_details},
                    occurred_at=datetime.now(timezone.utc),
                ))
                db.commit()
            except Exception:
                db.rollback()
                raise
    except Exception:
        logger.debug("Failed to persist audit event action=%s (non-fatal)", action)

    try:
        import asyncio
        from app.dependencies.event_bus import get_event_bus
        from app.services.event_bus.models import Event, EventType
        from app.services.event_bus.topics import Topic
        from uuid import uuid4

        event = Event(
            event_id=uuid4(),
            event_type=EventType.AUDIT_EVENT,
            timestamp=datetime.now(timezone.utc),
            user_id=user_id,
            broker_id=broker_id,
            payload={"action": action, "outcome": outcome, "details": safe_details},
        )
        bus = get_event_bus()
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(bus.publish(Topic.admin_events(), event))
        except RuntimeError:
            pass
    except Exception:
        logger.exception("Failed to publish audit event action=%s", action)

