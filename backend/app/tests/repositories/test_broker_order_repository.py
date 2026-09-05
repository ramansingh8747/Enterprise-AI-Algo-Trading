from decimal import Decimal

from app.database.repositories.broker_order_repository import BrokerOrderRepository


def test_normalize_filled_status():
    assert BrokerOrderRepository.normalize_status("COMPLETE", Decimal("10"), Decimal("10")) == "FILLED"


def test_normalize_partial_status():
    assert BrokerOrderRepository.normalize_status("OPEN", Decimal("10"), Decimal("4")) == "PARTIAL"


def test_normalize_cancelled_and_rejected():
    assert BrokerOrderRepository.normalize_status("CANCELLED", Decimal("10"), Decimal("0")) == "CANCELLED"
    assert BrokerOrderRepository.normalize_status("REJECTED", Decimal("10"), Decimal("0")) == "REJECTED"


def test_normalize_unknown_submission():
    assert BrokerOrderRepository.normalize_status("UNKNOWN", Decimal("10"), Decimal("0")) == "SUBMITTED"
