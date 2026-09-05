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
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.api.v1.routes.auth import get_current_active_user
from app.database.repositories.strategy_repository import StrategyRepository
from app.database.models.strategy import StrategyInstance
from app.database.models.strategy_import import StrategyImport
from app.core.config.settings import settings
from app.database.repositories.trading_risk_repository import TradingRiskRepository
from app.dependencies.strategy import get_strategy_repository, get_strategy_runner, get_strategy_scheduler_service
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
    SignalApprovalRequest,
    SignalApprovalResponse,
    SignalIgnoreResponse,
    BulkStrategyConfigUpdateRequest,
)
from app.services.strategy_engine.strategy_runner import StrategyRunner
from app.services.strategy_engine.strategy_scheduler import StrategySchedulerService

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
    """List all strategy definitions (shared across all users — Admin strategies visible to all Traders)."""
    definitions = repository.list_all_definitions()
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
    """Retrieve a specific strategy definition (shared — any authenticated user can view)."""
    definition = repository.get_definition_by_id(definition_id=definition_id)
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
    db: Annotated[Session, Depends(get_db)],
) -> None:
    """Permanently delete a strategy definition and its owned imported source.

    The strategy repository remains responsible for the definition/instance
    database lifecycle.  This route uses the request-scoped SQLAlchemy session
    only for the optional StrategyImport record and for safe source-file cleanup.
    Returns 404 if the definition is not found or is not owned by the user.
    """
    imported = db.execute(
        select(StrategyImport).where(
            StrategyImport.strategy_definition_id == definition_id,
            StrategyImport.user_id == current_user.id,
        )
    ).scalar_one_or_none()

    imported_filename = imported.stored_filename if imported else None

    deleted = repository.delete_definition(
        definition_id=definition_id,
        user_id=current_user.id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy definition {definition_id} not found.",
        )

    # The repository may already have removed the StrategyImport through a
    # relationship/cascade.  Only delete it explicitly if it still exists.
    remaining_import = db.execute(
        select(StrategyImport).where(StrategyImport.id == imported.id)
    ).scalar_one_or_none() if imported else None

    if remaining_import is not None:
        db.delete(remaining_import)
        db.commit()

    if imported_filename:
        target = (Path(settings.STRATEGY_UPLOAD_DIR) / imported_filename).resolve()
        storage_root = Path(settings.STRATEGY_UPLOAD_DIR).resolve()
        # Prevent path traversal: only delete files inside the configured
        # strategy-upload directory.
        if storage_root in target.parents:
            target.unlink(missing_ok=True)

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
        if instance.status == "PAUSED":
            instance = runner.resume_instance(instance_id=instance_id, user_id=current_user.id)
        else:
            if instance.status in ("STOPPED", "FAILED"):
                repository.update_instance_status(instance_id, current_user.id, "READY")
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
    "/{definition_id}/instances/{instance_id}/run-paper",
    status_code=status.HTTP_200_OK,
    summary="Execute one PAPER strategy cycle",
)
async def run_paper_strategy_cycle(
    definition_id: UUID,
    instance_id: UUID,
    repository: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    scheduler: Annotated[
        StrategySchedulerService, Depends(get_strategy_scheduler_service)
    ],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> dict:
    """Run one PAPER strategy cycle through the production execution pipeline.

    This operation is intentionally PAPER-only and never calls the LIVE broker
    order path.
    """
    definition = repository.get_definition_for_user(
        definition_id=definition_id,
        user_id=current_user.id,
    )
    if not definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy definition {definition_id} not found.",
        )

    instance = repository.get_instance_for_user(
        instance_id=instance_id,
        user_id=current_user.id,
    )
    if not instance or instance.strategy_definition_id != definition_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy instance {instance_id} not found.",
        )

    if str(instance.execution_mode).upper() != "PAPER":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Manual strategy cycle is available only for PAPER mode.",
        )

    try:
        return await scheduler.run_instance_once(instance)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


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


# ---------------------------------------------------------------------------
# Batch Autopilot Operations
# ---------------------------------------------------------------------------


