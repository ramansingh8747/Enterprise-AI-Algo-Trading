import uuid
from decimal import Decimal
from datetime import datetime, timezone
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
from app.database.models.paper_portfolio import PaperPortfolio, PaperPosition
from app.schemas.auth import UserResponse

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


def test_list_paper_portfolios_unauthenticated():
    app.dependency_overrides.clear()
    with TestClient(app) as unauth_client:
        res = unauth_client.get("/api/v1/paper-portfolios")
        assert res.status_code == 401


def test_list_paper_portfolios_authenticated(client, user_a):
    res = client.get("/api/v1/paper-portfolios")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["execution_mode"] == "PAPER"
    assert data[0]["user_id"] == str(user_a.id)


def test_create_paper_portfolio(client, user_a):
    payload = {"name": "My Custom Paper Account"}
    res = client.post("/api/v1/paper-portfolios", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] in ["My Custom Paper Account", "Default Paper Portfolio"]
    assert data["user_id"] == str(user_a.id)
    assert data["execution_mode"] == "PAPER"


def test_get_paper_portfolio_detail_success(client, user_a, api_session):
    p = PaperPortfolio(
        user_id=user_a.id,
        name="Test Port",
        execution_mode="PAPER",
    )
    api_session.add(p)
    api_session.commit()

    res = client.get(f"/api/v1/paper-portfolios/{p.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == str(p.id)
    assert data["user_id"] == str(user_a.id)


def test_get_paper_portfolio_detail_cross_user_isolation(client, user_b, api_session):
    p_b = PaperPortfolio(
        user_id=user_b.id,
        name="User B Port",
        execution_mode="PAPER",
    )
    api_session.add(p_b)
    api_session.commit()

    # Client is authenticated as User A. Tries to access User B's portfolio -> 404 Not Found
    res = client.get(f"/api/v1/paper-portfolios/{p_b.id}")
    assert res.status_code == 404


def test_get_paper_positions(client, user_a, api_session):
    p = PaperPortfolio(user_id=user_a.id, name="Test Port", execution_mode="PAPER")
    api_session.add(p)
    api_session.commit()

    pos1 = PaperPosition(
        paper_portfolio_id=p.id,
        user_id=user_a.id,
        symbol="RELIANCE",
        quantity=Decimal("10.0000"),
        average_price=Decimal("2500.0000"),
        cost_basis=Decimal("25000.0000"),
        realized_pnl=Decimal("100.0000"),
        unrealized_pnl=Decimal("500.0000"),
    )
    pos2 = PaperPosition(
        paper_portfolio_id=p.id,
        user_id=user_a.id,
        symbol="CLOSED_SYM",
        quantity=Decimal("0.0000"),
        average_price=Decimal("0.0000"),
        cost_basis=Decimal("0.0000"),
        realized_pnl=Decimal("200.0000"),
        unrealized_pnl=Decimal("0.0000"),
    )
    api_session.add_all([pos1, pos2])
    api_session.commit()

    # Default (open only)
    res = client.get(f"/api/v1/paper-portfolios/{p.id}/positions")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["symbol"] == "RELIANCE"
    assert data[0]["quantity"] == "10.0000"

    # Include closed
    res_closed = client.get(f"/api/v1/paper-portfolios/{p.id}/positions?include_closed=true")
    assert res_closed.status_code == 200
    data_closed = res_closed.json()
    assert len(data_closed) == 2


def test_get_paper_portfolio_summary(client, user_a, api_session):
    p = PaperPortfolio(user_id=user_a.id, name="Test Port", execution_mode="PAPER")
    api_session.add(p)
    api_session.commit()

    pos1 = PaperPosition(
        paper_portfolio_id=p.id,
        user_id=user_a.id,
        symbol="TCS",
        quantity=Decimal("10.0000"),
        average_price=Decimal("3000.0000"),
        cost_basis=Decimal("30000.0000"),
        realized_pnl=Decimal("150.0000"),
        unrealized_pnl=Decimal("350.0000"),
    )
    api_session.add(pos1)
    api_session.commit()

    res = client.get(f"/api/v1/paper-portfolios/{p.id}/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["paper_portfolio_id"] == str(p.id)
    assert data["total_realized_pnl"] == "150.0000"
    assert data["total_unrealized_pnl"] == "350.0000"
    assert data["total_pnl"] == "500.0000"
    assert data["position_count"] == 1


def test_security_credential_isolation(client):
    res = client.get("/api/v1/paper-portfolios")
    text = res.text.lower()
    for forbidden in ["api_key", "api_secret", "access_token", "password", "authorization"]:
        assert forbidden not in text
