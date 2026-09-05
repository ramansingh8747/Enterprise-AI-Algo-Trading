from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.services.admin_broker_service import AdminBrokerService


def test_admin_broker_service_returns_non_secret_session_health():
    broker_id = uuid4()
    active = SimpleNamespace(
        broker_id=broker_id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    expired = SimpleNamespace(
        broker_id=broker_id,
        expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    broker = SimpleNamespace(
        id=broker_id,
        broker_name='Demo Broker',
        broker_type='zerodha',
        client_id='client-1',
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        api_key='secret-key',
        api_secret='secret-value',
    )

    class Query:
        def __init__(self, values): self.values = values
        def order_by(self, *_): return self
        def all(self): return self.values
        def filter(self, *_): return self

    class DB:
        def query(self, model):
            if model.__name__ == 'Broker': return Query([broker])
            return Query([active, expired])

    result = AdminBrokerService(DB()).list_brokers()
    assert result.total == 1
    assert result.items[0].session.active is True
    assert result.items[0].session.active_session_count == 1
    assert not hasattr(result.items[0], 'api_secret')
