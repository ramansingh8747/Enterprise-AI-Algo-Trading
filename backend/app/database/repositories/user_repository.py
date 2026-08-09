import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models.user import User
from app.database.repositories.base_repository import BaseRepository


class UserRepository(BaseRepository[User]):
    """
    Data-access layer for the User domain.

    Extends BaseRepository with user-specific query methods.
    All SQL stays within this class — no raw queries in services or routes.
    """

    def __init__(self, db: Session) -> None:
        super().__init__(User, db)

    def get_by_email(self, email: str) -> Optional[User]:
        """
        Retrieve a user by their email address (case-insensitive index match).

        Args:
            email: The email address to search for.

        Returns:
            The matching User ORM instance, or None if not found.
        """
        return self.db.scalar(
            select(User).where(User.email == email.lower())
        )

    def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        """
        Retrieve a user by their UUID primary key.

        Args:
            user_id: The UUID of the user.

        Returns:
            The matching User ORM instance, or None if not found.
        """
        return self.db.get(User, user_id)

    def exists_by_email(self, email: str) -> bool:
        """
        Check whether a user with the given email already exists.

        Args:
            email: The email address to check.

        Returns:
            True if a user with that email is registered, False otherwise.
        """
        result = self.db.scalar(
            select(User.id).where(User.email == email.lower())
        )
        return result is not None

    def exists_by_username(self, username: str) -> bool:
        """
        Check whether a user with the given username already exists.

        Args:
            username: The username to check.

        Returns:
            True if the username is taken, False otherwise.
        """
        result = self.db.scalar(
            select(User.id).where(User.username == username.lower())
        )
        return result is not None

    def update_last_login(self, user: User) -> User:
        """
        Stamp the user's ``last_login`` field with the current UTC time.

        Args:
            user: The User ORM instance to update.

        Returns:
            The updated User ORM instance.
        """
        return self.update(user, {"last_login": datetime.now(timezone.utc)})
