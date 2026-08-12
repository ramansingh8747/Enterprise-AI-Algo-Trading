from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, status
from typing import Annotated
from app.dependencies.auth import get_current_active_user
from app.schemas.auth import UserResponse
from app.dependencies.event_bus import get_connection_manager
from app.services.event_bus.connection_manager import WebSocketConnectionManager

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
    manager: Annotated[WebSocketConnectionManager, Depends(get_connection_manager)],
):
    await manager.connect(websocket, current_user.id)
    try:
        while True:
            data = await websocket.receive_json()
            if "type" in data and data["type"] == "subscribe":
                topic = data.get("topic")
                if topic:
                    await manager.subscribe(websocket, current_user.id, topic)
            elif "type" in data and data["type"] == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        await manager.disconnect(websocket, current_user.id)
    except Exception as e:
        await manager.send_error(websocket, status.HTTP_500_INTERNAL_SERVER_ERROR, "Internal Server Error")
        await manager.disconnect(websocket, current_user.id)
