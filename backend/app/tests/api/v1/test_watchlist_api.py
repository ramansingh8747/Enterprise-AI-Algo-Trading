import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.dependencies.auth import get_current_active_user
from app.dependencies.database import get_db
from app.database.models.user import User
from app.database.models.watchlist import Watchlist, WatchlistItem
from app.database.repositories.watchlist_repository import DEFAULT_WATCHLIST_SYMBOLS
import uuid

@pytest.fixture
def db_session():
    from app.dependencies.database import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def user_a(db_session):
    uid = uuid.uuid4()
    user = User(
        id=uid,
        email=f"user_a_{uid}@example.com",
        username=f"user_a_{uid}",
        full_name="User A",
        password_hash="password"
    )
    db_session.add(user)
    db_session.commit()
    return user

@pytest.fixture
def user_b(db_session):
    uid = uuid.uuid4()
    user = User(
        id=uid,
        email=f"user_b_{uid}@example.com",
        username=f"user_b_{uid}",
        full_name="User B",
        password_hash="password"
    )
    db_session.add(user)
    db_session.commit()
    return user

@pytest.fixture
def client_a(user_a):
    app.dependency_overrides[get_current_active_user] = lambda: user_a
    with TestClient(app) as tc:
        yield tc
    app.dependency_overrides.clear()

@pytest.fixture
def client_b(user_b):
    app.dependency_overrides[get_current_active_user] = lambda: user_b
    with TestClient(app) as tc:
        yield tc
    app.dependency_overrides.clear()

def test_list_watchlists_auto_creates_default(client_a):
    resp = client_a.get("/api/v1/watchlists")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    default_wl = next((w for w in data if w['is_default']), None)
    assert default_wl is not None
    assert default_wl['name'] == "Main Watchlist"
    assert len(default_wl['items']) == len(DEFAULT_WATCHLIST_SYMBOLS)

def test_create_custom_watchlist(client_a):
    payload = {"name": "Tech Equities", "is_default": False}
    resp = client_a.post("/api/v1/watchlists", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Tech Equities"
    assert data["is_default"] is False

def test_get_watchlist_by_id(client_a):
    list_resp = client_a.get("/api/v1/watchlists")
    wl_id = list_resp.json()[0]["id"]

    get_resp = client_a.get(f"/api/v1/watchlists/{wl_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == wl_id

def test_add_symbol_to_watchlist(client_a):
    list_resp = client_a.get("/api/v1/watchlists")
    wl_id = list_resp.json()[0]["id"]

    add_resp = client_a.post(f"/api/v1/watchlists/{wl_id}/items", json={"symbol": "  wipro  "})
    assert add_resp.status_code == 201
    item = add_resp.json()
    assert item["symbol"] == "WIPRO"

def test_add_duplicate_symbol_conflict(client_a):
    list_resp = client_a.get("/api/v1/watchlists")
    wl_id = list_resp.json()[0]["id"]

    client_a.post(f"/api/v1/watchlists/{wl_id}/items", json={"symbol": "TATAMOTORS"})
    dup_resp = client_a.post(f"/api/v1/watchlists/{wl_id}/items", json={"symbol": "tatamotors"})
    assert dup_resp.status_code == 409
    body = dup_resp.json()
    msg = body.get("detail") or body.get("message") or ""
    assert "already exists" in msg.lower()

def test_remove_symbol_from_watchlist(client_a):
    list_resp = client_a.get("/api/v1/watchlists")
    wl_id = list_resp.json()[0]["id"]

    client_a.post(f"/api/v1/watchlists/{wl_id}/items", json={"symbol": "AXISBANK"})
    del_resp = client_a.delete(f"/api/v1/watchlists/{wl_id}/items/AXISBANK")
    assert del_resp.status_code == 204

    # Confirm item removed
    get_resp = client_a.get(f"/api/v1/watchlists/{wl_id}")
    symbols = [it["symbol"] for it in get_resp.json()["items"]]
    assert "AXISBANK" not in symbols

def test_delete_custom_watchlist(client_a):
    create_resp = client_a.post("/api/v1/watchlists", json={"name": "Temporary Watchlist"})
    wl_id = create_resp.json()["id"]

    del_resp = client_a.delete(f"/api/v1/watchlists/{wl_id}")
    assert del_resp.status_code == 204

    get_resp = client_a.get(f"/api/v1/watchlists/{wl_id}")
    assert get_resp.status_code == 404

def test_user_isolation_cross_user_access_rejected(client_a, user_b):
    create_resp = client_a.post("/api/v1/watchlists", json={"name": "User A Private"})
    wl_id = create_resp.json()["id"]

    # Switch app override to User B
    app.dependency_overrides[get_current_active_user] = lambda: user_b

    with TestClient(app) as client_b:
        # User B attempts to access User A's watchlist
        get_resp = client_b.get(f"/api/v1/watchlists/{wl_id}")
        assert get_resp.status_code == 404

        # User B attempts to add item to User A's watchlist
        add_resp = client_b.post(f"/api/v1/watchlists/{wl_id}/items", json={"symbol": "HDFCBANK"})
        assert add_resp.status_code == 404

        # User B attempts to delete User A's watchlist
        del_resp = client_b.delete(f"/api/v1/watchlists/{wl_id}")
        assert del_resp.status_code == 404

    app.dependency_overrides.clear()


def test_unauthenticated_access_rejected():
    app.dependency_overrides.clear()
    with TestClient(app) as unauth_client:
        resp = unauth_client.get("/api/v1/watchlists")
        assert resp.status_code == 401
