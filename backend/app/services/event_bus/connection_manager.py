import asyncio
import logging
import json
from typing import Dict, Set, Optional
from uuid import UUID
from fastapi import WebSocket, WebSocketDisconnect
from app.services.event_bus.interfaces import EventSubscriber
from app.services.event_bus.models import Event
from app.services.event_bus.bus import EventBus
from app.database.session import SessionLocal
from app.database.models.strategy import StrategyInstance
from app.database.models.user import User, UserRole

logger = logging.getLogger(__name__)

class WebSocketConnectionManager:
    def __init__(self, event_bus: EventBus):
        self.event_bus = event_bus
        self.active_connections: Dict[UUID, Set[WebSocket]] = {}
        self.subscriptions: Dict[UUID, Set[str]] = {}
        self.subscribers: Dict[WebSocket, EventSubscriber] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, user_id: UUID):
        await websocket.accept()
        async with self._lock:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = set()
            self.active_connections[user_id].add(websocket)
            self.subscriptions[user_id] = set()
        logger.info(f"WebSocket connected for user {user_id}")

    async def disconnect(self, websocket: WebSocket, user_id: UUID):
        async with self._lock:
            if user_id in self.active_connections:
                self.active_connections[user_id].discard(websocket)
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
            
            if websocket in self.subscribers:
                sub = self.subscribers.pop(websocket)
                await sub.close()
        
        logger.info(f"WebSocket disconnected for user {user_id}")

    async def subscribe(self, websocket: WebSocket, user_id: UUID, topic: str):
        # Strategy topic ownership authorization check
        if "strategy:" in topic:
            try:
                parts = topic.split(":")
                inst_id_str = parts[-1]
                instance_id = UUID(inst_id_str)
                with SessionLocal() as db:
                    user = db.query(User).filter(User.id == user_id).first()
                    is_admin = user and user.role == UserRole.ADMIN
                    inst = db.query(StrategyInstance).filter(StrategyInstance.id == instance_id).first()
                    if not inst or (not is_admin and inst.user_id != user_id):
                        logger.warning("Unauthorized strategy subscription attempt: user=%s topic=%s", user_id, topic)
                        await self.send_error(websocket, 403, "Forbidden: You do not own this strategy instance.")
                        return
            except (ValueError, TypeError) as e:
                logger.warning("Invalid strategy topic format: %s (%s)", topic, e)
                await self.send_error(websocket, 400, "Bad Request: Invalid strategy topic format.")
                return

        async with self._lock:
            if websocket in self.subscribers:
                # Already subscribed. In a real system, you might handle topic-level subscription.
                # Here we simplify: one subscription per WS connection.
                return
            
            subscriber = await self.event_bus.subscribe(topic)
            self.subscribers[websocket] = subscriber
            self.subscriptions[user_id].add(topic)
            
            # Start consumption task for this subscriber
            asyncio.create_task(self._consume_events(websocket, subscriber))

    async def _consume_events(self, websocket: WebSocket, subscriber: EventSubscriber):
        try:
            while True:
                event = await subscriber.consume()
                await websocket.send_json(event.model_dump())
        except Exception as e:
            logger.error(f"Error consuming events: {e}")
        finally:
            # Subscriber cleanup happens when websocket disconnects
            pass

    async def send_error(self, websocket: WebSocket, code: int, message: str):
        await websocket.send_json({"type": "error", "code": code, "message": message})
