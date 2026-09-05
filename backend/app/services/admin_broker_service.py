from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.database.models.broker import Broker
from app.database.models.broker_session import BrokerSession
from app.schemas.admin_brokers import (
    AdminBrokerItem,
    AdminBrokerListResponse,
    AdminBrokerSessionSummary,
)


class AdminBrokerService:
    """Read-only broker/session aggregation for the ADMIN control center."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def list_brokers(self) -> AdminBrokerListResponse:
        now = datetime.now(timezone.utc)
        brokers = self.db.query(Broker).order_by(Broker.broker_name.asc()).all()
        items: list[AdminBrokerItem] = []

        for broker in brokers:
            sessions = (
                self.db.query(BrokerSession)
                .filter(BrokerSession.broker_id == broker.id)
                .all()
            )
            active_sessions = [session for session in sessions if session.expires_at > now]
            earliest_expiry = min(
                (session.expires_at for session in active_sessions),
                default=None,
            )

            items.append(
                AdminBrokerItem(
                    id=broker.id,
                    broker_name=broker.broker_name,
                    broker_type=broker.broker_type,
                    client_id=broker.client_id,
                    is_active=broker.is_active,
                    created_at=broker.created_at,
                    updated_at=broker.updated_at,
                    session=AdminBrokerSessionSummary(
                        active=broker.is_active and bool(active_sessions),
                        session_count=len(sessions),
                        active_session_count=len(active_sessions),
                        earliest_expiry=earliest_expiry,
                    ),
                )
            )

        return AdminBrokerListResponse(items=items, total=len(items))
