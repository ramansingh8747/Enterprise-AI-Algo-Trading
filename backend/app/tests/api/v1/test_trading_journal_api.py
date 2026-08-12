import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.dependencies.auth import get_current_active_user
from app.dependencies.database import get_db
from app.database.models.user import User
from app.database.models.trading_journal import TradingJournalEntry
from unittest.mock import MagicMock
import uuid

@pytest.fixture
def db_session():
    # Use the session from get_db dependency
    # For testing, we might need a way to get the session. 
    # Let's assume we can use the existing DB dependency setup.
    from app.dependencies.database import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def client(db_session):
    # Create a unique user for each test run to avoid unique constraint violations
    unique_id = uuid.uuid4()
    user = User(
        id=unique_id, 
        email=f"test_{unique_id}@example.com", 
        username=f"testuser_{unique_id}",
        full_name="Test User",
        password_hash="password"
    )
    db_session.add(user)
    db_session.commit()
    
    # Mock authentication to return this user
    def get_mock_user():
        return user
        
    app.dependency_overrides[get_current_active_user] = get_mock_user
    
    client = TestClient(app)
    yield client
    app.dependency_overrides = {}
    
    # Cleanup journal entries
    db_session.query(TradingJournalEntry).filter(TradingJournalEntry.user_id == unique_id).delete()
    db_session.delete(user)
    db_session.commit()

from app.database.models.broker import Broker
from app.database.models.strategy import StrategyDefinition, StrategyInstance, StrategySignal

def test_create_journal_entry(client):
    data = {
        "symbol": "AAPL",
        "side": "BUY",
        "quantity": 10,
        "entry_price": 150.0,
        "notes": "Test entry"
    }
    response = client.post("/api/v1/trading-journal", json=data)
    assert response.status_code == 200
    assert response.json()["symbol"] == "AAPL"

def test_list_journal_entries(client):
    response = client.get("/api/v1/trading-journal")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_from_paper_trade(client):
    data = {
        "symbol": "RELIANCE",
        "side": "BUY",
        "quantity": 25,
        "entry_price": 2850.0,
        "paper_trade_id": "PT-1001",
        "notes": "Paper trade entry"
    }
    res = client.post("/api/v1/trading-journal", json=data)
    assert res.status_code == 200
    json_data = res.json()
    assert json_data["paper_trade_id"] == "PT-1001"

    # Verify listing with filter
    res_list = client.get("/api/v1/trading-journal?paper_trade_id=PT-1001")
    assert res_list.status_code == 200
    assert len(res_list.json()) == 1
    assert res_list.json()[0]["paper_trade_id"] == "PT-1001"

def test_create_from_broker_order(client):
    data = {
        "symbol": "INFY",
        "side": "SELL",
        "quantity": 50,
        "entry_price": 1600.0,
        "broker_order_id": "BO-998822",
        "notes": "Live order entry"
    }
    res = client.post("/api/v1/trading-journal", json=data)
    assert res.status_code == 200
    assert res.json()["broker_order_id"] == "BO-998822"

def test_duplicate_protection(client):
    data = {
        "symbol": "TCS",
        "side": "BUY",
        "quantity": 10,
        "entry_price": 3500.0,
        "paper_trade_id": "PT-DUP-1"
    }
    res1 = client.post("/api/v1/trading-journal", json=data)
    assert res1.status_code == 200

    res2 = client.post("/api/v1/trading-journal", json=data)
    assert res2.status_code == 409
    res_json = res2.json()
    msg = res_json.get("detail") or res_json.get("message")
    assert "already exists" in msg

