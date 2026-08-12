"""
Strategy CRUD REST API Router.

Provides endpoints for:
  - StrategyDefinition lifecycle (create, list, get, update, delete)
  - StrategyInstance management (create, list, start, stop, pause, resume)
  - StrategySignal history (read-only)

Security boundaries:
  - All endpoints require a valid JWT (get_current_active_user).
  - All queries are scoped to the authenticated user's user_id.
  - Cross-user access returns 404 (not 403) to avoid resource enumeration.
  - PAPER is the default execution_mode for new instances.
  - LIVE mode is allowed but validated against broker context.
  - Strategy API never directly places broker orders.
  - No credential fields (api_key, api_secret, access_token) in any response.

Kill switch:
  - Starting an instance is blocked when kill_switch_active is True for the user.

Lifecycle FSM (enforced by StrategyRepository):
  DRAFT    → READY, STOPPED
  READY    → RUNNING, STOPPED
  RUNNING  → PAUSED, STOPPED, FAILED
  PAUSED   → RUNNING, STOPPED
  STOPPED  → READY, DRAFT
  FAILED   → STOPPED, DRAFT
"""

import logging
from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.v1.routes.auth import get_current_active_user
from app.database.repositories.strategy_repository import StrategyRepository
from app.database.repositories.trading_risk_repository import TradingRiskRepository
from app.dependencies.strategy import get_strategy_repository, get_strategy_runner
from app.dependencies.database import get_db
from app.exceptions.strategy_exceptions import InvalidLifecycleTransitionException
from app.schemas.auth import UserResponse
from app.schemas.strategy import (
    StrategyDefinitionCreateRequest,
    StrategyDefinitionResponse,
    StrategyDefinitionUpdateRequest,
    StrategyInstanceCreateRequest,
    StrategyInstanceResponse,
    StrategySignalResponse,
)
from app.services.strategy_engine.strategy_runner import StrategyRunner

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/strategies",
    tags=["Strategies"],
)

VALID_EXECUTION_MODES = {"PAPER", "LIVE"}


def _get_risk_repository(db: Session = Depends(get_db)) -> TradingRiskRepository:
    return TradingRiskRepository(db)


