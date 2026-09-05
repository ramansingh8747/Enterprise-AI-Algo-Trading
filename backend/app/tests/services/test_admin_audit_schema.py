from datetime import datetime, timezone
from uuid import uuid4

from app.schemas.admin_audit import AuditEventItem, AuditEventPage


def test_audit_event_schema_is_safe_and_queryable():
    event = AuditEventItem(
        id=uuid4(),
        action="KILL_SWITCH_ACTIVATED",
        outcome="SUCCESS",
        occurred_at=datetime.now(timezone.utc),
        details={"reason": "emergency", "api_secret": "[REDACTED]"},
        user_name="Admin",
    )
    page = AuditEventPage(total=1, items=[event], page=1, page_size=25)
    assert page.items[0].details["api_secret"] == "[REDACTED]"
    assert page.total == 1
