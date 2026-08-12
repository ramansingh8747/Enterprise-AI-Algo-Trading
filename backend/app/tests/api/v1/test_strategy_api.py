"""
Strategy CRUD REST API Integration Tests.

Covers:
  1.  Create strategy definition
  2.  List strategy definitions
  3.  Get strategy definition by ID
  4.  Update strategy definition
  5.  Delete strategy definition
  6.  Create strategy instance (PAPER default)
  7.  PAPER default execution mode
  8.  List strategy instances for a definition
  9.  Start instance (lifecycle transition)
  10. Stop instance
  11. Pause instance
  12. Resume instance
  13. Invalid lifecycle transition (400)
  14. Signal history retrieval
  15. Cross-user isolation (user A cannot access user B's resources)
  16. Unauthenticated access (401)
  17. Invalid execution_mode (422)
  18. Kill switch blocks instance start
  19. LIVE mode accepted
  20. Zero credential exposure in all responses
  21. Decimal string serialization for signal financial fields
  22. 404 on foreign definition get/update/delete
  23. 404 on foreign instance operations

Test isolation:
  - SQLite in-memory database.
  - All metadata created fresh per test via autouse fixture.
  - Dependency injection overridden for db and auth.
"""

import uuid
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database.base import Base
from app.dependencies.database import get_db
from app.dependencies.auth import get_current_active_user
from app.database.models.user import User, UserRole
from app.database.models.strategy import StrategyDefinition, StrategyInstance, StrategySignal
from app.database.models.trading_risk_settings import TradingRiskSettings
from app.database.models.broker import Broker
from app.schemas.auth import UserResponse

# ---------------------------------------------------------------------------
# Test database setup
# ---------------------------------------------------------------------------

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def api_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# User fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def user_a(api_session):
    u = User(
        id=uuid.uuid4(),
        email="usera@enterprise.ai",
        username="usera",
        password_hash="hash",
        full_name="User A",
        role=UserRole.TRADER,
        is_active=True,
    )
    api_session.add(u)
    api_session.commit()
    return u


@pytest.fixture
def user_b(api_session):
    u = User(
        id=uuid.uuid4(),
        email="userb@enterprise.ai",
        username="userb",
        password_hash="hash",
        full_name="User B",
        role=UserRole.TRADER,
        is_active=True,
    )
    api_session.add(u)
    api_session.commit()
    return u


# ---------------------------------------------------------------------------
# Broker fixture (required by StrategyInstance.broker_id FK)
# ---------------------------------------------------------------------------


@pytest.fixture
def broker_a(api_session):
    b = Broker(
        id=uuid.uuid4(),
        broker_name="Test Broker A",
        broker_type="ZERODHA",
        api_key="encrypted_key",
        api_secret="encrypted_secret",
        client_id="test_client",
        is_active=True,
    )
    api_session.add(b)
    api_session.commit()
    return b


# ---------------------------------------------------------------------------
# Authenticated client fixture (User A)
# ---------------------------------------------------------------------------


@pytest.fixture
def client(api_session, user_a):
    def _override_get_db():
        yield api_session

    user_resp = UserResponse.model_validate(user_a)
    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_active_user] = lambda: user_resp

    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_definition(api_session, user_id, name="Test Strategy") -> StrategyDefinition:
    """Directly create a StrategyDefinition for test setup."""
    d = StrategyDefinition(
        id=uuid.uuid4(),
        user_id=user_id,
        name=name,
        strategy_type="DETERMINISTIC_MOMENTUM",
        is_active=True,
    )
    api_session.add(d)
    api_session.commit()
    api_session.refresh(d)
    return d


def _make_instance(
    api_session,
    definition_id,
    user_id,
    broker_id,
    execution_mode="PAPER",
    status="DRAFT",
) -> StrategyInstance:
    """Directly create a StrategyInstance for test setup."""
    inst = StrategyInstance(
        id=uuid.uuid4(),
        strategy_definition_id=definition_id,
        user_id=user_id,
        broker_id=broker_id,
        execution_mode=execution_mode,
        status=status,
    )
    api_session.add(inst)
    api_session.commit()
    api_session.refresh(inst)
    return inst


