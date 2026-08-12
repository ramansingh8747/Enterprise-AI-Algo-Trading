# WebSocket Connection Manager Implementation

## Overview
This document describes the implementation of the WebSocket authentication and connection management infrastructure.

## Authentication
- Uses `Authorization: Bearer <access_token>`.
- FastAPI `Depends(get_current_active_user)` enforces JWT validation.

## WebSocketConnectionManager
- `connect(websocket, user_id)`: Registers a new WebSocket connection.
- `disconnect(websocket, user_id)`: Unregisters and cleans up subscriber tasks.
- `subscribe(websocket, user_id, topic)`: Subscribes a user to an EventBus topic.

## Isolation
- Connections are stored in `active_connections: Dict[UUID, Set[WebSocket]]`.
- Topic subscription authorization is checked in `subscribe()`.

## Error Handling
- WebSocket errors are returned as JSON messages with `{"type": "error", ...}`.
