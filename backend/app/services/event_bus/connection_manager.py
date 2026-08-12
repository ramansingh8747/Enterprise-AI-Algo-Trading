import asyncio
import logging
import json
from typing import Dict, Set, Optional
from uuid import UUID
from fastapi import WebSocket, WebSocketDisconnect
from app.services.event_bus.interfaces import EventSubscriber
from app.services.event_bus.models import Event
from app.services.event_bus.bus import EventBus

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
        # Basic authorization: check if topic is authorized for the user.
        # Currently, all strategy:* topics are implicitly authorized if they belong to the user.
        # Later, we will add repository-based ownership checks.
        
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
