import json
import logging
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.v1.routes.auth import get_current_active_user
from app.core.config.settings import settings
from app.core.logging.trading_audit import audit_event
from app.database.models.strategy_import import StrategyImport
from app.database.repositories.strategy_repository import StrategyRepository
from app.dependencies.database import get_db
from app.schemas.auth import UserResponse
from app.schemas.strategy_import import (
    StrategyImportConfirmRequest,
    StrategyImportConfirmResponse,
    StrategyImportResponse,
)
from app.services.strategy_import.service import StrategyImportService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/strategies/imports", tags=["Strategy Imports"])
service = StrategyImportService()


def _get_import(db: Session, import_id: UUID, user_id: UUID) -> StrategyImport | None:
    return db.query(StrategyImport).filter(
        StrategyImport.id == import_id,
        StrategyImport.user_id == user_id,
    ).first()


@router.post("", response_model=StrategyImportResponse, status_code=status.HTTP_201_CREATED)
async def upload_strategy_file(
    file: Annotated[UploadFile, File(...)],
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> StrategyImportResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="A strategy file is required.")
    try:
        stored_name, file_type, size, text, config, warnings = await service.save_and_parse_upload(
            file=file,
            filename=file.filename,
        )
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("strategy_file_import_failed")
        raise HTTPException(status_code=422, detail="Unable to parse the uploaded strategy file.") from exc

    record = StrategyImport(
        user_id=current_user.id,
        original_filename=Path(file.filename).name[:255],
        stored_filename=stored_name,
        file_type=file_type,
        file_size=size,
        extracted_text=text,
        extracted_config=config,
        warnings=warnings,
        status="PENDING",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    audit_event(
        "STRATEGY_FILE_IMPORTED",
        user_id=current_user.id,
        outcome="SUCCESS",
        resource_type="strategy_import",
        resource_id=record.id,
        file_type=file_type,
        filename=record.original_filename,
    )
    return StrategyImportResponse.model_validate(record)


@router.get("/{import_id}", response_model=StrategyImportResponse)
def get_strategy_import(
    import_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> StrategyImportResponse:
    record = _get_import(db, import_id, current_user.id)
    if not record:
        raise HTTPException(status_code=404, detail="Strategy import not found.")
    return StrategyImportResponse.model_validate(record)


@router.get("/{import_id}/download")
def download_strategy_import(
    import_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> FileResponse:
    record = _get_import(db, import_id, current_user.id)
    if not record:
        raise HTTPException(status_code=404, detail="Strategy import not found.")
    target = (Path(settings.STRATEGY_UPLOAD_DIR) / record.stored_filename).resolve()
    storage_root = Path(settings.STRATEGY_UPLOAD_DIR).resolve()
    if storage_root not in target.parents or not target.is_file():
        raise HTTPException(status_code=404, detail="Strategy source file is unavailable.")
    return FileResponse(path=target, filename=record.original_filename, media_type="application/octet-stream")


@router.post("/{import_id}/confirm", response_model=StrategyImportConfirmResponse, status_code=status.HTTP_201_CREATED)
def confirm_strategy_import(
    import_id: UUID,
    payload: StrategyImportConfirmRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> StrategyImportConfirmResponse:
    record = _get_import(db, import_id, current_user.id)
    if not record:
        raise HTTPException(status_code=404, detail="Strategy import not found.")
    if record.status == "CONFIRMED" and record.strategy_definition_id:
        return StrategyImportConfirmResponse(
            import_id=record.id,
            strategy_definition_id=record.strategy_definition_id,
            strategy_name=payload.name,
            status=record.status,
        )
    if record.status != "PENDING":
        raise HTTPException(status_code=409, detail=f"Strategy import is {record.status.lower()}.")

    config = dict(record.extracted_config or {})
    config["source"] = {
        "type": "file_import",
        "import_id": str(record.id),
        "filename": record.original_filename,
        "file_type": record.file_type,
    }
    config["extracted_text"] = record.extracted_text or ""
    config["warnings"] = record.warnings or []

    repository = StrategyRepository(db)
    definition = repository.create_definition(
        user_id=current_user.id,
        name=payload.name.strip(),
        strategy_type=payload.strategy_type.strip() or "CUSTOM_IMPORTED",
        config_json=json.dumps(config, ensure_ascii=False, default=str),
    )
    record.status = "CONFIRMED"
    record.strategy_definition_id = definition.id
    db.commit()
    db.refresh(record)
    audit_event(
        "STRATEGY_FILE_IMPORT_CONFIRMED",
        user_id=current_user.id,
        outcome="SUCCESS",
        resource_type="strategy_definition",
        resource_id=definition.id,
        import_id=record.id,
        filename=record.original_filename,
    )
    return StrategyImportConfirmResponse(
        import_id=record.id,
        strategy_definition_id=definition.id,
        strategy_name=definition.name,
        status=record.status,
    )