# ---------------------------------------------------------------------------
# Strategy Definition endpoints
# ---------------------------------------------------------------------------


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=StrategyDefinitionResponse,
    summary="Create a new strategy definition",
)
def create_strategy_definition(
    payload: StrategyDefinitionCreateRequest,
    repository: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> StrategyDefinitionResponse:
    """Create a new strategy definition owned by the authenticated user."""
    definition = repository.create_definition(
        user_id=current_user.id,
        name=payload.name,
        strategy_type=payload.strategy_type,
        config_json=payload.config_json,
    )
    logger.info(
        "strategy_definition_created | user_id=%s | definition_id=%s | name=%s",
        current_user.id,
        definition.id,
        definition.name,
    )
    return StrategyDefinitionResponse.model_validate(definition)


@router.get(
    "",
    status_code=status.HTTP_200_OK,
    response_model=List[StrategyDefinitionResponse],
    summary="List strategy definitions for current user",
)
def list_strategy_definitions(
    repository: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> List[StrategyDefinitionResponse]:
    """List all strategy definitions owned by the authenticated user."""
    definitions = repository.list_definitions_for_user(user_id=current_user.id)
    return [StrategyDefinitionResponse.model_validate(d) for d in definitions]


@router.get(
    "/{definition_id}",
    status_code=status.HTTP_200_OK,
    response_model=StrategyDefinitionResponse,
    summary="Get a strategy definition by ID",
)
def get_strategy_definition(
    definition_id: UUID,
    repository: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> StrategyDefinitionResponse:
    """Retrieve a specific strategy definition. Returns 404 if not found or not owned."""
    definition = repository.get_definition_for_user(
        definition_id=definition_id, user_id=current_user.id
    )
    if not definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy definition {definition_id} not found.",
        )
    return StrategyDefinitionResponse.model_validate(definition)


@router.put(
    "/{definition_id}",
    status_code=status.HTTP_200_OK,
    response_model=StrategyDefinitionResponse,
    summary="Update a strategy definition",
)
def update_strategy_definition(
    definition_id: UUID,
    payload: StrategyDefinitionUpdateRequest,
    repository: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> StrategyDefinitionResponse:
    """Update allowed fields on a strategy definition.

    Only provided fields are updated (partial update semantics).
    Returns 404 if not found or not owned by the current user.
    """
    updates = payload.model_dump(exclude_unset=True)
    definition = repository.update_definition(
        definition_id=definition_id,
        user_id=current_user.id,
        updates=updates,
    )
    if not definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy definition {definition_id} not found.",
        )
    logger.info(
        "strategy_definition_updated | user_id=%s | definition_id=%s | fields=%s",
        current_user.id,
        definition_id,
        list(updates.keys()),
    )
    return StrategyDefinitionResponse.model_validate(definition)


@router.delete(
    "/{definition_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a strategy definition",
)
def delete_strategy_definition(
    definition_id: UUID,
    repository: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> None:
    """Permanently delete a strategy definition and all its instances.

    Returns 404 if not found or not owned by the current user.
    """
    deleted = repository.delete_definition(
        definition_id=definition_id, user_id=current_user.id
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy definition {definition_id} not found.",
        )
    logger.info(
        "strategy_definition_deleted | user_id=%s | definition_id=%s",
        current_user.id,
        definition_id,
    )
    return None


# ---------------------------------------------------------------------------
# Strategy Instance endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/{definition_id}/instances",
    status_code=status.HTTP_201_CREATED,
    response_model=StrategyInstanceResponse,
    summary="Create a strategy instance",
)
def create_strategy_instance(
    definition_id: UUID,
    payload: StrategyInstanceCreateRequest,
    repository: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> StrategyInstanceResponse:
    """Create a new strategy instance for a definition.

    - Default execution_mode is PAPER.
    - The definition must be owned by the authenticated user.
    - New instances are created in DRAFT status.
    """
    # Validate execution mode
    mode = payload.execution_mode.upper()
    if mode not in VALID_EXECUTION_MODES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid execution_mode '{payload.execution_mode}'. Must be PAPER or LIVE.",
        )

    # Verify definition ownership
    definition = repository.get_definition_for_user(
        definition_id=definition_id, user_id=current_user.id
    )
    if not definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy definition {definition_id} not found.",
        )

    instance = repository.create_instance(
        definition_id=definition_id,
        user_id=current_user.id,
        broker_id=payload.broker_id,
        execution_mode=mode,
    )
    logger.info(
        "strategy_instance_created | user_id=%s | definition_id=%s | instance_id=%s | mode=%s",
        current_user.id,
        definition_id,
        instance.id,
        mode,
    )
    return StrategyInstanceResponse.model_validate(instance)


@router.get(
    "/{definition_id}/instances",
    status_code=status.HTTP_200_OK,
    response_model=List[StrategyInstanceResponse],
    summary="List strategy instances for a definition",
)
def list_strategy_instances(
    definition_id: UUID,
    repository: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> List[StrategyInstanceResponse]:
    """List all instances of a strategy definition owned by the current user.

    Returns 404 if the definition is not found or not owned.
    """
    # Verify definition ownership first
    definition = repository.get_definition_for_user(
        definition_id=definition_id, user_id=current_user.id
    )
    if not definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy definition {definition_id} not found.",
        )

    instances = repository.list_instances_for_definition(
        definition_id=definition_id, user_id=current_user.id
    )
    return [StrategyInstanceResponse.model_validate(inst) for inst in instances]


@router.post(
    "/{definition_id}/instances/{instance_id}/start",
    status_code=status.HTTP_200_OK,
    response_model=StrategyInstanceResponse,
    summary="Start a strategy instance (transition to RUNNING)",
)
def start_strategy_instance(
    definition_id: UUID,
    instance_id: UUID,
    repository: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    runner: Annotated[StrategyRunner, Depends(get_strategy_runner)],
    risk_repository: Annotated[TradingRiskRepository, Depends(_get_risk_repository)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> StrategyInstanceResponse:
    """Start a strategy instance.

    Enforces:
    - Definition ownership
    - Instance ownership
    - Kill switch check (blocked if kill_switch_active)
    - Valid lifecycle transition (must be in READY state to start)

    Lifecycle: READY → RUNNING
    """
    # Kill switch check
    risk_settings = risk_repository.get_risk_settings(user_id=current_user.id)
    if risk_settings.kill_switch_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trading is currently halted. Kill switch is active. Deactivate it before starting a strategy.",
        )

    # Verify definition ownership
    definition = repository.get_definition_for_user(
        definition_id=definition_id, user_id=current_user.id
    )
    if not definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy definition {definition_id} not found.",
        )

    # Verify instance ownership
    instance = repository.get_instance_for_user(
        instance_id=instance_id, user_id=current_user.id
    )
    if not instance or instance.strategy_definition_id != definition_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy instance {instance_id} not found.",
        )

    try:
        instance = runner.start_instance(instance_id=instance_id, user_id=current_user.id)
    except InvalidLifecycleTransitionException as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    logger.info(
        "strategy_instance_started | user_id=%s | instance_id=%s",
        current_user.id,
        instance_id,
    )
    return StrategyInstanceResponse.model_validate(instance)