def test_create_from_strategy_signal_and_instance(client, db_session):
    # Retrieve current active user from auth dependency override
    mock_user_fn = app.dependency_overrides[get_current_active_user]
    user = mock_user_fn()

    broker = Broker(broker_name="TestBroker", broker_type="ZERODHA", api_key="key", api_secret="sec")
    db_session.add(broker)
    db_session.commit()

    strat_def = StrategyDefinition(user_id=user.id, name="Momentum Strategy")
    db_session.add(strat_def)
    db_session.commit()

    instance = StrategyInstance(strategy_definition_id=strat_def.id, user_id=user.id, broker_id=broker.id)
    db_session.add(instance)
    db_session.commit()

    signal = StrategySignal(
        strategy_instance_id=instance.id,
        user_id=user.id,
        broker_id=broker.id,
        symbol="SBIN",
        side="BUY",
        quantity=100,
        signal_fingerprint="fp_12345"
    )
    db_session.add(signal)
    db_session.commit()

    data = {
        "symbol": "SBIN",
        "side": "BUY",
        "quantity": 100,
        "entry_price": 580.0,
        "strategy_instance_id": str(instance.id),
        "strategy_signal_id": str(signal.id),
        "notes": "Strategy signal trade"
    }
    res = client.post("/api/v1/trading-journal", json=data)
    assert res.status_code == 200
    assert res.json()["strategy_instance_id"] == str(instance.id)
    assert res.json()["strategy_signal_id"] == str(signal.id)


def test_cross_user_source_rejection(client, db_session):
    # Create another user with unique email and a strategy instance for that user
    other_uid = uuid.uuid4()
    other_user = User(
        id=other_uid,
        email=f"other_{other_uid}@example.com",
        username=f"other_{other_uid}",
        full_name="Other User",
        password_hash="pwd"
    )
    db_session.add(other_user)
    db_session.commit()

    broker = Broker(broker_name="OtherBroker", broker_type="ANGELONE", api_key="key", api_secret="sec")
    db_session.add(broker)
    db_session.commit()

    strat_def = StrategyDefinition(user_id=other_user.id, name="Other Strategy")
    db_session.add(strat_def)
    db_session.commit()

    other_instance = StrategyInstance(strategy_definition_id=strat_def.id, user_id=other_user.id, broker_id=broker.id)
    db_session.add(other_instance)
    db_session.commit()

    # Attempt to reference other_user's strategy_instance
    data = {
        "symbol": "TATAMOTORS",
        "side": "BUY",
        "quantity": 20,
        "entry_price": 900.0,
        "strategy_instance_id": str(other_instance.id)
    }
    res = client.post("/api/v1/trading-journal", json=data)
    assert res.status_code == 404

    # Cleanup test records
    db_session.delete(other_instance)
    db_session.delete(strat_def)
    db_session.delete(broker)
    db_session.delete(other_user)
    db_session.commit()



def test_missing_source_rejection(client):
    data = {
        "symbol": "WIPRO",
        "side": "BUY",
        "quantity": 10,
        "entry_price": 450.0,
        "strategy_instance_id": str(uuid.uuid4())
    }
    res = client.post("/api/v1/trading-journal", json=data)
    assert res.status_code == 404

def test_update_and_delete_journal_entry(client):
    data = {
        "symbol": "HDFCBANK",
        "side": "BUY",
        "quantity": 15,
        "entry_price": 1450.0,
        "notes": "Initial note"
    }
    res_create = client.post("/api/v1/trading-journal", json=data)
    assert res_create.status_code == 200
    entry_id = res_create.json()["id"]

    # Update
    update_data = {
        "symbol": "HDFCBANK",
        "side": "BUY",
        "quantity": 15,
        "entry_price": 1450.0,
        "exit_price": 1500.0,
        "realized_pnl": 750.0,
        "result": "WIN",
        "notes": "Updated note with profit"
    }
    res_update = client.patch(f"/api/v1/trading-journal/{entry_id}", json=update_data)
    assert res_update.status_code == 200
    assert res_update.json()["result"] == "WIN"
    assert res_update.json()["realized_pnl"] == 750.0

    # Delete
    res_delete = client.delete(f"/api/v1/trading-journal/{entry_id}")
    assert res_delete.status_code == 204

    # Verify deleted
    res_get = client.get(f"/api/v1/trading-journal/{entry_id}")
    assert res_get.status_code == 404

def test_nonexistent_entry_404(client):
    fake_id = str(uuid.uuid4())
    assert client.get(f"/api/v1/trading-journal/{fake_id}").status_code == 404
    assert client.delete(f"/api/v1/trading-journal/{fake_id}").status_code == 404

def test_unauthenticated_request():
    unauth_client = TestClient(app)
    res = unauth_client.get("/api/v1/trading-journal")
    assert res.status_code == 401

