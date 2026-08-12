from app.services.event_bus.bus import EventBus
from app.services.event_bus.connection_manager import WebSocketConnectionManager

_event_bus = EventBus()
_connection_manager = WebSocketConnectionManager(_event_bus)

def get_event_bus() -> EventBus:
    return _event_bus

def get_connection_manager() -> WebSocketConnectionManager:
    return _connection_manager