@router.post(
    "/{definition_id}/instances/{instance_id}/stop",
    status_code=status.HTTP_200_OK,
    response_model=StrategyInstanceResponse,
    summary="Stop a strategy instance (transition to STOPPED)",
)
def stop_strategy_instance(
    definition_id: UUID,
    instance_id: UUID,
    repository: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    runner: Annotated[StrategyRunner, Depends(get_strategy_runner)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> StrategyInstanceResponse:
    """Stop a running or paused strategy instance.

    Lifecycle: RUNNING | PAUSED | READY → STOPPED
    """
    # Verify definition ownership
    definition = repository.get_definition_for_user(
        definition_id=definition_id, user_id=current_user.id
    )
    if not definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy definition {definition_id} not found.",
        )

    instance = repository.get_instance_for_user(
        instance_id=instance_id, user_id=current_user.id
    )
    if not instance or instance.strategy_definition_id != definition_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy instance {instance_id} not found.",
        )

    try:
        instance = runner.stop_instance(instance_id=instance_id, user_id=current_user.id)
    except InvalidLifecycleTransitionException as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    logger.info(
        "strategy_instance_stopped | user_id=%s | instance_id=%s",
        current_user.id,
        instance_id,
    )
    return StrategyInstanceResponse.model_validate(instance)


@router.post(
    "/{definition_id}/instances/{instance_id}/pause",
    status_code=status.HTTP_200_OK,
    response_model=StrategyInstanceResponse,
    summary="Pause a running strategy instance (transition to PAUSED)",
)
def pause_strategy_instance(
    definition_id: UUID,
    instance_id: UUID,
    repository: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    runner: Annotated[StrategyRunner, Depends(get_strategy_runner)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> StrategyInstanceResponse:
    """Pause a RUNNING strategy instance.

    Lifecycle: RUNNING → PAUSED
    """
    # Verify definition ownership
    definition = repository.get_definition_for_user(
        definition_id=definition_id, user_id=current_user.id
    )
    if not definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy definition {definition_id} not found.",
        )

    instance = repository.get_instance_for_user(
        instance_id=instance_id, user_id=current_user.id
    )
    if not instance or instance.strategy_definition_id != definition_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy instance {instance_id} not found.",
        )

    try:
        instance = runner.pause_instance(instance_id=instance_id, user_id=current_user.id)
    except InvalidLifecycleTransitionException as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    logger.info(
        "strategy_instance_paused | user_id=%s | instance_id=%s",
        current_user.id,
        instance_id,
    )
    return StrategyInstanceResponse.model_validate(instance)


@router.post(
    "/{definition_id}/instances/{instance_id}/resume",
    status_code=status.HTTP_200_OK,
    response_model=StrategyInstanceResponse,
    summary="Resume a paused strategy instance (transition to RUNNING)",
)
def resume_strategy_instance(
    definition_id: UUID,
    instance_id: UUID,
    repository: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    runner: Annotated[StrategyRunner, Depends(get_strategy_runner)],
    risk_repository: Annotated[TradingRiskRepository, Depends(_get_risk_repository)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> StrategyInstanceResponse:
    """Resume a PAUSED strategy instance.

    Also enforces kill switch check on resume.

    Lifecycle: PAUSED → RUNNING
    """
    # Kill switch check
    risk_settings = risk_repository.get_risk_settings(user_id=current_user.id)
    if risk_settings.kill_switch_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trading is currently halted. Kill switch is active. Deactivate it before resuming a strategy.",
        )

    # Verify definition ownership
    definition = repository.get_definition_for_user(
        definition_id=definition_id, user_id=current_user.id
    )
    if not definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy definition {definition_id} not found.",
        )

    instance = repository.get_instance_for_user(
        instance_id=instance_id, user_id=current_user.id
    )
    if not instance or instance.strategy_definition_id != definition_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy instance {instance_id} not found.",
        )

    try:
        instance = runner.resume_instance(instance_id=instance_id, user_id=current_user.id)
    except InvalidLifecycleTransitionException as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    logger.info(
        "strategy_instance_resumed | user_id=%s | instance_id=%s",
        current_user.id,
        instance_id,
    )
    return StrategyInstanceResponse.model_validate(instance)


# ---------------------------------------------------------------------------
# Strategy Signal history endpoint
# ---------------------------------------------------------------------------


@router.get(
    "/{definition_id}/instances/{instance_id}/signals",
    status_code=status.HTTP_200_OK,
    response_model=List[StrategySignalResponse],
    summary="Get signal history for a strategy instance",
)
def list_strategy_signals(
    definition_id: UUID,
    instance_id: UUID,
    repository: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
    limit: int = Query(default=100, ge=1, le=500, description="Maximum number of signals to return."),
) -> List[StrategySignalResponse]:
    """Get the signal execution history for a strategy instance.

    Returns signals newest-first. Ownership of both the definition and the
    instance is verified server-side.
    """
    # Verify definition ownership
    definition = repository.get_definition_for_user(
        definition_id=definition_id, user_id=current_user.id
    )
    if not definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy definition {definition_id} not found.",
        )

    # Verify instance ownership
    instance = repository.get_instance_for_user(
        instance_id=instance_id, user_id=current_user.id
    )
    if not instance or instance.strategy_definition_id != definition_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy instance {instance_id} not found.",
        )

    signals = repository.list_signals_for_instance(
        instance_id=instance_id, user_id=current_user.id, limit=limit
    )
    return [StrategySignalResponse.model_validate(s) for s in signals]
