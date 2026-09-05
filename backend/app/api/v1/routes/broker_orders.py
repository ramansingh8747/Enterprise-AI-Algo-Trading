from typing import Annotated, List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, status

from app.api.v1.routes.auth import get_current_active_user
from app.schemas.auth import UserResponse
from app.services.broker_order_service import BrokerOrderService
from app.dependencies.broker import get_broker_order_service
from app.dependencies.portfolio_valuation import get_portfolio_valuation_service
from app.services.portfolio_valuation_service import PortfolioValuationService
from app.schemas.portfolio_valuation import PortfolioValuationResponse
from app.schemas.broker_order import (
    BrokerOrderCreateRequest,
    BrokerOrderModifyRequest,
    BrokerOrderCancelRequest,
    BrokerOrderResponse,
    BrokerOrderActionResultResponse,
    BrokerOrderLedgerResponse,
    TradingExecutionResponse,
    TradingPositionResponse,
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
    x_idempotency_key: Annotated[Optional[str], Header(alias="X-Idempotency-Key")] = None,
) -> BrokerOrderResponse:
    """Place a new order through the specified broker account."""
    domain_request = payload.to_domain_request()
    order = service.place_order(
        user_id=current_user.id,
        broker_id=broker_id,
        request=domain_request,
        idempotency_key=x_idempotency_key,
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




@router.post(
    "/{broker_id}/reconcile",
    status_code=status.HTTP_200_OK,
    response_model=List[BrokerOrderResponse],
    summary="Reconcile broker orders into the application order ledger",
)
def reconcile_orders(
    broker_id: UUID,
    service: Annotated[BrokerOrderService, Depends(get_broker_order_service)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> List[BrokerOrderResponse]:
    orders = service.reconcile_orders(user_id=current_user.id, broker_id=broker_id)
    return [BrokerOrderResponse.from_domain(o) for o in orders]




@router.get(
    "/{broker_id}/executions",
    status_code=status.HTTP_200_OK,
    response_model=List[TradingExecutionResponse],
    summary="Get persisted broker executions",
)
def get_executions(
    broker_id: UUID,
    service: Annotated[BrokerOrderService, Depends(get_broker_order_service)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> List[TradingExecutionResponse]:
    records = service.get_persisted_executions(user_id=current_user.id, broker_id=broker_id)
    return [TradingExecutionResponse.from_record(record) for record in records]


@router.get(
    "/{broker_id}/positions",
    status_code=status.HTTP_200_OK,
    response_model=List[TradingPositionResponse],
    summary="Get application-owned LIVE positions",
)
def get_positions(
    broker_id: UUID,
    service: Annotated[BrokerOrderService, Depends(get_broker_order_service)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> List[TradingPositionResponse]:
    records = service.get_positions(user_id=current_user.id, broker_id=broker_id)
    return [TradingPositionResponse.from_record(record) for record in records]


@router.get(
    "/{broker_id}/ledger",
    status_code=status.HTTP_200_OK,
    response_model=List[BrokerOrderLedgerResponse],
    summary="Get persisted application broker order lifecycle",
)
def get_order_ledger(
    broker_id: UUID,
    service: Annotated[BrokerOrderService, Depends(get_broker_order_service)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> List[BrokerOrderLedgerResponse]:
    records = service.get_persisted_orders(user_id=current_user.id, broker_id=broker_id)
    return [BrokerOrderLedgerResponse.from_record(record) for record in records]

@router.get(
    "/{broker_id}/portfolio-valuation",
    status_code=status.HTTP_200_OK,
    response_model=PortfolioValuationResponse,
    summary="Value application-owned LIVE positions and P&L",
)
def get_live_portfolio_valuation(
    broker_id: UUID,
    valuation_service: Annotated[PortfolioValuationService, Depends(get_portfolio_valuation_service)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> PortfolioValuationResponse:
    valuation = valuation_service.value_live(user_id=current_user.id, broker_id=broker_id)
    return PortfolioValuationResponse.model_validate(valuation.__dict__)


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
