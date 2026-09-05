from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database.models.audit_event import AuditEvent
from app.database.models.broker import Broker
from app.database.models.user import User


class AdminAuditService:
    """Read-only admin access to the durable audit trail."""

    def list_events(
        self,
        db: Session,
        *,
        page: int = 1,
        page_size: int = 25,
        action: Optional[str] = None,
        outcome: Optional[str] = None,
        user_id: Optional[UUID] = None,
        broker_id: Optional[UUID] = None,
        search: Optional[str] = None,
        since_hours: Optional[int] = None,
    ):
        query = (
            db.query(AuditEvent, User.full_name, User.username, Broker.name)
            .outerjoin(User, User.id == AuditEvent.user_id)
            .outerjoin(Broker, Broker.id == AuditEvent.broker_id)
        )
        if action:
            query = query.filter(AuditEvent.action == action)
        if outcome:
            query = query.filter(AuditEvent.outcome == outcome)
        if user_id:
            query = query.filter(AuditEvent.user_id == user_id)
        if broker_id:
            query = query.filter(AuditEvent.broker_id == broker_id)
        if search:
            term = f"%{search.strip()}%"
            query = query.filter(or_(
                AuditEvent.action.ilike(term),
                AuditEvent.resource_type.ilike(term),
                AuditEvent.resource_id.ilike(term),
                User.full_name.ilike(term),
                User.username.ilike(term),
                Broker.name.ilike(term),
            ))
        if since_hours is not None:
            cutoff = datetime.now(timezone.utc) - timedelta(hours=since_hours)
            query = query.filter(AuditEvent.occurred_at >= cutoff)

        total = query.count()
        rows = query.order_by(AuditEvent.occurred_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
        return total, rows

    def get_event(self, db: Session, event_id: UUID):
        return (
            db.query(AuditEvent, User.full_name, User.username, Broker.name)
            .outerjoin(User, User.id == AuditEvent.user_id)
            .outerjoin(Broker, Broker.id == AuditEvent.broker_id)
            .filter(AuditEvent.id == event_id)
            .first()
        )

    def summary(self, db: Session, *, since_hours: int = 24):
        cutoff = datetime.now(timezone.utc) - timedelta(hours=since_hours)
        q = db.query(AuditEvent).filter(AuditEvent.occurred_at >= cutoff)
        total = q.count()
        successes = q.filter(AuditEvent.outcome.in_(["SUCCESS", "PASS", "ALLOWED"])).count()
        blocked = q.filter(AuditEvent.outcome.in_(["BLOCKED", "DENIED", "FAIL"])).count()
        failures = q.filter(AuditEvent.outcome.in_(["ERROR", "FAILED"])).count()
        info = q.filter(AuditEvent.outcome.in_(["INFO"])).count()
        last = q.order_by(AuditEvent.occurred_at.desc()).first()
        return {"total": total, "successes": successes, "blocked": blocked, "failures": failures, "info": info, "last_event_at": last.occurred_at if last else None}
