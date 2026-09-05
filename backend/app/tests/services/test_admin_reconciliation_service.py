from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from app.services.admin_reconciliation_service import AdminReconciliationService


def test_order_reconciliation_detects_status_and_fill_mismatch():
    service = AdminReconciliationService(db=None)
    user_id, broker_id = uuid4(), uuid4()
    internal = SimpleNamespace(
        broker_order_id="ORD-1", status="FILLED", filled_quantity=Decimal("10")
    )
    external = SimpleNamespace(
        order_id="ORD-1", status="OPEN", filled_quantity=Decimal("5")
    )
    # Patch the DB query path used by the comparator with a minimal fake.
    service.db = SimpleNamespace(
        query=lambda model: SimpleNamespace(
            filter=lambda *args: SimpleNamespace(all=lambda: [internal])
        )
    )
    metric = service._compare_orders(user_id, broker_id, [external])
    assert metric.status == "MISMATCH"
    assert metric.difference_count == 1


def test_position_reconciliation_detects_external_only_position():
    service = AdminReconciliationService(db=None)
    user_id, broker_id = uuid4(), uuid4()
    service.db = SimpleNamespace(
        query=lambda model: SimpleNamespace(
            filter=lambda *args: SimpleNamespace(all=lambda: [])
        )
    )
    external = SimpleNamespace(symbol="TCS", quantity=Decimal("2"), avg_price=Decimal("3500"))
    metric = service._compare_positions(user_id, broker_id, [external])
    assert metric.status == "MISMATCH"
    assert metric.difference_count == 1
    assert metric.details[0]["type"] == "EXTERNAL_ONLY"
