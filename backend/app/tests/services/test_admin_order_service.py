from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from app.services.admin_order_service import AdminOrderService


def test_row_to_item_normalizes_admin_order_fields():
    order_id = uuid4()
    user_id = uuid4()
    broker_id = uuid4()
    now = datetime.now(timezone.utc)
    row = {
        "ref_id": order_id,
        "source": "BROKER_ORDER",
        "user_id": user_id,
        "user_name": "Trader One",
        "user_role": SimpleNamespace(value="TRADER"),
        "broker_id": broker_id,
        "broker_name": "Zerodha",
        "execution_mode": "LIVE",
        "symbol": "TCS",
        "side": "buy",
        "quantity": Decimal("10"),
        "filled_quantity": Decimal("5"),
        "average_fill_price": Decimal("3500"),
        "order_type": "LIMIT",
        "product": "MIS",
        "price": Decimal("3500"),
        "trigger_price": None,
        "status": "PARTIAL",
        "strategy_instance_id": None,
        "signal_id": None,
        "execution_id": None,
        "executed_at": None,
        "last_synced_at": now,
        "created_at": now,
        "updated_at": now,
    }

    item = AdminOrderService._row_to_item(row)

    assert item.order_ref == str(order_id)
    assert item.user_role == "TRADER"
    assert item.side == "BUY"
    assert item.execution_mode == "LIVE"
    assert item.status == "PARTIAL"
    assert item.filled_quantity == Decimal("5")


def test_paper_execution_is_presented_as_filled_paper_order():
    execution_id = uuid4()
    user_id = uuid4()
    now = datetime.now(timezone.utc)
    row = {
        "ref_id": execution_id,
        "source": "PAPER_EXECUTION",
        "user_id": user_id,
        "user_name": "Paper Trader",
        "user_role": "TRADER",
        "broker_id": None,
        "broker_name": None,
        "execution_mode": "PAPER",
        "symbol": "RELIANCE",
        "side": "SELL",
        "quantity": Decimal("2"),
        "filled_quantity": Decimal("2"),
        "average_fill_price": Decimal("2500"),
        "order_type": "MARKET",
        "product": None,
        "price": Decimal("2500"),
        "trigger_price": None,
        "status": "FILLED",
        "strategy_instance_id": None,
        "signal_id": None,
        "execution_id": str(execution_id),
        "executed_at": now,
        "last_synced_at": None,
        "created_at": now,
        "updated_at": now,
    }

    item = AdminOrderService._row_to_item(row)

    assert item.execution_mode == "PAPER"
    assert item.status == "FILLED"
    assert item.filled_quantity == item.quantity
