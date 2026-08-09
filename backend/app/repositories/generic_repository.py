from typing import Any
from sqlalchemy.orm import DeclarativeBase

from app.repositories.base_repository import BaseRepository


class GenericRepository(BaseRepository):
    """
    Base generic repository for all repositories.
    """

    def get_by_id(
        self,
        model: type[DeclarativeBase],
        object_id: Any,
    ):
        return (
            self.db.query(model)
            .filter(model.id == object_id)
            .first()
        )

    def get_all(
        self,
        model: type[DeclarativeBase],
    ):
        return self.db.query(model).all()

    def create(
        self,
        entity: DeclarativeBase,
    ):
        self.db.add(entity)
        self.db.commit()
        self.db.refresh(entity)
        return entity

    def update(
        self,
        entity: DeclarativeBase,
    ):
        self.db.commit()
        self.db.refresh(entity)
        return entity

    def delete(
        self,
        entity: DeclarativeBase,
    ) -> None:
        self.db.delete(entity)
        self.db.commit()
