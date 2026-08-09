from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.dependencies.database import get_db
from app.repositories.user_repository import UserRepository
from app.core.security import decode_token
from app.exceptions.auth_exceptions import UnauthorizedException, ForbiddenException
from app.database.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency that decodes the JWT and returns the authenticated user.
    """
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise UnauthorizedException()
    
    user_id = payload["sub"]
    repo = UserRepository(db)
    user = repo.get_by_id(user_id)
    if not user:
        raise UnauthorizedException()
    return user

def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Dependency that ensures the authenticated user is active.
    """
    if not current_user.is_active:
        raise ForbiddenException(message="User is inactive")
    return current_user
