from typing import Annotated, List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, status

from app.api.v1.routes.auth import get_current_active_user
from app.schemas.auth import UserResponse
from app.services.broker_order_service import BrokerOrderService
from app.dependencies.broker import get_broker_order_service
from app.schemas.broker_order import (
    BrokerOrderCreateRequest,
    BrokerOrderModifyRequest,
    BrokerOrderCancelRequest,
    BrokerOrderResponse,
    BrokerOrderActionResultResponse,
)

router = APIRouter(
    prefix="/broker-orders",
    tags=["Broker Orders"],
    dependencies=[Depends(get_current_active_user)],
)


@router.post(
    "/{broker_id}",
    status_code=status.HTTP_201_CREATED,
    response_model=BrokerOrderResponse,
    summary="Place a new broker order",
)
def place_order(
    broker_id: UUID,
    payload: BrokerOrderCreateRequest,
    service: Annotated[BrokerOrderService, Depends(get_broker_order_service)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> BrokerOrderResponse:
    """Place a new order through the specified broker account."""
    domain_request = payload.to_domain_request()
    order = service.place_order(
        user_id=current_user.id,
        broker_id=broker_id,
        request=domain_request,
    )
    return BrokerOrderResponse.from_domain(order)


@router.put(
    "/{broker_id}/{order_id}",
    status_code=status.HTTP_200_OK,
    response_model=BrokerOrderActionResultResponse,
    summary="Modify an existing broker order",
)
def modify_order(
    broker_id: UUID,
    order_id: str,
    payload: BrokerOrderModifyRequest,
    service: Annotated[BrokerOrderService, Depends(get_broker_order_service)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> BrokerOrderActionResultResponse:
    """Modify an existing order on the specified broker account."""
    domain_request = payload.to_domain_request()
    result = service.modify_order(
        user_id=current_user.id,
        broker_id=broker_id,
        order_id=order_id,
        request=domain_request,
    )
    return BrokerOrderActionResultResponse.from_domain(result)


@router.post(
    "/{broker_id}/{order_id}/cancel",
    status_code=status.HTTP_200_OK,
    response_model=BrokerOrderActionResultResponse,
    summary="Cancel an existing broker order",
)
def cancel_order(
    broker_id: UUID,
    order_id: str,
    service: Annotated[BrokerOrderService, Depends(get_broker_order_service)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
    payload: Optional[BrokerOrderCancelRequest] = None,
) -> BrokerOrderActionResultResponse:
    """Cancel an existing order on the specified broker account."""
    cancel_payload = payload or BrokerOrderCancelRequest()
    domain_request = cancel_payload.to_domain_request(order_id=order_id)
    result = service.cancel_order(
        user_id=current_user.id,
        broker_id=broker_id,
        request=domain_request,
    )
    return BrokerOrderActionResultResponse.from_domain(result)


@router.get(
    "/{broker_id}",
    status_code=status.HTTP_200_OK,
    response_model=List[BrokerOrderResponse],
    summary="Get recent broker orders",
)
def get_orders(
    broker_id: UUID,
    service: Annotated[BrokerOrderService, Depends(get_broker_order_service)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> List[BrokerOrderResponse]:
    """Retrieve recent orders for the specified broker account."""
    orders = service.get_orders(
        user_id=current_user.id,
        broker_id=broker_id,
    )
    return [BrokerOrderResponse.from_domain(o) for o in orders]
