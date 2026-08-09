from typing import Annotated
from fastapi import APIRouter, Depends, status
from app.api.dependencies.auth import get_current_active_user
from app.database.models.user import User
from app.schemas.user import UserUpdate, ChangePasswordRequest
from app.schemas.auth import UserResponse
from app.services.user_service import UserService
from app.repositories.user_repository import UserRepository
from app.services.implementations.password_service_impl import PasswordServiceImpl
from app.dependencies.database import get_db
from sqlalchemy.orm import Session

router = APIRouter(prefix="/users", tags=["Users"])

def get_user_service(db: Session = Depends(get_db)) -> UserService:
    return UserService(UserRepository(db), PasswordServiceImpl())

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_active_user)):
    return UserResponse.model_validate(current_user)

@router.put("/me", response_model=UserResponse)
def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    service: UserService = Depends(get_user_service)
):
    updated_user = service.update_user_profile(current_user, data)
    return UserResponse.model_validate(updated_user)

@router.put("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    service: UserService = Depends(get_user_service)
):
    service.change_password(current_user, data)
    return None
