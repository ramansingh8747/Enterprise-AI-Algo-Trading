from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.database.models.strategy import StrategyDefinition
from app.database.models.strategy_import import StrategyImport
from app.database.models.user import User, UserRole
from app.dependencies.auth import RoleChecker
from app.dependencies.database import get_db
from app.schemas.admin_strategies import AdminStrategyItem, AdminStrategyListResponse
from app.schemas.strategy import StrategyDefinitionUpdateRequest, StrategyDefinitionResponse
from app.core.config.settings import settings
from app.core.logging.trading_audit import audit_event

router = APIRouter(
    prefix="/admin/strategies",
    tags=["Admin Strategies"],
    dependencies=[Depends(RoleChecker([UserRole.ADMIN]))],
)


def _item(row) -> AdminStrategyItem:
    definition, user, imported = row
    return AdminStrategyItem(
        id=definition.id,
        user_id=definition.user_id,
        user_name=user.full_name,
        username=user.username,
        name=definition.name,
        strategy_type=definition.strategy_type,
        config_json=definition.config_json,
        is_active=definition.is_active,
        created_at=definition.created_at,
        updated_at=definition.updated_at,
        imported_file_name=imported.original_filename if imported else None,
        imported_file_type=imported.file_type if imported else None,
        imported_file_id=imported.id if imported else None,
    )


@router.get("", response_model=AdminStrategyListResponse)
def list_admin_strategies(db: Session = Depends(get_db)) -> AdminStrategyListResponse:
    total = db.scalar(select(func.count(StrategyDefinition.id))) or 0
    stmt = (
        select(StrategyDefinition, User, StrategyImport)
        .join(User, User.id == StrategyDefinition.user_id)
        .outerjoin(StrategyImport, StrategyImport.strategy_definition_id == StrategyDefinition.id)
        .order_by(StrategyDefinition.created_at.desc())
    )
    rows = db.execute(stmt).all()
    return AdminStrategyListResponse(items=[_item(row) for row in rows], total=total)


@router.get("/{strategy_id}", response_model=AdminStrategyItem)
def get_admin_strategy(strategy_id: UUID, db: Session = Depends(get_db)) -> AdminStrategyItem:
    stmt = (
        select(StrategyDefinition, User, StrategyImport)
        .join(User, User.id == StrategyDefinition.user_id)
        .outerjoin(StrategyImport, StrategyImport.strategy_definition_id == StrategyDefinition.id)
        .where(StrategyDefinition.id == strategy_id)
    )
    row = db.execute(stmt).first()
    if not row:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return _item(row)


@router.put("/{strategy_id}", response_model=StrategyDefinitionResponse)
def update_admin_strategy(
    strategy_id: UUID,
    payload: StrategyDefinitionUpdateRequest,
    db: Session = Depends(get_db),
) -> StrategyDefinitionResponse:
    definition = db.get(StrategyDefinition, strategy_id)
    if not definition:
        raise HTTPException(status_code=404, detail="Strategy not found")
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(definition, key, value)
    db.commit()
    db.refresh(definition)
    audit_event(
        "ADMIN_STRATEGY_UPDATED",
        outcome="SUCCESS",
        resource_type="strategy_definition",
        resource_id=definition.id,
        fields=list(updates.keys()),
    )
    return StrategyDefinitionResponse.model_validate(definition)


@router.delete("/{strategy_id}", status_code=204)
def delete_admin_strategy(strategy_id: UUID, db: Session = Depends(get_db)) -> None:
    definition = db.get(StrategyDefinition, strategy_id)
    if not definition:
        raise HTTPException(status_code=404, detail="Strategy not found")
    imported = db.execute(
        select(StrategyImport).where(StrategyImport.strategy_definition_id == definition.id)
    ).scalar_one_or_none()
    audit_event(
        "ADMIN_STRATEGY_DELETED",
        outcome="SUCCESS",
        resource_type="strategy_definition",
        resource_id=definition.id,
        strategy_name=definition.name,
    )
    db.delete(definition)
    if imported:
        target = (Path(settings.STRATEGY_UPLOAD_DIR) / imported.stored_filename).resolve()
        storage_root = Path(settings.STRATEGY_UPLOAD_DIR).resolve()
        if storage_root in target.parents:
            target.unlink(missing_ok=True)
        db.delete(imported)
    db.commit()


@router.get("/{strategy_id}/download")
def download_admin_strategy_file(strategy_id: UUID, db: Session = Depends(get_db)) -> FileResponse:
    imported = db.execute(
        select(StrategyImport).where(StrategyImport.strategy_definition_id == strategy_id)
    ).scalar_one_or_none()
    if not imported:
        raise HTTPException(status_code=404, detail="No imported source file is attached to this strategy")

    target = (Path(settings.STRATEGY_UPLOAD_DIR) / imported.stored_filename).resolve()
    storage_root = Path(settings.STRATEGY_UPLOAD_DIR).resolve()
    if storage_root not in target.parents or not target.is_file():
        raise HTTPException(status_code=404, detail="Strategy source file is unavailable")

    return FileResponse(path=target, filename=imported.original_filename, media_type="application/octet-stream")
