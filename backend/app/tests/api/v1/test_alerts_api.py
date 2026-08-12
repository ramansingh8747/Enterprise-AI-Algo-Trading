import pytest
from fastapi.testclient import TestClient
import uuid

from app.main import app
from app.dependencies.auth import get_current_active_user
from app.database.models.user import User, UserRole
from app.database.repositories.alert_repository import AlertRepository

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
        email=f"user_alerts_a_{uid.hex[:8]}@example.com",
        username=f"user_a_{uid.hex[:8]}",
        password_hash="password123",
        full_name="User Alerts A",
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
        email=f"user_alerts_b_{uid.hex[:8]}@example.com",
        username=f"user_b_{uid.hex[:8]}",
        password_hash="password123",
        full_name="User Alerts B",
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

def test_list_alerts_seeds_and_lists(client_a, user_a, db_session):
    repo = AlertRepository(db_session)
    repo.seed_initial_alerts(user_a.id)

    response = client_a.get("/api/v1/alerts")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3
    titles = [a["title"] for a in data]
    assert "Paper Sandbox Active" in titles
    assert "Risk Engine Active" in titles

def test_create_custom_alert(client_a):
    payload = {
        "type": "RISK",
        "severity": "WARNING",
        "title": "Margin Usage High",
        "message": "Portfolio margin usage exceeded 75%.",
        "route": "/portfolio",
    }
    response = client_a.post("/api/v1/alerts", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Margin Usage High"
    assert data["severity"] == "WARNING"
    assert data["read"] is False

def test_mark_alert_read(client_a):
    payload = {
        "type": "ORDER",
        "severity": "SUCCESS",
        "title": "Order Executed",
        "message": "BUY RELIANCE 10 Qty filled at 2450.00",
    }
    create_resp = client_a.post("/api/v1/alerts", json=payload)
    alert_id = create_resp.json()["id"]

    patch_resp = client_a.patch(f"/api/v1/alerts/{alert_id}/read")
    assert patch_resp.status_code == 200
    assert patch_resp.json()["read"] is True

def test_mark_all_alerts_read(client_a):
    client_a.post("/api/v1/alerts", json={"title": "Unread 1", "message": "msg 1"})
    client_a.post("/api/v1/alerts", json={"title": "Unread 2", "message": "msg 2"})

    resp = client_a.post("/api/v1/alerts/mark-all-read")
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    unread_resp = client_a.get("/api/v1/alerts?unread_only=true")
    assert unread_resp.status_code == 200
    assert len(unread_resp.json()) == 0

def test_delete_single_alert(client_a):
    create_resp = client_a.post("/api/v1/alerts", json={"title": "To Delete", "message": "temp"})
    alert_id = create_resp.json()["id"]

    del_resp = client_a.delete(f"/api/v1/alerts/{alert_id}")
    assert del_resp.status_code == 204

    list_resp = client_a.get("/api/v1/alerts")
    ids = [a["id"] for a in list_resp.json()]
    assert alert_id not in ids

def test_clear_all_alerts(client_a):
    client_a.post("/api/v1/alerts", json={"title": "Temp", "message": "msg"})
    clear_resp = client_a.delete("/api/v1/alerts")
    assert clear_resp.status_code == 204

    list_resp = client_a.get("/api/v1/alerts")
    assert len(list_resp.json()) == 0

def test_user_isolation_cross_user_rejection(client_a, user_a, user_b):
    app.dependency_overrides[get_current_active_user] = lambda: user_a
    create_resp = client_a.post("/api/v1/alerts", json={"title": "User A Secret Alert", "message": "Private"})
    alert_id_a = create_resp.json()["id"]

    app.dependency_overrides[get_current_active_user] = lambda: user_b

    patch_b = client_a.patch(f"/api/v1/alerts/{alert_id_a}/read")
    assert patch_b.status_code == 404

    del_b = client_a.delete(f"/api/v1/alerts/{alert_id_a}")
    assert del_b.status_code == 404

    app.dependency_overrides.clear()

def test_unauthenticated_access_rejected():
    app.dependency_overrides.clear()
    with TestClient(app) as unauth_client:
        resp = unauth_client.get("/api/v1/alerts")
        assert resp.status_code == 401
