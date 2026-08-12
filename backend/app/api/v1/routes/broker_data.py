from typing import Annotated, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query

from app.dependencies.broker import get_broker_service
from app.dependencies.auth import get_current_active_user
from app.schemas.auth import UserResponse
from app.services.broker_service import BrokerService
from app.schemas.broker_quote import BrokerQuoteResponse
from app.brokers.base.broker_types import BrokerProfile, BrokerHolding, BrokerPosition, BrokerOrder

router = APIRouter(
    prefix="/broker-data",
    tags=["Broker Data"],
    dependencies=[Depends(get_current_active_user)],
)

@router.get("/{broker_id}/profile", response_model=BrokerProfile)
def get_broker_profile(
    broker_id: UUID,
    service: Annotated[BrokerService, Depends(get_broker_service)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
):
    return service.get_profile(current_user.id, broker_id)

@router.get("/{broker_id}/holdings", response_model=List[BrokerHolding])
def get_broker_holdings(
    broker_id: UUID,
    service: Annotated[BrokerService, Depends(get_broker_service)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
):
    return service.get_holdings(current_user.id, broker_id)

@router.get("/{broker_id}/positions", response_model=List[BrokerPosition])
def get_broker_positions(
    broker_id: UUID,
    service: Annotated[BrokerService, Depends(get_broker_service)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
):
    return service.get_positions(current_user.id, broker_id)

@router.get("/{broker_id}/orders", response_model=List[BrokerOrder])
def get_broker_orders(
    broker_id: UUID,
    service: Annotated[BrokerService, Depends(get_broker_service)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
):
    return service.get_orders(current_user.id, broker_id)

@router.get("/{broker_id}/quotes", response_model=List[BrokerQuoteResponse])
def get_broker_quotes(
    broker_id: UUID,
    symbols: Annotated[List[str], Query(...)],
    service: Annotated[BrokerService, Depends(get_broker_service)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
):
    return service.get_quotes(current_user.id, broker_id, symbols)