def _make_signal(api_session, instance_id, user_id, broker_id) -> StrategySignal:
    """Directly create a StrategySignal for test setup."""
    sig = StrategySignal(
        id=uuid.uuid4(),
        strategy_instance_id=instance_id,
        user_id=user_id,
        broker_id=broker_id,
        symbol="RELIANCE",
        side="BUY",
        quantity=Decimal("10.0000"),
        order_type="MARKET",
        price=Decimal("2500.5000"),
        signal_fingerprint="abc123" + str(uuid.uuid4().hex[:8]),
        status="EXECUTED",
    )
    api_session.add(sig)
    api_session.commit()
    api_session.refresh(sig)
    return sig


# ===========================================================================
# Test 1 — Unauthenticated access (401)
# ===========================================================================


def test_unauthenticated_list_definitions_returns_401():
    app.dependency_overrides.clear()
    with TestClient(app) as unauth_client:
        res = unauth_client.get("/api/v1/strategies")
        assert res.status_code == 401


def test_unauthenticated_create_definition_returns_401():
    app.dependency_overrides.clear()
    with TestClient(app) as unauth_client:
        res = unauth_client.post("/api/v1/strategies", json={"name": "Test"})
        assert res.status_code == 401


# ===========================================================================
# Test 2 — Create strategy definition
# ===========================================================================