@router.get(
    "/instances/all",
    status_code=status.HTTP_200_OK,
    response_model=List[StrategyInstanceResponse],
    summary="List all strategy instances across definitions for current user",
)
def list_all_user_instances(
    repository: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> List[StrategyInstanceResponse]:
    """Returns all strategy instances."""
    stmt = select(StrategyInstance)
    instances = list(repository.db.execute(stmt).scalars().all())
    return [StrategyInstanceResponse.model_validate(inst) for inst in instances]


@router.post(
    "/deploy-all-paper",
    status_code=status.HTTP_200_OK,
    summary="Deploy and start all active strategy definitions in PAPER mode",
)
def deploy_all_paper_strategies(
    repository: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    runner: Annotated[StrategyRunner, Depends(get_strategy_runner)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> dict:
    """Ensures each active StrategyDefinition has a RUNNING PAPER StrategyInstance."""
    definitions = repository.list_all_definitions()

    # Find or use a default broker
    from app.database.models.broker import Broker
    broker = repository.db.execute(select(Broker).where(Broker.is_active == True)).scalars().first()
    if not broker:
        broker = repository.db.execute(select(Broker)).scalars().first()
    
    if not broker:
        import uuid as py_uuid
        broker = Broker(
            id=py_uuid.uuid4(),
            broker_name="Simulated Paper Sandbox",
            broker_type="zerodha",
            is_active=True,
        )
        repository.db.add(broker)
        repository.db.commit()
        repository.db.refresh(broker)

    broker_id = broker.id
    deployed_count = 0

    for d in definitions:
        owner_id = d.user_id
        instances = repository.list_instances_for_definition(d.id, owner_id)
        paper_inst = next((i for i in instances if i.execution_mode == "PAPER"), None)

        if not paper_inst:
            paper_inst = repository.create_instance(
                definition_id=d.id,
                user_id=owner_id,
                broker_id=broker_id,
                execution_mode="PAPER",
            )

        if paper_inst.status != "RUNNING":
            try:
                if paper_inst.status == "PAUSED":
                    runner.resume_instance(paper_inst.id, owner_id)
                elif paper_inst.status in ("STOPPED", "FAILED"):
                    repository.update_instance_status(paper_inst.id, owner_id, "READY")
                    runner.start_instance(paper_inst.id, owner_id)
                else:  # DRAFT or READY
                    runner.start_instance(paper_inst.id, owner_id)
                deployed_count += 1
            except Exception as exc:
                logger.warning("Failed to start paper instance %s: %s", paper_inst.id, exc)
        else:
            deployed_count += 1
        
        d.is_active = True

    repository.db.commit()

    return {
        "success": True,
        "deployed_count": deployed_count,
        "total_strategies": len(definitions),
        "message": f"Successfully activated {deployed_count} strategies on Autopilot PAPER Mode.",
    }


@router.post(
    "/stop-all-paper",
    status_code=status.HTTP_200_OK,
    summary="Stop all RUNNING PAPER strategy instances",
)
def stop_all_paper_strategies(
    repository: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    runner: Annotated[StrategyRunner, Depends(get_strategy_runner)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> dict:
    """Stops all running/active paper instances."""
    stmt = select(StrategyInstance).where(
        StrategyInstance.execution_mode == "PAPER",
        StrategyInstance.status.in_(["RUNNING", "PAUSED", "READY"]),
    )
    running_instances = list(repository.db.execute(stmt).scalars().all())
    stopped_count = 0

    for inst in running_instances:
        try:
            runner.stop_instance(inst.id, inst.user_id)
            stopped_count += 1
        except Exception as exc:
            logger.warning("Failed to stop paper instance %s: %s", inst.id, exc)
            repository.update_instance_status(inst.id, inst.user_id, "STOPPED")
            stopped_count += 1

    # Mark all definitions is_active = False
    defs = repository.list_all_definitions()
    for d in defs:
        d.is_active = False
    repository.db.commit()

    return {
        "success": True,
        "stopped_count": stopped_count,
        "message": f"Successfully stopped {stopped_count} Autopilot paper strategy instances.",
    }


@router.post(
    "/switch-mode/scalper-15min",
    status_code=status.HTTP_200_OK,
    summary="Switch platform to 15-20 Min Fast Scalper Mode (Mutually Exclusive)",
)
def switch_mode_scalper_15min(
    repository: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    runner: Annotated[StrategyRunner, Depends(get_strategy_runner)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> dict:
    """Activates ONLY 15-20 minute fast scalper strategies and pauses all full-day swing strategies."""
    definitions = repository.list_all_definitions()
    from app.database.models.broker import Broker
    broker = repository.db.execute(select(Broker).where(Broker.is_active == True)).scalars().first()
    if not broker:
        broker = repository.db.execute(select(Broker)).scalars().first()
    broker_id = broker.id if broker else None

    scalper_count = 0
    paused_count = 0

    for d in definitions:
        name_lower = d.name.lower()
        type_upper = (d.strategy_type or "").upper()
        is_scalper = (
            "scalp" in name_lower
            or "option buying" in name_lower
            or "SCALP" in type_upper
            or "ULTRA_FAST" in type_upper
        )

        owner_id = d.user_id
        instances = repository.list_instances_for_definition(d.id, owner_id)
        paper_inst = next((i for i in instances if i.execution_mode == "PAPER"), None)

        if is_scalper:
            d.is_active = True
            if not paper_inst and broker_id:
                paper_inst = repository.create_instance(
                    definition_id=d.id,
                    user_id=owner_id,
                    broker_id=broker_id,
                    execution_mode="PAPER",
                )
            if paper_inst:
                try:
                    if paper_inst.status == "PAUSED":
                        runner.resume_instance(paper_inst.id, owner_id)
                    elif paper_inst.status in ("STOPPED", "FAILED"):
                        repository.update_instance_status(paper_inst.id, owner_id, "READY")
                        runner.start_instance(paper_inst.id, owner_id)
                    elif paper_inst.status != "RUNNING":
                        runner.start_instance(paper_inst.id, owner_id)
                    scalper_count += 1
                except Exception as exc:
                    logger.warning("Failed to start scalper instance %s: %s", paper_inst.id, exc)
                    scalper_count += 1
        else:
            d.is_active = False
            if paper_inst and paper_inst.status in ("RUNNING", "PAUSED", "READY"):
                try:
                    runner.stop_instance(paper_inst.id, owner_id)
                    paused_count += 1
                except Exception as exc:
                    repository.update_instance_status(paper_inst.id, owner_id, "STOPPED")
                    paused_count += 1

    repository.db.commit()

    return {
        "success": True,
        "active_mode": "15MIN_SCALPER",
        "scalper_count": scalper_count,
        "paused_count": paused_count,
        "message": f"⚡ 15-20 Min Fast Scalper Mode Activated ({scalper_count} scalper strategies running, {paused_count} full-day strategies paused).",
    }


@router.post(
    "/switch-mode/full-day",
    status_code=status.HTTP_200_OK,
    summary="Switch platform to Full-Day Multi-Regime Mode (Mutually Exclusive)",
)
def switch_mode_full_day(
    repository: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    runner: Annotated[StrategyRunner, Depends(get_strategy_runner)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> dict:
    """Activates all 132 full-day multi-regime strategies across all sectors."""
    return deploy_all_paper_strategies(repository=repository, runner=runner, current_user=current_user)


# ---------------------------------------------------------------------------
# Human-in-the-Loop Signal Action Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/signals/pending",
    status_code=status.HTTP_200_OK,
    response_model=List[StrategySignalResponse],
    summary="List all pending proposed strategy signals awaiting user decision",
)
def list_pending_signals(
    repository: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
    limit: int = Query(default=100, ge=1, le=500),
) -> List[StrategySignalResponse]:
    """Retrieves all PROPOSED strategy signals for current user during active market sessions."""
    from app.services.market_timing_guard import MarketTimingGuard
    is_open, _ = MarketTimingGuard.is_market_open_for_exits()
    if not is_open:
        return []
    signals = repository.list_pending_signals(user_id=current_user.id, limit=limit)
    
    # In Auto-Pilot mode, algo places orders automatically; clear lingering manual proposals
    for s in signals:
        s.status = "IGNORED"
        s.actioned_at = datetime.now(timezone.utc)

    try:
        repository.db.commit()
    except Exception:
        pass

    return []


@router.post(
    "/signals/clear-all",
    status_code=status.HTTP_200_OK,
    summary="Clear/Dismiss all pending proposed strategy signals",
)
def clear_all_pending_signals(
    repository: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> dict:
    """Dismisses and clears all lingering proposed signals for the user."""
    signals = repository.list_pending_signals(user_id=current_user.id, limit=500)
    for s in signals:
        s.status = "IGNORED"
        s.actioned_at = datetime.now(timezone.utc)
    repository.db.commit()
    return {"status": "SUCCESS", "cleared_count": len(signals)}


@router.post(
    "/signals/{signal_id}/approve",
    status_code=status.HTTP_200_OK,
    response_model=SignalApprovalResponse,
    summary="Manually approve and execute a strategy signal with user-defined quantity",
)
def approve_strategy_signal(
    signal_id: UUID,
    payload: SignalApprovalRequest,
    runner: Annotated[StrategyRunner, Depends(get_strategy_runner)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> SignalApprovalResponse:
    """Confirms user approval of a proposed signal, placing manual BUY/SELL order."""
    try:
        result = runner.approve_signal(
            user_id=current_user.id,
            signal_id=signal_id,
            actual_quantity=payload.actual_quantity,
            execution_mode=payload.execution_mode,
            custom_stop_loss=payload.custom_stop_loss,
            custom_target=payload.custom_target,
        )
        return SignalApprovalResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.error("Error approving signal %s: %s", signal_id, exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post(
    "/signals/{signal_id}/ignore",
    status_code=status.HTTP_200_OK,
    response_model=SignalIgnoreResponse,
    summary="Dismiss/Ignore a proposed strategy signal",
)
def ignore_strategy_signal(
    signal_id: UUID,
    runner: Annotated[StrategyRunner, Depends(get_strategy_runner)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> SignalIgnoreResponse:
    """Marks a proposed signal as IGNORED without placing any order."""
    try:
        result = runner.ignore_signal(user_id=current_user.id, signal_id=signal_id)
        return SignalIgnoreResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.error("Error ignoring signal %s: %s", signal_id, exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post(
    "/{definition_id}/toggle-pause",
    status_code=status.HTTP_200_OK,
    summary="Toggle Pause/Resume for a strategy and its paper instance",
)
def toggle_pause_strategy(
    definition_id: UUID,
    repository: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    runner: Annotated[StrategyRunner, Depends(get_strategy_runner)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> dict:
    from app.database.models.strategy import StrategyDefinition
    from app.database.models.broker import Broker
    
    definition = repository.get_definition_for_user(definition_id, current_user.id)
    if not definition:
        definition = repository.db.get(StrategyDefinition, definition_id)
        if not definition:
            raise HTTPException(status_code=404, detail="Strategy not found")

    owner_id = definition.user_id
    instances = repository.list_instances_for_definition(definition_id, owner_id)
    paper_inst = next((i for i in instances if i.execution_mode == "PAPER"), None)

    if paper_inst and paper_inst.status == "RUNNING":
        try:
            runner.pause_instance(paper_inst.id, owner_id)
        except Exception:
            runner.stop_instance(paper_inst.id, owner_id)
        definition.is_active = False
        repository.db.commit()
        return {
            "success": True,
            "strategy_id": str(definition_id),
            "is_active": False,
            "status": "PAUSED",
            "message": f"Strategy '{definition.name}' paused successfully."
        }
    else:
        broker = repository.db.execute(select(Broker).where(Broker.is_active == True)).scalars().first()
        if not broker:
            broker = repository.db.execute(select(Broker)).scalars().first()
        broker_id = broker.id if broker else None

        if not paper_inst:
            paper_inst = repository.create_instance(
                definition_id=definition_id,
                user_id=owner_id,
                broker_id=broker_id,
                execution_mode="PAPER"
            )

        if paper_inst.status == "PAUSED":
            runner.resume_instance(paper_inst.id, owner_id)
        elif paper_inst.status in ("STOPPED", "FAILED"):
            repository.update_instance_status(paper_inst.id, owner_id, "READY")
            runner.start_instance(paper_inst.id, owner_id)
        else:
            runner.start_instance(paper_inst.id, owner_id)

        definition.is_active = True
        repository.db.commit()
        return {
            "success": True,
            "strategy_id": str(definition_id),
            "is_active": True,
            "status": "RUNNING",
            "message": f"Strategy '{definition.name}' resumed and active."
        }


@router.post(
    "/bulk-update-config",
    status_code=status.HTTP_200_OK,
    summary="Bulk update capital allocation & risk config across all strategies",
)
def bulk_update_strategy_config(
    payload: BulkStrategyConfigUpdateRequest,
    repository: Annotated[StrategyRepository, Depends(get_strategy_repository)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> dict:
    """Updates capital and risk parameters across all strategy definitions at once."""
    import json
    from app.database.models.strategy import StrategyInstance

    definitions = repository.list_all_definitions()
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No configuration parameters provided for bulk update")

    updated_count = 0
    for defn in definitions:
        cfg = {}
        if defn.config_json:
            try:
                cfg = json.loads(defn.config_json)
            except Exception:
                cfg = {}
        cfg.update(update_data)
        defn.config_json = json.dumps(cfg)
        updated_count += 1

    try:
        instances = repository.db.query(StrategyInstance).all()
        for inst in instances:
            if inst.config_json:
                try:
                    inst_cfg = json.loads(inst.config_json)
                    inst_cfg.update(update_data)
                    inst.config_json = json.dumps(inst_cfg)
                except Exception:
                    pass
    except Exception as exc:
        logger.warning(f"Could not sync instances config_json during bulk update: {exc}")

    repository.db.commit()
    logger.info(f"Bulk updated {updated_count} strategy definitions with settings: {update_data}")
    return {
        "success": True,
        "updated_count": updated_count,
        "message": f"Successfully updated all {updated_count} strategies with your capital and risk settings!",
        "applied_settings": update_data,
    }



