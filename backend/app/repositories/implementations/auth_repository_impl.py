from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.repositories.generic_repository import GenericRepository
from app.repositories.interfaces.auth_repository import AuthRepository
from app.database.models.user import User
from app.database.models.refresh_token import RefreshToken
from app.core.config import settings


class AuthRepositoryImpl(GenericRepository, AuthRepository):
    """Implementation of AuthRepository."""

    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get_user_by_email(self, email: str) -> Optional[User]:
        """Retrieve a user by their email address."""
        return self.db.query(User).filter(User.email == email).first()

    def update_last_login(self, user_id: UUID) -> None:
        """Update the last login timestamp for a given user."""
        user = self.get_by_id(User, user_id)
        if user:
            user.last_login = datetime.now(timezone.utc)
            self.db.commit()
            self.db.refresh(user)

    def store_refresh_token(self, user_id: UUID, refresh_token: str) -> None:
        """Store a refresh token for a given user."""
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS
        )
        token_entry = RefreshToken(
            user_id=user_id, token=refresh_token, expires_at=expires_at
        )
        self.db.add(token_entry)
        self.db.commit()

    def revoke_refresh_token(self, refresh_token: str) -> None:
        """Revoke a refresh token."""
        token_entry = (
            self.db.query(RefreshToken)
            .filter(RefreshToken.token == refresh_token)
            .first()
        )
        if token_entry:
            token_entry.is_revoked = True
            token_entry.revoked_at = datetime.now(timezone.utc)
            self.db.commit()