def test_create_strategy_definition(client, user_a):
    payload = {
        "name": "Momentum Breakout Strategy",
        "strategy_type": "DETERMINISTIC_MOMENTUM",
        "config_json": '{"threshold": 1.5}',
    }
    res = client.post("/api/v1/strategies", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Momentum Breakout Strategy"
    assert data["strategy_type"] == "DETERMINISTIC_MOMENTUM"
    assert data["user_id"] == str(user_a.id)
    assert data["is_active"] is True
    assert "id" in data
    assert "created_at" in data


def test_create_definition_default_strategy_type(client, user_a):
    payload = {"name": "Simple Strategy"}
    res = client.post("/api/v1/strategies", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["strategy_type"] == "DETERMINISTIC_MOMENTUM"


def test_create_definition_missing_name_returns_422(client):
    res = client.post("/api/v1/strategies", json={})
    assert res.status_code == 422


# ===========================================================================
# Test 3 — List strategy definitions
# ===========================================================================


def test_list_strategy_definitions_empty(client, user_a):
    res = client.get("/api/v1/strategies")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) == 0


def test_list_strategy_definitions_returns_only_own(client, user_a, user_b, api_session):
    _make_definition(api_session, user_a.id, "User A Strategy")
    _make_definition(api_session, user_b.id, "User B Strategy")

    res = client.get("/api/v1/strategies")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["name"] == "User A Strategy"
    assert data[0]["user_id"] == str(user_a.id)


# ===========================================================================
# Test 4 — Get strategy definition by ID
# ===========================================================================


def test_get_strategy_definition_success(client, user_a, api_session):
    defn = _make_definition(api_session, user_a.id)
    res = client.get(f"/api/v1/strategies/{defn.id}")
    assert res.status_code == 200
    assert res.json()["id"] == str(defn.id)


def test_get_strategy_definition_not_found_returns_404(client):
    random_id = uuid.uuid4()
    res = client.get(f"/api/v1/strategies/{random_id}")
    assert res.status_code == 404


# ===========================================================================
# Test 5 — Update strategy definition
# ===========================================================================


def test_update_strategy_definition(client, user_a, api_session):
    defn = _make_definition(api_session, user_a.id, "Old Name")
    payload = {"name": "New Name", "is_active": False}
    res = client.put(f"/api/v1/strategies/{defn.id}", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "New Name"
    assert data["is_active"] is False


def test_update_foreign_definition_returns_404(client, user_b, api_session):
    defn_b = _make_definition(api_session, user_b.id, "User B Strategy")
    res = client.put(f"/api/v1/strategies/{defn_b.id}", json={"name": "Hacked"})
    assert res.status_code == 404


# ===========================================================================
# Test 6 — Delete strategy definition
# ===========================================================================


def test_delete_strategy_definition(client, user_a, api_session):
    defn = _make_definition(api_session, user_a.id)
    res = client.delete(f"/api/v1/strategies/{defn.id}")
    assert res.status_code == 204

    # Confirm it is gone
    res2 = client.get(f"/api/v1/strategies/{defn.id}")
    assert res2.status_code == 404


def test_delete_foreign_definition_returns_404(client, user_b, api_session):
    defn_b = _make_definition(api_session, user_b.id)
    res = client.delete(f"/api/v1/strategies/{defn_b.id}")
    assert res.status_code == 404


# ===========================================================================
# Test 7 — Create strategy instance (PAPER default)
# ===========================================================================


def test_create_instance_paper_default(client, user_a, broker_a, api_session):
    defn = _make_definition(api_session, user_a.id)
    payload = {"broker_id": str(broker_a.id)}
    res = client.post(f"/api/v1/strategies/{defn.id}/instances", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["execution_mode"] == "PAPER"
    assert data["status"] == "DRAFT"
    assert data["user_id"] == str(user_a.id)
    assert data["strategy_definition_id"] == str(defn.id)


def test_create_instance_explicit_paper(client, user_a, broker_a, api_session):
    defn = _make_definition(api_session, user_a.id)
    payload = {"broker_id": str(broker_a.id), "execution_mode": "PAPER"}
    res = client.post(f"/api/v1/strategies/{defn.id}/instances", json=payload)
    assert res.status_code == 201
    assert res.json()["execution_mode"] == "PAPER"


def test_create_instance_live_mode(client, user_a, broker_a, api_session):
    defn = _make_definition(api_session, user_a.id)
    payload = {"broker_id": str(broker_a.id), "execution_mode": "LIVE"}
    res = client.post(f"/api/v1/strategies/{defn.id}/instances", json=payload)
    assert res.status_code == 201
    assert res.json()["execution_mode"] == "LIVE"


def test_create_instance_invalid_execution_mode(client, user_a, broker_a, api_session):
    defn = _make_definition(api_session, user_a.id)
    payload = {"broker_id": str(broker_a.id), "execution_mode": "FAKE"}
    res = client.post(f"/api/v1/strategies/{defn.id}/instances", json=payload)
    assert res.status_code == 422


def test_create_instance_on_foreign_definition_returns_404(client, user_b, broker_a, api_session):
    defn_b = _make_definition(api_session, user_b.id)
    payload = {"broker_id": str(broker_a.id)}
    res = client.post(f"/api/v1/strategies/{defn_b.id}/instances", json=payload)
    assert res.status_code == 404


# ===========================================================================
# Test 8 — List strategy instances
# ===========================================================================


def test_list_instances_for_definition(client, user_a, broker_a, api_session):
    defn = _make_definition(api_session, user_a.id)
    _make_instance(api_session, defn.id, user_a.id, broker_a.id, "PAPER", "DRAFT")
    _make_instance(api_session, defn.id, user_a.id, broker_a.id, "PAPER", "STOPPED")

    res = client.get(f"/api/v1/strategies/{defn.id}/instances")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2


def test_list_instances_on_foreign_definition_returns_404(client, user_b, api_session):
    defn_b = _make_definition(api_session, user_b.id)
    res = client.get(f"/api/v1/strategies/{defn_b.id}/instances")
    assert res.status_code == 404


# ===========================================================================
# Test 9 — Start strategy instance
# ===========================================================================


def test_start_instance_from_draft(client, user_a, broker_a, api_session):
    defn = _make_definition(api_session, user_a.id)
    inst = _make_instance(api_session, defn.id, user_a.id, broker_a.id, "PAPER", "DRAFT")

    res = client.post(f"/api/v1/strategies/{defn.id}/instances/{inst.id}/start")
    assert res.status_code == 200
    assert res.json()["status"] == "RUNNING"


def test_start_instance_from_ready(client, user_a, broker_a, api_session):
    defn = _make_definition(api_session, user_a.id)
    inst = _make_instance(api_session, defn.id, user_a.id, broker_a.id, "PAPER", "READY")

    res = client.post(f"/api/v1/strategies/{defn.id}/instances/{inst.id}/start")
    assert res.status_code == 200
    assert res.json()["status"] == "RUNNING"


def test_start_foreign_instance_returns_404(client, user_b, broker_a, api_session):
    defn_b = _make_definition(api_session, user_b.id)
    inst_b = _make_instance(api_session, defn_b.id, user_b.id, broker_a.id, "PAPER", "READY")

    res = client.post(f"/api/v1/strategies/{defn_b.id}/instances/{inst_b.id}/start")
    assert res.status_code == 404


# ===========================================================================
# Test 10 — Pause strategy instance
# ===========================================================================


def test_pause_running_instance(client, user_a, broker_a, api_session):
    defn = _make_definition(api_session, user_a.id)
    inst = _make_instance(api_session, defn.id, user_a.id, broker_a.id, "PAPER", "RUNNING")

    res = client.post(f"/api/v1/strategies/{defn.id}/instances/{inst.id}/pause")
    assert res.status_code == 200
    assert res.json()["status"] == "PAUSED"


def test_pause_stopped_instance_returns_400(client, user_a, broker_a, api_session):
    defn = _make_definition(api_session, user_a.id)
    inst = _make_instance(api_session, defn.id, user_a.id, broker_a.id, "PAPER", "STOPPED")

    res = client.post(f"/api/v1/strategies/{defn.id}/instances/{inst.id}/pause")
    assert res.status_code == 400


# ===========================================================================
# Test 11 — Resume strategy instance
# ===========================================================================


def test_resume_paused_instance(client, user_a, broker_a, api_session):
    defn = _make_definition(api_session, user_a.id)
    inst = _make_instance(api_session, defn.id, user_a.id, broker_a.id, "PAPER", "PAUSED")

    res = client.post(f"/api/v1/strategies/{defn.id}/instances/{inst.id}/resume")
    assert res.status_code == 200
    assert res.json()["status"] == "RUNNING"


def test_resume_stopped_instance_returns_400(client, user_a, broker_a, api_session):
    defn = _make_definition(api_session, user_a.id)
    inst = _make_instance(api_session, defn.id, user_a.id, broker_a.id, "PAPER", "STOPPED")

    res = client.post(f"/api/v1/strategies/{defn.id}/instances/{inst.id}/resume")
    assert res.status_code == 400


# ===========================================================================
# Test 12 — Stop strategy instance
# ===========================================================================


def test_stop_running_instance(client, user_a, broker_a, api_session):
    defn = _make_definition(api_session, user_a.id)
    inst = _make_instance(api_session, defn.id, user_a.id, broker_a.id, "PAPER", "RUNNING")

    res = client.post(f"/api/v1/strategies/{defn.id}/instances/{inst.id}/stop")
    assert res.status_code == 200
    assert res.json()["status"] == "STOPPED"


def test_stop_paused_instance(client, user_a, broker_a, api_session):
    defn = _make_definition(api_session, user_a.id)
    inst = _make_instance(api_session, defn.id, user_a.id, broker_a.id, "PAPER", "PAUSED")

    res = client.post(f"/api/v1/strategies/{defn.id}/instances/{inst.id}/stop")
    assert res.status_code == 200
    assert res.json()["status"] == "STOPPED"


def test_stop_already_stopped_returns_400(client, user_a, broker_a, api_session):
    defn = _make_definition(api_session, user_a.id)
    inst = _make_instance(api_session, defn.id, user_a.id, broker_a.id, "PAPER", "STOPPED")

    res = client.post(f"/api/v1/strategies/{defn.id}/instances/{inst.id}/stop")
    # STOPPED → STOPPED is not a valid transition in the FSM
    assert res.status_code == 400


# ===========================================================================
# Test 13 — Invalid lifecycle transition
# ===========================================================================


def test_invalid_lifecycle_transition_returns_400(client, user_a, broker_a, api_session):
    """Attempt DRAFT → PAUSED which is not a valid transition."""
    defn = _make_definition(api_session, user_a.id)
    inst = _make_instance(api_session, defn.id, user_a.id, broker_a.id, "PAPER", "DRAFT")

    # DRAFT cannot be directly paused
    res = client.post(f"/api/v1/strategies/{defn.id}/instances/{inst.id}/pause")
    assert res.status_code == 400


# ===========================================================================
# Test 14 — Signal history
# ===========================================================================


def test_list_signals_for_instance(client, user_a, broker_a, api_session):
    defn = _make_definition(api_session, user_a.id)
    inst = _make_instance(api_session, defn.id, user_a.id, broker_a.id, "PAPER", "RUNNING")
    _make_signal(api_session, inst.id, user_a.id, broker_a.id)
    _make_signal(api_session, inst.id, user_a.id, broker_a.id)

    res = client.get(f"/api/v1/strategies/{defn.id}/instances/{inst.id}/signals")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2
    assert data[0]["symbol"] == "RELIANCE"
    assert data[0]["side"] == "BUY"
    # Financial fields are Decimal strings
    assert isinstance(data[0]["quantity"], str)
    assert isinstance(data[0]["price"], str)


def test_list_signals_empty(client, user_a, broker_a, api_session):
    defn = _make_definition(api_session, user_a.id)
    inst = _make_instance(api_session, defn.id, user_a.id, broker_a.id, "PAPER", "DRAFT")

    res = client.get(f"/api/v1/strategies/{defn.id}/instances/{inst.id}/signals")
    assert res.status_code == 200
    assert res.json() == []


def test_list_signals_foreign_instance_returns_404(client, user_b, broker_a, api_session):
    defn_b = _make_definition(api_session, user_b.id)
    inst_b = _make_instance(api_session, defn_b.id, user_b.id, broker_a.id, "PAPER", "RUNNING")

    res = client.get(f"/api/v1/strategies/{defn_b.id}/instances/{inst_b.id}/signals")
    assert res.status_code == 404


# ===========================================================================
# Test 15 — Cross-user isolation
# ===========================================================================


def test_cross_user_definition_get_isolation(client, user_b, api_session):
    defn_b = _make_definition(api_session, user_b.id, "User B Private Strategy")
    # User A (via client) cannot see User B's definition
    res = client.get(f"/api/v1/strategies/{defn_b.id}")
    assert res.status_code == 404


def test_cross_user_definition_update_isolation(client, user_b, api_session):
    defn_b = _make_definition(api_session, user_b.id)
    res = client.put(f"/api/v1/strategies/{defn_b.id}", json={"name": "Hacked"})
    assert res.status_code == 404


def test_cross_user_definition_delete_isolation(client, user_b, api_session):
    defn_b = _make_definition(api_session, user_b.id)
    res = client.delete(f"/api/v1/strategies/{defn_b.id}")
    assert res.status_code == 404


def test_cross_user_instance_list_isolation(client, user_b, broker_a, api_session):
    defn_b = _make_definition(api_session, user_b.id)
    res = client.get(f"/api/v1/strategies/{defn_b.id}/instances")
    assert res.status_code == 404


def test_list_definitions_does_not_leak_other_users(client, user_a, user_b, api_session):
    _make_definition(api_session, user_b.id, "Secret B Strategy")
    res = client.get("/api/v1/strategies")
    assert res.status_code == 200
    names = [d["name"] for d in res.json()]
    assert "Secret B Strategy" not in names


# ===========================================================================
# Test 16 — Kill switch blocks start and resume
# ===========================================================================


def test_kill_switch_blocks_instance_start(client, user_a, broker_a, api_session):
    # Enable kill switch
    ks = TradingRiskSettings(
        user_id=None,
        broker_id=None,
        kill_switch_active=True,
    )
    api_session.add(ks)
    api_session.commit()

    defn = _make_definition(api_session, user_a.id)
    inst = _make_instance(api_session, defn.id, user_a.id, broker_a.id, "PAPER", "READY")

    res = client.post(f"/api/v1/strategies/{defn.id}/instances/{inst.id}/start")
    assert res.status_code == 400
    assert "kill switch" in res.json()["message"].lower()


def test_kill_switch_blocks_instance_resume(client, user_a, broker_a, api_session):
    # Enable kill switch
    ks = TradingRiskSettings(
        user_id=None,
        broker_id=None,
        kill_switch_active=True,
    )
    api_session.add(ks)
    api_session.commit()

    defn = _make_definition(api_session, user_a.id)
    inst = _make_instance(api_session, defn.id, user_a.id, broker_a.id, "PAPER", "PAUSED")

    res = client.post(f"/api/v1/strategies/{defn.id}/instances/{inst.id}/resume")
    assert res.status_code == 400
    assert "kill switch" in res.json()["message"].lower()


# ===========================================================================
# Test 17 — Decimal string serialization
# ===========================================================================


def test_signal_decimal_serialization(client, user_a, broker_a, api_session):
    defn = _make_definition(api_session, user_a.id)
    inst = _make_instance(api_session, defn.id, user_a.id, broker_a.id, "PAPER", "RUNNING")
    _make_signal(api_session, inst.id, user_a.id, broker_a.id)

    res = client.get(f"/api/v1/strategies/{defn.id}/instances/{inst.id}/signals")
    assert res.status_code == 200
    data = res.json()[0]
    # quantity and price must be strings, not floats
    assert isinstance(data["quantity"], str)
    assert "." in data["quantity"]
    assert isinstance(data["price"], str)
    assert "." in data["price"]


# ===========================================================================
# Test 18 — Zero credential exposure
# ===========================================================================


def test_zero_credential_exposure_in_definitions(client, user_a, api_session):
    _make_definition(api_session, user_a.id)
    res = client.get("/api/v1/strategies")
    text = res.text.lower()
    for forbidden in ["api_key", "api_secret", "access_token", "password", "authorization"]:
        assert forbidden not in text, f"Credential '{forbidden}' leaked in strategy definitions response"


def test_zero_credential_exposure_in_instances(client, user_a, broker_a, api_session):
    defn = _make_definition(api_session, user_a.id)
    _make_instance(api_session, defn.id, user_a.id, broker_a.id, "PAPER", "DRAFT")

    res = client.get(f"/api/v1/strategies/{defn.id}/instances")
    text = res.text.lower()
    for forbidden in ["api_key", "api_secret", "access_token", "password", "authorization"]:
        assert forbidden not in text, f"Credential '{forbidden}' leaked in instances response"


def test_zero_credential_exposure_in_signals(client, user_a, broker_a, api_session):
    defn = _make_definition(api_session, user_a.id)
    inst = _make_instance(api_session, defn.id, user_a.id, broker_a.id, "PAPER", "RUNNING")
    _make_signal(api_session, inst.id, user_a.id, broker_a.id)

    res = client.get(f"/api/v1/strategies/{defn.id}/instances/{inst.id}/signals")
    text = res.text.lower()
    for forbidden in ["api_key", "api_secret", "access_token", "password", "authorization"]:
        assert forbidden not in text, f"Credential '{forbidden}' leaked in signals response"
