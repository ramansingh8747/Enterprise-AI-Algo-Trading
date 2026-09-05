from typing import Annotated, List

from fastapi import APIRouter, Depends, Query, status

from app.api.v1.routes.auth import get_current_active_user
from app.dependencies.paper_orders import get_paper_order_service
from app.schemas.auth import UserResponse
from app.schemas.paper_order import PaperOrderCreateRequest, PaperOrderResponse
from app.services.paper_order_service import PaperOrderService

router = APIRouter(
    prefix="/paper-orders",
    tags=["Paper Orders"],
    dependencies=[Depends(get_current_active_user)],
)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=PaperOrderResponse,
    summary="Create and immediately fill a persisted PAPER order",
)
def create_paper_order(
    payload: PaperOrderCreateRequest,
    service: Annotated[PaperOrderService, Depends(get_paper_order_service)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> PaperOrderResponse:
    from fastapi import HTTPException
    from app.exceptions.strategy_exceptions import ExecutionPolicyViolationException
    try:
        return service.create_order(user_id=current_user.id, payload=payload)
    except (ExecutionPolicyViolationException, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.get(
    "",
    status_code=status.HTTP_200_OK,
    response_model=List[PaperOrderResponse],
    summary="List persisted PAPER orders for the authenticated user",
)
def list_paper_orders(
    service: Annotated[PaperOrderService, Depends(get_paper_order_service)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
    limit: int = Query(100, ge=1, le=500),
) -> List[PaperOrderResponse]:
    return service.list_orders(user_id=current_user.id, limit=limit)
