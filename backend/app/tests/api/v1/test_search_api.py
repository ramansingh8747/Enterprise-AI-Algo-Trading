import pytest
from fastapi.testclient import TestClient
import uuid

import app.database.models  # noqa: F401
from app.main import app
from app.dependencies.auth import get_current_active_user
from app.database.models.user import User, UserRole
from app.database.models.strategy import StrategyDefinition
from app.database.models.trading_journal import TradingJournalEntry
from app.database.models.alert import Alert
from app.database.models.paper_portfolio import PaperPortfolio

@pytest.fixture
def db_session():
    from app.database.session import SessionLocal, engine
    from app.database.base import Base
    import app.database.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def user_a(db_session):
    uid = uuid.uuid4()
    u = User(
        id=uid,
        email=f"search_user_a_{uid.hex[:8]}@example.com",
        username=f"search_a_{uid.hex[:8]}",
        password_hash="password123",
        full_name="Search User A",
        role=UserRole.TRADER,
        is_active=True,
    )
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u

@pytest.fixture
def user_b(db_session):
    uid = uuid.uuid4()
    u = User(
        id=uid,
        email=f"search_user_b_{uid.hex[:8]}@example.com",
        username=f"search_b_{uid.hex[:8]}",
        password_hash="password123",
        full_name="Search User B",
        role=UserRole.TRADER,
        is_active=True,
    )
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u

@pytest.fixture
def client_a(user_a):
    app.dependency_overrides[get_current_active_user] = lambda: user_a
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def test_search_symbol_equities(client_a):
    resp = client_a.get("/api/v1/search?q=RELIANCE")
    assert resp.status_code == 200
    data = resp.json()
    assert data["query"] == "RELIANCE"
    assert data["total_results"] >= 1
    symbols = [r["symbol"] for r in data["results"] if r.get("symbol")]
    assert "RELIANCE" in symbols

def test_search_user_strategy_and_isolation(client_a, user_a, user_b, db_session):
    # User A strategy
    strat_a = StrategyDefinition(
        id=uuid.uuid4(),
        user_id=user_a.id,
        name="Alpha Momentum Strategy A",
        strategy_type="MOMENTUM"
    )
    # User B strategy
    strat_b = StrategyDefinition(
        id=uuid.uuid4(),
        user_id=user_b.id,
        name="Secret Strategy B",
        strategy_type="SCALPING"
    )

    db_session.add_all([strat_a, strat_b])
    db_session.commit()

    # Search User A
    app.dependency_overrides[get_current_active_user] = lambda: user_a
    resp_a = client_a.get("/api/v1/search?q=Strategy")
    assert resp_a.status_code == 200
    titles_a = [r["title"] for r in resp_a.json()["results"]]
    assert "Alpha Momentum Strategy A" in titles_a
    assert "Secret Strategy B" not in titles_a

def test_search_user_trading_journal(client_a, user_a, db_session):
    j_entry = TradingJournalEntry(
        id=uuid.uuid4(),
        user_id=user_a.id,
        symbol="TATAMOTORS",
        side="BUY",
        quantity=100,
        entry_price=450.0,
        notes="Breakout entry after quarterly earnings boost",
        tags="EV,Breakout"
    )
    db_session.add(j_entry)
    db_session.commit()

    resp = client_a.get("/api/v1/search?q=earnings")
    assert resp.status_code == 200
    results = resp.json()["results"]
    journal_items = [r for r in results if r["category"] == "JOURNAL"]
    assert len(journal_items) >= 1
    assert "TATAMOTORS" in journal_items[0]["title"]

def test_search_user_alerts(client_a, user_a, db_session):
    alert = Alert(
        id=uuid.uuid4(),
        user_id=user_a.id,
        type="RISK",
        severity="WARNING",
        title="High Margin Utilized",
        message="Account margin utilization reached 80%",
        read=False
    )
    db_session.add(alert)
    db_session.commit()

    resp = client_a.get("/api/v1/search?q=margin")
    assert resp.status_code == 200
    alert_items = [r for r in resp.json()["results"] if r["category"] == "ALERT"]
    assert len(alert_items) >= 1
    assert alert_items[0]["title"] == "High Margin Utilized"

def test_search_navigation_routes(client_a):
    resp = client_a.get("/api/v1/search?q=dashboard")
    assert resp.status_code == 200
    nav_items = [r for r in resp.json()["results"] if r["category"] == "NAVIGATION"]
    assert len(nav_items) >= 1
    assert nav_items[0]["title"] == "Dashboard"

def test_search_empty_query_validation(client_a):
    resp = client_a.get("/api/v1/search?q=")
    assert resp.status_code == 422  # Query validation error for min_length=1

def test_search_unauthenticated_rejected():
    app.dependency_overrides.clear()
    with TestClient(app) as unauth_client:
        resp = unauth_client.get("/api/v1/search?q=RELIANCE")
        assert resp.status_code == 401
