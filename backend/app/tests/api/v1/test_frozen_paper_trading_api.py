import uuid
from datetime import datetime, timezone
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.v1.routes.auth import get_current_active_user
from app.database.models.user import UserRole
from app.schemas.auth import UserResponse


@pytest.fixture
def mock_user():
    now = datetime.now(timezone.utc)
    return UserResponse(
        id=uuid.uuid4(),
        email="trader@enterprise.ai",
        username="trader_joe",
        full_name="Trader Joe",
        role=UserRole.TRADER,
        is_active=True,
        is_verified=True,
        last_login=now,
        created_at=now,
        updated_at=now,
    )


@pytest.fixture
def client(mock_user):
    app.dependency_overrides[get_current_active_user] = lambda: mock_user
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def test_list_frozen_configs_api(client):
    """
    Test 1: GET /api/v1/frozen-paper-trading/configs returns the list of registered frozen configs.
    """
    response = client.get("/api/v1/frozen-paper-trading/configs")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

    coal_cfg = next(c for c in data if c["version_id"] == "COALINDIA_WFA_FROZEN_v1")
    assert coal_cfg["strategy_id"] == "STRAT_25"
    assert coal_cfg["symbol"] == "COALINDIA"
    assert coal_cfg["status"] == "FROZEN"
    assert coal_cfg["execution_mode"] == "PAPER"
    assert coal_cfg["stop_loss"] == 382.20
    assert coal_cfg["target"] == 403.65


def test_get_frozen_config_by_id_api(client):
    """
    Test 2: GET /api/v1/frozen-paper-trading/configs/COALINDIA_WFA_FROZEN_v1 returns detailed spec & hash.
    """
    response = client.get("/api/v1/frozen-paper-trading/configs/COALINDIA_WFA_FROZEN_v1")
    assert response.status_code == 200
    data = response.json()
    assert data["version_id"] == "COALINDIA_WFA_FROZEN_v1"
    assert data["symbol"] == "COALINDIA"
    assert len(data["config_hash"]) > 0


def test_start_and_get_session_state_api(client):
    """
    Test 3: POST /session/start and GET /session state endpoints.
    """
    version_id = "COALINDIA_WFA_FROZEN_v1"
    resp_start = client.post(f"/api/v1/frozen-paper-trading/session/{version_id}/start")
    assert resp_start.status_code == 200
    data = resp_start.json()
    assert data["version_id"] == version_id
    assert data["status"] == "ACTIVE"
    assert data["execution_mode"] == "PAPER"
    assert float(data["initial_capital"]) == 22727.27

    resp_get = client.get(f"/api/v1/frozen-paper-trading/session/{version_id}")
    assert resp_get.status_code == 200
    assert resp_get.json()["session_id"] == data["session_id"]


def test_step_and_trade_audit_log_api(client):
    """
    Test 4: Steps single candle through API and checks trade audit log.
    """
    version_id = "COALINDIA_WFA_FROZEN_v1"
    client.post(f"/api/v1/frozen-paper-trading/session/{version_id}/reset")

    # Ingest entry candle
    candle_entry = {
        "timestamp": "2027-03-01 09:15",
        "open": 390.0,
        "high": 393.0,
        "low": 389.5,
        "close": 392.5,
        "change_percent": 0.64,
    }
    resp_step1 = client.post(f"/api/v1/frozen-paper-trading/session/{version_id}/step", json=candle_entry)
    assert resp_step1.status_code == 200
    assert resp_step1.json()["active_position"] is not None

    # Ingest take-profit exit candle
    candle_exit = {
        "timestamp": "2027-03-01 11:15",
        "open": 395.0,
        "high": 408.0,
        "low": 394.0,
        "close": 407.0,
        "change_percent": 2.28,
    }
    resp_step2 = client.post(f"/api/v1/frozen-paper-trading/session/{version_id}/step", json=candle_exit)
    assert resp_step2.status_code == 200
    assert resp_step2.json()["active_position"] is None

    # Fetch trade audit log
    resp_trades = client.get(f"/api/v1/frozen-paper-trading/trades/{version_id}")
    assert resp_trades.status_code == 200
    trades = resp_trades.json()
    assert len(trades) >= 1
    assert trades[0]["exit_reason"] == "TAKE_PROFIT"


def test_simulate_feed_and_validation_scorecard_api(client):
    """
    Test 5: POST /simulate-feed triggers independent market stream and returns scorecard.
    """
    version_id = "COALINDIA_WFA_FROZEN_v1"
    client.post(f"/api/v1/frozen-paper-trading/session/{version_id}/reset")

    payload = {
        "candle_count": 400,
        "seed": 101,
        "base_volatility_pct": 1.4,
        "drift_pct": 0.10,
    }
    resp = client.post(f"/api/v1/frozen-paper-trading/session/{version_id}/simulate-feed", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_trades_count"] >= 30
    assert data["validation_scorecard"]["sample_size_satisfied"] is True
    assert data["validation_scorecard"]["overall_status"] in ["ROBUST_WINNER", "REJECTED_UNDERPERFORMING"]
