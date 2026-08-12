import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.dependencies.database import get_db
from app.main import app

# Create in-memory SQLite engine for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


from app.main import app as fastapi_app

client = TestClient(fastapi_app)


@pytest.fixture(autouse=True)
def setup_db():
    fastapi_app.dependency_overrides[get_db] = override_get_db
    import app.database.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    fastapi_app.dependency_overrides.pop(get_db, None)







def test_health_check():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_register_user_success():
    import uuid
    uid = uuid.uuid4().hex[:6]
    email = f"trader_{uid}@example.com"
    username = f"trader_{uid}"
    payload = {
        "email": email,
        "username": username,
        "full_name": "Pro Trader",
        "password": "Password123",
        "role": "TRADER"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["data"]["email"] == email
    assert res_data["data"]["username"] == username
    assert res_data["data"]["role"] == "TRADER"

    assert "password_hash" not in res_data["data"]


def test_register_duplicate_email():
    payload = {
        "email": "duplicate@example.com",
        "username": "user1",
        "full_name": "User One",
        "password": "Password123",
        "role": "TRADER"
    }
    client.post("/api/v1/auth/register", json=payload)
    
    payload2 = {
        "email": "duplicate@example.com",
        "username": "user2",
        "full_name": "User Two",
        "password": "Password123",
        "role": "TRADER"
    }
    response = client.post("/api/v1/auth/register", json=payload2)
    assert response.status_code == 409
    assert response.json()["success"] is False


def test_login_success():
    reg_payload = {
        "email": "login@example.com",
        "username": "loginuser",
        "full_name": "Login User",
        "password": "Password123",
        "role": "TRADER"
    }
    client.post("/api/v1/auth/register", json=reg_payload)

    login_payload = {
        "email": "login@example.com",
        "password": "Password123"
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    assert "access_token" in res_data["data"]
    assert "refresh_token" in res_data["data"]
    assert res_data["data"]["user"]["email"] == "login@example.com"


def test_login_invalid_password():
    reg_payload = {
        "email": "invalidpass@example.com",
        "username": "invalidpass",
        "full_name": "Invalid Pass",
        "password": "Password123",
        "role": "TRADER"
    }
    client.post("/api/v1/auth/register", json=reg_payload)

    login_payload = {
        "email": "invalidpass@example.com",
        "password": "WrongPassword123"
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 401
    assert response.json()["success"] is False


def test_refresh_token_success():
    reg_payload = {
        "email": "refresh@example.com",
        "username": "refreshuser",
        "full_name": "Refresh User",
        "password": "Password123",
        "role": "TRADER"
    }
    client.post("/api/v1/auth/register", json=reg_payload)

    login_res = client.post("/api/v1/auth/login", json={
        "email": "refresh@example.com",
        "password": "Password123"
    })
    refresh_token = login_res.json()["data"]["refresh_token"]

    refresh_res = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_res.status_code == 200
    ref_data = refresh_res.json()
    assert ref_data["success"] is True
    assert "access_token" in ref_data["data"]
    assert "refresh_token" in ref_data["data"]


def test_get_me_success():
    reg_payload = {
        "email": "me@example.com",
        "username": "meuser",
        "full_name": "Me User",
        "password": "Password123",
        "role": "ANALYST"
    }
    client.post("/api/v1/auth/register", json=reg_payload)

    login_res = client.post("/api/v1/auth/login", json={
        "email": "me@example.com",
        "password": "Password123"
    })
    access_token = login_res.json()["data"]["access_token"]

    me_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["success"] is True
    assert me_data["data"]["email"] == "me@example.com"
    assert me_data["data"]["role"] == "ANALYST"
