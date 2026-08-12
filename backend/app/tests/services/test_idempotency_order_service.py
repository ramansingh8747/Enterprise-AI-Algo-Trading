import uuid
import pytest
from decimal import Decimal
from unittest.mock import MagicMock

from app.brokers.base.broker_types import BrokerOrder, BrokerOrderRequest
from app.database.models.order_idempotency import OrderIdempotencyRecord
from app.exceptions.idempotency_exceptions import (
    IdempotencyConflictException,
    IdempotencyPayloadMismatchException,
)
from app.services.broker_order_service import BrokerOrderService
from app.services.idempotency_service import IdempotencyService
from app.database.repositories.order_idempotency_repository import OrderIdempotencyRepository


@pytest.fixture
def mock_db_session():
    session = MagicMock()
    return session


@pytest.fixture
def idempotency_repo(mock_db_session):
    return OrderIdempotencyRepository(db=mock_db_session)


@pytest.fixture
def idempotency_service(idempotency_repo):
    return IdempotencyService(repository=idempotency_repo)


@pytest.fixture
def mock_session_service():
    return MagicMock()


@pytest.fixture
def mock_broker_service():
    service = MagicMock()
    broker = MagicMock()
    broker.broker_name = "zerodha"
    service.get_broker.return_value = broker
    return service


@pytest.fixture
def mock_provider():
    provider = MagicMock()
    provider.place_order.return_value = BrokerOrder(
        order_id="ORD-KEY-990",
        symbol="INFY",
        side="BUY",
        quantity=Decimal("10"),
        status="COMPLETE",
    )
    return provider


@pytest.fixture
def mock_broker_factory(mock_provider):
    factory = MagicMock()
    factory.get_provider.return_value = mock_provider
    return factory


@pytest.fixture
def broker_order_service(mock_session_service, mock_broker_service, mock_broker_factory, idempotency_service):
    return BrokerOrderService(
        session_service=mock_session_service,
        broker_service=mock_broker_service,
        broker_factory=mock_broker_factory,
        idempotency_service=idempotency_service,
    )


def test_place_order_without_idempotency_key(broker_order_service, mock_provider):
    user_id = uuid.uuid4()
    broker_id = uuid.uuid4()
    req = BrokerOrderRequest(
        symbol="INFY", exchange="NSE", quantity=Decimal("10"),
        side="BUY", order_type="MARKET", product="CNC", variety="regular"
    )

    res = broker_order_service.place_order(user_id, broker_id, req, idempotency_key=None)

    assert res.order_id == "ORD-KEY-990"
    mock_provider.place_order.assert_called_once()


def test_first_idempotent_request_executes_and_stores_result(broker_order_service, idempotency_repo, mock_provider):
    user_id = uuid.uuid4()
    broker_id = uuid.uuid4()
    key = "IDEM-KEY-001"
    req = BrokerOrderRequest(
        symbol="INFY", exchange="NSE", quantity=Decimal("10"),
        side="BUY", order_type="MARKET", product="CNC", variety="regular"
    )

    # Mock DB returns no existing record initially
    idempotency_repo.get_record = MagicMock(return_value=None)
    mock_record = OrderIdempotencyRecord(
        id=uuid.uuid4(), user_id=user_id, broker_id=broker_id,
        idempotency_key=key, request_hash="somehash", status="PENDING"
    )
    idempotency_repo.get_or_create_pending = MagicMock(return_value=(mock_record, True))
    idempotency_repo.mark_completed = MagicMock()

    res = broker_order_service.place_order(user_id, broker_id, req, idempotency_key=key)

    assert res.order_id == "ORD-KEY-990"
    mock_provider.place_order.assert_called_once()
    idempotency_repo.mark_completed.assert_called_once()


