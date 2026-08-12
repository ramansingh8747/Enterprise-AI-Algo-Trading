from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from app.database.models.alert import Alert

INITIAL_SEED_ALERTS = [
    {
        "type": "SYSTEM",
        "severity": "INFO",
        "title": "Paper Sandbox Active",
        "message": "Virtual trading sandbox initialized with ₹10,00,000 starting paper margin.",
        "route": "/dashboard",
    },
    {
        "type": "RISK",
        "severity": "INFO",
        "title": "Risk Engine Active",
        "message": "Max Order: ₹1,00,000 • Daily Loss Cap: ₹10,00,000 • Trade Risk: 2.0%",
        "route": "/portfolio",
    },
    {
        "type": "BROKER",
        "severity": "SUCCESS",
        "title": "Broker Read-Only Mode",
        "message": "Broker integration sandbox active. Live orders disabled.",
        "route": "/brokers",
    },
]

class AlertRepository:
    def __init__(self, db: Session):
        self.db = db

    def seed_initial_alerts(self, user_id: uuid.UUID) -> List[Alert]:
        """Seed initial welcome alerts for a user if none exist."""
        existing = (
            self.db.query(Alert)
            .filter(Alert.user_id == user_id)
            .first()
        )
        if existing:
            return []

        # Seed initial welcome alerts
        new_alerts = []
        for seed in INITIAL_SEED_ALERTS:
            alt = Alert(
                id=uuid.uuid4(),
                user_id=user_id,
                type=seed["type"],
                severity=seed["severity"],
                title=seed["title"],
                message=seed["message"],
                route=seed["route"],
                read=False,
            )
            self.db.add(alt)
            new_alerts.append(alt)

        self.db.commit()
        for a in new_alerts:
            self.db.refresh(a)

        return new_alerts

    def list_user_alerts(self, user_id: uuid.UUID, unread_only: bool = False) -> List[Alert]:
        """List alerts owned by user."""
        query = self.db.query(Alert).filter(Alert.user_id == user_id)
        if unread_only:
            query = query.filter(Alert.read == False)
        return query.order_by(Alert.created_at.desc()).all()


    def get_alert(self, alert_id: uuid.UUID, user_id: uuid.UUID) -> Optional[Alert]:
        """Fetch alert ensuring user ownership."""
        return (
            self.db.query(Alert)
            .filter(Alert.id == alert_id, Alert.user_id == user_id)
            .first()
        )

    def create_alert(
        self,
        user_id: uuid.UUID,
        title: str,
        message: str,
        type: str = "SYSTEM",
        severity: str = "INFO",
        route: Optional[str] = None,
    ) -> Alert:
        """Create new alert for user."""
        alt = Alert(
            id=uuid.uuid4(),
            user_id=user_id,
            type=type,
            severity=severity,
            title=title.strip(),
            message=message.strip(),
            route=route,
            read=False,
        )
        self.db.add(alt)
        self.db.commit()
        self.db.refresh(alt)
        return alt

    def mark_as_read(self, alert_id: uuid.UUID, user_id: uuid.UUID) -> Optional[Alert]:
        """Mark alert as read verifying user ownership."""
        alt = self.get_alert(alert_id, user_id)
        if not alt:
            return None
        alt.read = True
        self.db.commit()
        self.db.refresh(alt)
        return alt

    def mark_all_as_read(self, user_id: uuid.UUID) -> int:
        """Mark all user's alerts as read."""
        count = (
            self.db.query(Alert)
            .filter(Alert.user_id == user_id, Alert.read == False)
            .update({"read": True})
        )
        self.db.commit()
        return count

    def delete_alert(self, alert_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Delete alert verifying user ownership."""
        alt = self.get_alert(alert_id, user_id)
        if not alt:
            return False
        self.db.delete(alt)
        self.db.commit()
        return True

    def clear_all_alerts(self, user_id: uuid.UUID) -> int:
        """Clear all alerts belonging to user."""
        count = self.db.query(Alert).filter(Alert.user_id == user_id).delete()
        self.db.commit()
        return count
