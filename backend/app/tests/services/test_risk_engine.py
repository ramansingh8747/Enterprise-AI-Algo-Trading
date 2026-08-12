import uuid
import pytest
from decimal import Decimal
from unittest.mock import MagicMock

from app.brokers.base.broker_types import BrokerOrder, BrokerOrderRequest
from app.database.models.trading_risk_settings import TradingRiskSettings
from app.exceptions.risk_exceptions import RiskLimitExceededException, TradingHaltedException
from app.services.risk_engine import RiskEngine
from app.services.broker_order_service import BrokerOrderService


@pytest.fixture
def mock_db_session():
    return MagicMock()


@pytest.fixture
def mock_risk_repo(mock_db_session):
    repo = MagicMock()
    # Default settings: max_qty=100, max_notional=10000, max_orders_per_min=5, kill_switch=False
    settings = TradingRiskSettings(
        id=uuid.uuid4(),
        max_order_quantity=Decimal("100.0000"),
        max_order_notional=Decimal("10000.0000"),
        max_position_quantity=Decimal("500.0000"),
        max_exposure_notional=Decimal("50000.0000"),
        max_orders_per_minute=5,
        daily_loss_limit=Decimal("5000.0000"),
        max_drawdown_percent=Decimal("10.0000"),
        kill_switch_active=False,
    )
    repo.get_risk_settings.return_value = settings
    repo.count_recent_orders_in_window.return_value = 0
    return repo


@pytest.fixture
def risk_engine(mock_risk_repo):
    return RiskEngine(repository=mock_risk_repo)


def test_order_below_max_quantity_passes(risk_engine):
    user_id = uuid.uuid4()
    broker_id = uuid.uuid4()
    req = BrokerOrderRequest(
        symbol="INFY", exchange="NSE", quantity=Decimal("50"),
        side="BUY", order_type="MARKET", product="CNC", variety="regular"
    )

    # Should not raise exception
    risk_engine.validate_order(user_id, broker_id, req)


def test_order_above_max_quantity_raises_error(risk_engine):
    user_id = uuid.uuid4()
    broker_id = uuid.uuid4()
    req = BrokerOrderRequest(
        symbol="INFY", exchange="NSE", quantity=Decimal("150"), # > 100 limit
        side="BUY", order_type="MARKET", product="CNC", variety="regular"
    )

    with pytest.raises(RiskLimitExceededException) as exc_info:
        risk_engine.validate_order(user_id, broker_id, req)

    assert "quantity 150 exceeds maximum allowed limit" in str(exc_info.value)


def test_order_above_max_notional_raises_error(risk_engine):
    user_id = uuid.uuid4()
    broker_id = uuid.uuid4()
    req = BrokerOrderRequest(
        symbol="INFY", exchange="NSE", quantity=Decimal("50"),
        side="BUY", order_type="LIMIT", product="CNC", variety="regular",
        price=Decimal("300.00") # 50 * 300 = 15000 > 10000 notional limit
    )

    with pytest.raises(RiskLimitExceededException) as exc_info:
        risk_engine.validate_order(user_id, broker_id, req)

    assert "notional value 15000.00 exceeds maximum allowed limit" in str(exc_info.value)


def test_order_frequency_exceeded_raises_error(risk_engine, mock_risk_repo):
    user_id = uuid.uuid4()
    broker_id = uuid.uuid4()
    mock_risk_repo.count_recent_orders_in_window.return_value = 5 # == 5 max per min limit

    req = BrokerOrderRequest(
        symbol="INFY", exchange="NSE", quantity=Decimal("10"),
        side="BUY", order_type="MARKET", product="CNC", variety="regular"
    )

    with pytest.raises(RiskLimitExceededException) as exc_info:
        risk_engine.validate_order(user_id, broker_id, req)

    assert "Order frequency limit exceeded" in str(exc_info.value)


def test_emergency_kill_switch_active_raises_trading_halted(risk_engine, mock_risk_repo):
    user_id = uuid.uuid4()
    broker_id = uuid.uuid4()
    settings = mock_risk_repo.get_risk_settings.return_value
    settings.kill_switch_active = True

    req = BrokerOrderRequest(
        symbol="INFY", exchange="NSE", quantity=Decimal("10"),
        side="BUY", order_type="MARKET", product="CNC", variety="regular"
    )

    with pytest.raises(TradingHaltedException) as exc_info:
        risk_engine.validate_order(user_id, broker_id, req)

    assert "Trading is currently halted by emergency kill switch" in str(exc_info.value)


def test_daily_loss_exceeded_raises_trading_halted(risk_engine):
    user_id = uuid.uuid4()
    broker_id = uuid.uuid4()
    req = BrokerOrderRequest(
        symbol="INFY", exchange="NSE", quantity=Decimal("10"),
        side="BUY", order_type="MARKET", product="CNC", variety="regular"
    )

    with pytest.raises(TradingHaltedException) as exc_info:
        risk_engine.validate_order(user_id, broker_id, req, daily_pnl=Decimal("-6000.00")) # Breach 5000 limit

    assert "Daily loss threshold of 5000.0000 breached" in str(exc_info.value)


def test_projected_position_exceeded_raises_error(risk_engine):
    user_id = uuid.uuid4()
    broker_id = uuid.uuid4()
    current_pos = [{"symbol": "INFY", "quantity": "460"}] # + 50 BUY = 510 > 500 max position limit

    req = BrokerOrderRequest(
        symbol="INFY", exchange="NSE", quantity=Decimal("50"),
        side="BUY", order_type="MARKET", product="CNC", variety="regular"
    )

    with pytest.raises(RiskLimitExceededException) as exc_info:
        risk_engine.validate_order(user_id, broker_id, req, current_positions=current_pos)

    assert "Projected position quantity 510 for INFY exceeds limit" in str(exc_info.value)


def test_broker_order_service_uses_risk_engine_before_order_dispatch(risk_engine):
    user_id = uuid.uuid4()
    broker_id = uuid.uuid4()
    req = BrokerOrderRequest(
        symbol="INFY", exchange="NSE", quantity=Decimal("150"), # Exceeds quantity limit
        side="BUY", order_type="MARKET", product="CNC", variety="regular"
    )

    mock_session_service = MagicMock()
    mock_broker_service = MagicMock()
    mock_factory = MagicMock()
    mock_provider = MagicMock()
    mock_factory.get_provider.return_value = mock_provider

    service = BrokerOrderService(
        session_service=mock_session_service,
        broker_service=mock_broker_service,
        broker_factory=mock_factory,
        risk_engine=risk_engine,
    )

    with pytest.raises(RiskLimitExceededException):
        service.place_order(user_id, broker_id, req)

    # Provider place_order MUST NOT be called when risk engine rejects
    mock_provider.place_order.assert_not_called()
