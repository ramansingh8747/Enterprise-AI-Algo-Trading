from typing import Annotated, List
from uuid import UUID
from fastapi import APIRouter, Depends, status, Query

from app.dependencies.broker_provider import get_broker_provider
from app.dependencies.auth import get_current_active_user
from app.schemas.auth import UserResponse
from app.brokers.interfaces.broker_interface import BrokerInterface
from app.schemas.broker_quote import BrokerQuoteResponse
from app.brokers.base.broker_types import BrokerProfile, BrokerHolding, BrokerPosition, BrokerOrder

router = APIRouter(
    prefix="/broker-data",
    tags=["Broker Data"],
    dependencies=[Depends(get_current_active_user)],
)

@router.get("/{broker_id}/profile", response_model=BrokerProfile)
def get_broker_profile(
    provider: Annotated[BrokerInterface, Depends(get_broker_provider)]
):
    return provider.get_profile()

@router.get("/{broker_id}/holdings", response_model=List[BrokerHolding])
def get_broker_holdings(
    provider: Annotated[BrokerInterface, Depends(get_broker_provider)]
):
    return provider.get_holdings()

@router.get("/{broker_id}/positions", response_model=List[BrokerPosition])
def get_broker_positions(
    provider: Annotated[BrokerInterface, Depends(get_broker_provider)]
):
    return provider.get_positions()

@router.get("/{broker_id}/orders", response_model=List[BrokerOrder])
def get_broker_orders(
    provider: Annotated[BrokerInterface, Depends(get_broker_provider)]
):
    return provider.get_orders()

@router.get("/{broker_id}/quotes", response_model=List[BrokerQuoteResponse])
def get_broker_quotes(
    symbols: Annotated[List[str], Query(...)],
    provider: Annotated[BrokerInterface, Depends(get_broker_provider)]
):
    return provider.get_quotes(symbols)
