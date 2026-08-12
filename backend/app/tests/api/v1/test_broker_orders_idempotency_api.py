import uuid
from decimal import Decimal
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.v1.routes.auth import get_current_active_user
from app.dependencies.broker import get_broker_order_service
from app.schemas.auth import UserResponse
from app.brokers.base.broker_types import BrokerOrder
from app.exceptions.idempotency_exceptions import IdempotencyPayloadMismatchException


@pytest.fixture
def mock_user():
    return UserResponse(
        id=uuid.uuid4(),
        email="trader@platform.com",
        username="trader",
        full_name="Trader User",
        role="TRADER",
        is_active=True,
        is_verified=True,
        last_login=None,
        created_at="2026-01-01T00:00:00Z",
        updated_at="2026-01-01T00:00:00Z",
    )


@pytest.fixture
def mock_broker_order_service():
    return MagicMock()


@pytest.fixture
def client(mock_user, mock_broker_order_service):
    app.dependency_overrides[get_current_active_user] = lambda: mock_user
    app.dependency_overrides[get_broker_order_service] = lambda: mock_broker_order_service
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_place_order_with_x_idempotency_key_header(client, mock_broker_order_service, mock_user):
    broker_id = uuid.uuid4()
    mock_order = BrokerOrder(
        order_id="ORD-HEADER-100",
        symbol="TCS",
        side="BUY",
        quantity=Decimal("5"),
        status="COMPLETE",
    )
    mock_broker_order_service.place_order.return_value = mock_order

    payload = {
        "symbol": "TCS",
        "exchange": "NSE",
        "quantity": "5",
        "side": "BUY",
        "order_type": "MARKET",
        "product": "CNC",
        "variety": "regular",
    }

    headers = {"X-Idempotency-Key": "IDEM-HDR-123"}
    res = client.post(f"/api/v1/broker-orders/{broker_id}", json=payload, headers=headers)

    assert res.status_code == 201
    data = res.json()
    assert data["order_id"] == "ORD-HEADER-100"
    assert data["symbol"] == "TCS"

    # Verify idempotency_key was passed to service.place_order
    mock_broker_order_service.place_order.assert_called_once_with(
        user_id=mock_user.id,
        broker_id=broker_id,
        request=pytest.any_variable if hasattr(pytest, "any_variable") else mock_broker_order_service.place_order.call_args[1]["request"],
        idempotency_key="IDEM-HDR-123",
    )


def test_place_order_idempotency_payload_mismatch_returns_409(client, mock_broker_order_service):
    broker_id = uuid.uuid4()
    mock_broker_order_service.place_order.side_effect = IdempotencyPayloadMismatchException(
        message="Idempotency key reuse detected with different order parameters."
    )

    payload = {
        "symbol": "TCS",
        "exchange": "NSE",
        "quantity": "10",
        "side": "SELL",
        "order_type": "MARKET",
        "product": "CNC",
        "variety": "regular",
    }

    headers = {"X-Idempotency-Key": "IDEM-HDR-123"}
    res = client.post(f"/api/v1/broker-orders/{broker_id}", json=payload, headers=headers)

    assert res.status_code == 409
    data = res.json()
    msg = data.get("message") or data.get("detail", "")
    assert "Idempotency key reuse detected" in str(msg)
