from typing import Annotated
from fastapi import Depends
from app.dependencies.event_bus import get_event_bus
from app.services.event_bus.bus import EventBus
from app.services.market_data.market_data_provider import MarketDataProvider
from app.services.market_data.live_market_data_manager import LiveMarketDataManager


def get_market_data_provider(
    event_bus: Annotated[EventBus, Depends(get_event_bus)],
) -> MarketDataProvider:
    """FastAPI dependency constructing MarketDataProvider."""
    return MarketDataProvider(event_publisher=event_bus)


def get_live_market_data_manager(
    provider: Annotated[MarketDataProvider, Depends(get_market_data_provider)],
) -> LiveMarketDataManager:
    """FastAPI dependency constructing LiveMarketDataManager."""
    return LiveMarketDataManager(market_data_provider=provider)
