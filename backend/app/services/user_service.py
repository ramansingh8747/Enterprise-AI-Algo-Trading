from app.repositories.user_repository import UserRepository
from app.core.security.password_service import PasswordService
from app.database.models.user import User
from app.schemas.user import UserUpdate, ChangePasswordRequest
from app.exceptions.auth_exceptions import InvalidCredentialsException


class UserService:
    """
    Business logic for users.
    """

    def __init__(
        self,
        repository: UserRepository,
        password_service: PasswordService,
    ):
        self.repository = repository
        self.password_service = password_service

    def get_user_profile(self, user: User) -> User:
        return user

    def update_user_profile(self, user: User, data: UserUpdate) -> User:
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(user, key, value)
        self.repository.db.commit()
        self.repository.db.refresh(user)
        return user

    def change_password(self, user: User, data: ChangePasswordRequest) -> None:
        if not self.password_service.verify_password(data.old_password, user.password_hash):
            raise InvalidCredentialsException()
        
        user.password_hash = self.password_service.hash_password(data.new_password)
        self.repository.db.commit()
