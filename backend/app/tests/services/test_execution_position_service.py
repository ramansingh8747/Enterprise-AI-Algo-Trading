from decimal import Decimal

from app.services.execution_position_service import ExecutionPositionService


def test_incremental_fill_price_for_partial_fill():
    price = ExecutionPositionService.incremental_fill_price(
        Decimal("10"), Decimal("100"), Decimal("15"), Decimal("110"), Decimal("5")
    )
    assert price == Decimal("130")


def test_first_fill_uses_broker_average_price():
    price = ExecutionPositionService.incremental_fill_price(
        Decimal("0"), Decimal("0"), Decimal("5"), Decimal("101.25"), Decimal("5")
    )
    assert price == Decimal("101.25")
