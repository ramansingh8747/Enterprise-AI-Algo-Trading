import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.dependencies.auth import get_current_active_user_ws
from unittest.mock import MagicMock
import uuid

# Helper to mock user
@pytest.fixture
def mock_user():
    user = MagicMock()
    user.id = uuid.uuid4()
    return user

def test_websocket_connection_unauthorized():
    client = TestClient(app)
    # No auth header or token
    with pytest.raises(Exception): 
        with client.websocket_connect("/api/v1/ws") as websocket:
            pass

def test_websocket_connection_authenticated(mock_user):
    client = TestClient(app)
    
    # Override auth dependency
    app.dependency_overrides[get_current_active_user_ws] = lambda: mock_user
    
    with client.websocket_connect("/api/v1/ws", headers={"Authorization": "Bearer fake_token"}) as websocket:
        # Check connection
        websocket.send_json({"type": "ping"})
        response = websocket.receive_json()
        assert response == {"type": "pong"}
    
    app.dependency_overrides = {}

def test_websocket_connection_with_token_query_param(mock_user):
    client = TestClient(app)
    app.dependency_overrides[get_current_active_user_ws] = lambda: mock_user
    
    with client.websocket_connect("/api/v1/ws?token=fake_token") as websocket:
        websocket.send_json({"type": "ping"})
        response = websocket.receive_json()
        assert response == {"type": "pong"}
    
    app.dependency_overrides = {}
