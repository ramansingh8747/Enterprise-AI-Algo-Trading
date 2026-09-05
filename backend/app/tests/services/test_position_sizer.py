import uuid
import json
from decimal import Decimal
from datetime import datetime, timezone
from unittest.mock import MagicMock
import pytest

from app.services.position_sizer import PositionSizer
from app.services.strategy_engine.strategy_runner import StrategyRunner
from app.database.models.strategy import StrategyInstance, StrategyDefinition


def test_expensive_stock_reduced_quantity_with_capital_cap():
    """
    Bajaj Auto @ ₹11,600 with 2% SL and ₹10,00,000 portfolio capital (1% risk = ₹10,000):
    With 20% max single-stock allocation cap (₹2,00,000 / 11,600 = 17.24):
    Quantity is safely capped at 17 shares.
    """
    price = Decimal("11600.00")
    stop_loss = Decimal("11368.00") # 2% SL
    capital = Decimal("1000000.00")

    qty = PositionSizer.calculate_quantity(
        price=price,
        stop_loss=stop_loss,
        portfolio_capital=capital,
        risk_pct_per_trade=1.0,
        max_capital_allocation_pct=20.0,
    )

    # 17 shares @ 11,600 = ₹1,97,200 (within 20% cap of 10L portfolio)
    assert qty == Decimal("17")


def test_expensive_stock_constrained_by_single_stock_cap():
    """
    Bajaj Auto @ ₹11,600 with ₹1,00,000 capital (20% max allocation = ₹20,000):
    Max shares allowed by capital cap = 1 share (₹11,600), as 2 shares = ₹23,200 (> 20%).
    """
    price = Decimal("11600.00")
    stop_loss = Decimal("11368.00")
    capital = Decimal("100000.00")

    qty = PositionSizer.calculate_quantity(
        price=price,
        stop_loss=stop_loss,
        portfolio_capital=capital,
        risk_pct_per_trade=1.0,
        max_capital_allocation_pct=20.0,
    )

    assert qty == Decimal("1")


def test_cheap_stock_scaled_quantity_capped_by_allocation():
    """
    Tata Steel @ ₹183 with 2% SL and ₹1,00,000 capital (1% risk = ₹1,000):
    Max 20% capital allocation = ₹20,000 / 183 = 109 shares.
    """
    price = Decimal("183.00")
    stop_loss = Decimal("179.34") # 2% SL
    capital = Decimal("100000.00")

    qty = PositionSizer.calculate_quantity(
        price=price,
        stop_loss=stop_loss,
        portfolio_capital=capital,
        risk_pct_per_trade=1.0,
        max_capital_allocation_pct=20.0,
    )

    # 109 shares @ 183 = ~₹19,947 (within 20% cap)
    assert qty == Decimal("109")


def test_strategy_runner_dynamic_position_sizing():
    """Verifies that StrategyRunner calculates dynamic risk-based quantity when position_sizing_mode is DYNAMIC."""
    user_id = uuid.uuid4()
    instance_id = uuid.uuid4()
    strat_def_id = uuid.uuid4()
    mock_strategy_repo = MagicMock()

    instance = StrategyInstance(
        id=instance_id,
        user_id=user_id,
        broker_id=uuid.uuid4(),
        strategy_definition_id=strat_def_id,
        execution_mode="PAPER",
        status="RUNNING",
    )
    defn = StrategyDefinition(
        id=strat_def_id,
        user_id=user_id,
        name="Dynamic Sized Strategy",
        strategy_type="DETERMINISTIC_MOMENTUM",
        config_json=json.dumps({
            "position_sizing_mode": "DYNAMIC",
            "capital": "1000000.00",
            "risk_pct_per_trade": 1.0,
            "max_capital_allocation_pct": 20.0,
            "bypass_market_hours": True,
        }),
    )
    mock_strategy_repo.get_instance_for_user.return_value = instance
    mock_strategy_repo.get_definition_for_user.return_value = defn
    mock_strategy_repo.has_active_proposed_signal.return_value = False
    mock_strategy_repo.has_ignored_signal.return_value = False
    mock_strategy_repo.has_recent_execution_or_signal.return_value = False

    def fake_create_signal(**kwargs):
        from app.database.models.strategy import StrategySignal
        sig = StrategySignal(
            id=uuid.uuid4(),
            strategy_instance_id=instance_id,
            user_id=user_id,
            broker_id=instance.broker_id,
            symbol=kwargs.get("symbol", "BAJAJ-AUTO"),
            side="BUY",
            quantity=kwargs.get("quantity"),
            status="PROPOSED",
        )
        return (sig, True)

    mock_strategy_repo.create_signal_if_not_exists.side_effect = fake_create_signal

    runner = StrategyRunner(repository=mock_strategy_repo)

    now_ts = datetime.now(timezone.utc).isoformat()
    sig = runner.execute_cycle(
        instance_id,
        user_id,
        {"symbol": "BAJAJ-AUTO", "price": 11600.00, "change_percent": 2.0, "timestamp": now_ts},
    )

    assert sig is not None
    # Verify dynamic position sizing with 10 Lakh capital calculated 17 shares
    assert sig.quantity == Decimal("17")
