from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, status, HTTPException
from fastapi.responses import JSONResponse

from app.core.response import success_response
from app.dependencies.broker import get_broker_service
from app.dependencies.auth import RoleChecker
from app.database.models.user import UserRole
from app.services.broker_service import BrokerService
from app.schemas.broker import BrokerCreate, BrokerUpdate, BrokerResponse

router = APIRouter(
    prefix="/brokers",
    tags=["Brokers"],
)

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=None,
    summary="Create a new broker",
    dependencies=[Depends(RoleChecker([UserRole.ADMIN]))],
)
def create_broker(
    payload: BrokerCreate,
    service: Annotated[BrokerService, Depends(get_broker_service)],
) -> JSONResponse:
    broker = service.create_broker(payload.model_dump())
    return success_response(
        message="Broker created successfully.",
        data=BrokerResponse.model_validate(broker).model_dump(mode="json"),
        status_code=status.HTTP_201_CREATED,
    )

@router.get(
    "",
    status_code=status.HTTP_200_OK,
    response_model=None,
    summary="List all brokers",
    dependencies=[Depends(RoleChecker([UserRole.ADMIN]))],
)
def list_brokers(
    service: Annotated[BrokerService, Depends(get_broker_service)],
) -> JSONResponse:
    brokers = service.list_brokers()
    return success_response(
        message="Brokers retrieved successfully.",
        data=[BrokerResponse.model_validate(b).model_dump(mode="json") for b in brokers],
    )

@router.get(
    "/{broker_id}",
    status_code=status.HTTP_200_OK,
    response_model=None,
    summary="Get broker by ID",
    dependencies=[Depends(RoleChecker([UserRole.ADMIN]))],
)
def get_broker(
    broker_id: UUID,
    service: Annotated[BrokerService, Depends(get_broker_service)],
) -> JSONResponse:
    broker = service.get_broker(broker_id)
    return success_response(
        message="Broker retrieved successfully.",
        data=BrokerResponse.model_validate(broker).model_dump(mode="json"),
    )

@router.put(
    "/{broker_id}",
    status_code=status.HTTP_200_OK,
    response_model=None,
    summary="Update broker",
    dependencies=[Depends(RoleChecker([UserRole.ADMIN]))],
)
def update_broker(
    broker_id: UUID,
    payload: BrokerUpdate,
    service: Annotated[BrokerService, Depends(get_broker_service)],
) -> JSONResponse:
    broker = service.update_broker(broker_id, payload.model_dump(exclude_unset=True))
    return success_response(
        message="Broker updated successfully.",
        data=BrokerResponse.model_validate(broker).model_dump(mode="json"),
    )

@router.delete(
    "/{broker_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete broker",
    dependencies=[Depends(RoleChecker([UserRole.ADMIN]))],
)
def delete_broker(
    broker_id: UUID,
    service: Annotated[BrokerService, Depends(get_broker_service)],
):
    service.delete_broker(broker_id)
    return None