def test_repeated_idempotent_request_replays_stored_response(broker_order_service, idempotency_repo, mock_provider):
    user_id = uuid.uuid4()
    broker_id = uuid.uuid4()
    key = "IDEM-KEY-001"
    req = BrokerOrderRequest(
        symbol="INFY", exchange="NSE", quantity=Decimal("10"),
        side="BUY", order_type="MARKET", product="CNC", variety="regular"
    )

    req_dict = {
        "symbol": "INFY", "exchange": "NSE", "quantity": "10",
        "side": "BUY", "order_type": "MARKET", "product": "CNC",
        "variety": "regular", "price": None, "trigger_price": None
    }
    hash_val = IdempotencyService.compute_request_hash(req_dict)

    stored_payload = '{"order_id": "ORD-KEY-990", "symbol": "INFY", "side": "BUY", "quantity": "10", "status": "COMPLETE"}'
    existing_record = OrderIdempotencyRecord(
        id=uuid.uuid4(), user_id=user_id, broker_id=broker_id,
        idempotency_key=key, request_hash=hash_val, status="COMPLETED",
        response_payload=stored_payload, order_id="ORD-KEY-990"
    )

    idempotency_repo.get_or_create_pending = MagicMock(return_value=(existing_record, False))

    res = broker_order_service.place_order(user_id, broker_id, req, idempotency_key=key)

    assert res.order_id == "ORD-KEY-990"
    assert res.quantity == Decimal("10")
    # Provider must NOT have been called on replay
    mock_provider.place_order.assert_not_called()


def test_idempotent_request_payload_mismatch_raises_error(broker_order_service, idempotency_repo, mock_provider):
    user_id = uuid.uuid4()
    broker_id = uuid.uuid4()
    key = "IDEM-KEY-001"
    req = BrokerOrderRequest(
        symbol="INFY", exchange="NSE", quantity=Decimal("20"), # Different quantity
        side="SELL", order_type="MARKET", product="CNC", variety="regular"
    )

    existing_record = OrderIdempotencyRecord(
        id=uuid.uuid4(), user_id=user_id, broker_id=broker_id,
        idempotency_key=key, request_hash="different_hash_value", status="COMPLETED",
        response_payload='{}'
    )

    idempotency_repo.get_or_create_pending = MagicMock(return_value=(existing_record, False))

    with pytest.raises(IdempotencyPayloadMismatchException) as exc_info:
        broker_order_service.place_order(user_id, broker_id, req, idempotency_key=key)

    assert "Idempotency key reuse detected" in str(exc_info.value)
    mock_provider.place_order.assert_not_called()


def test_concurrent_in_flight_idempotent_request_raises_conflict(broker_order_service, idempotency_repo, mock_provider):
    user_id = uuid.uuid4()
    broker_id = uuid.uuid4()
    key = "IDEM-KEY-001"
    req = BrokerOrderRequest(
        symbol="INFY", exchange="NSE", quantity=Decimal("10"),
        side="BUY", order_type="MARKET", product="CNC", variety="regular"
    )

    req_dict = {
        "symbol": "INFY", "exchange": "NSE", "quantity": "10",
        "side": "BUY", "order_type": "MARKET", "product": "CNC",
        "variety": "regular", "price": None, "trigger_price": None
    }
    hash_val = IdempotencyService.compute_request_hash(req_dict)

    # In-flight record is still PENDING
    existing_record = OrderIdempotencyRecord(
        id=uuid.uuid4(), user_id=user_id, broker_id=broker_id,
        idempotency_key=key, request_hash=hash_val, status="PENDING"
    )

    idempotency_repo.get_or_create_pending = MagicMock(return_value=(existing_record, False))

    with pytest.raises(IdempotencyConflictException) as exc_info:
        broker_order_service.place_order(user_id, broker_id, req, idempotency_key=key)

    assert "currently in-flight" in str(exc_info.value)
    mock_provider.place_order.assert_not_called()


def test_failed_broker_execution_marks_record_failed(broker_order_service, idempotency_repo, mock_provider):
    user_id = uuid.uuid4()
    broker_id = uuid.uuid4()
    key = "IDEM-KEY-FAIL"
    req = BrokerOrderRequest(
        symbol="INFY", exchange="NSE", quantity=Decimal("10"),
        side="BUY", order_type="MARKET", product="CNC", variety="regular"
    )

    mock_provider.place_order.side_effect = ValueError("Broker API connection failed")

    mock_record = OrderIdempotencyRecord(
        id=uuid.uuid4(), user_id=user_id, broker_id=broker_id,
        idempotency_key=key, request_hash="hash", status="PENDING"
    )
    idempotency_repo.get_or_create_pending = MagicMock(return_value=(mock_record, True))
    idempotency_repo.mark_failed = MagicMock()

    with pytest.raises(ValueError) as exc_info:
        broker_order_service.place_order(user_id, broker_id, req, idempotency_key=key)

    assert "Broker API connection failed" in str(exc_info.value)
    idempotency_repo.mark_failed.assert_called_once()
