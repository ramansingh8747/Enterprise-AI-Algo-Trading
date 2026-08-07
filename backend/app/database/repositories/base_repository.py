from typing import Any, Generic, Type, TypeVar, Optional, Sequence
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from app.database.base import Base
from app.core.logging.logger import logger
from app.exceptions.base_exception import BaseAppException

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType], db: Session) -> None:
        self.model = model
        self.db = db

    def get_by_id(self, id: Any) -> Optional[ModelType]:
        return self.db.get(self.model, id)

    def get_all(self, skip: int = 0, limit: int = 100) -> Sequence[ModelType]:
        return self.db.scalars(
            select(self.model).offset(skip).limit(limit)
        ).all()

    def create(self, obj_in: dict[str, Any]) -> ModelType:
        try:
            db_obj = self.model(**obj_in)
            self.db.add(db_obj)
            self.db.commit()
            self.db.refresh(db_obj)
            return db_obj
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.exception(f"Error creating {self.model.__name__}")
            raise BaseAppException(message=f"Could not create {self.model.__name__}", status_code=500, details=str(e))

    def update(self, db_obj: ModelType, obj_in: dict[str, Any]) -> ModelType:
        try:
            for field, value in obj_in.items():
                setattr(db_obj, field, value)
            self.db.add(db_obj)
            self.db.commit()
            self.db.refresh(db_obj)
            return db_obj
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.exception(f"Error updating {self.model.__name__}")
            raise BaseAppException(message=f"Could not update {self.model.__name__}", status_code=500, details=str(e))

    def delete(self, id: Any) -> None:
        try:
            obj = self.db.get(self.model, id)
            if obj:
                self.db.delete(obj)
                self.db.commit()
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.exception(f"Error deleting {self.model.__name__}")
            raise BaseAppException(message=f"Could not delete {self.model.__name__}", status_code=500, details=str(e))
