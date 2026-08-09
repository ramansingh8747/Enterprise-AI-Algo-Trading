from app.repositories.generic_repository import GenericRepository
from app.database.models.user import User


class UserRepository(GenericRepository):
    """
    Repository for user database operations.
    """

    def get_by_id(
        self,
        user_id: int,
    ):
        return super().get_by_id(
            User,
            user_id,
        )

    def get_by_email(
        self,
        email: str,
    ):
        return (
            self.db.query(User)
            .filter(User.email == email)
            .first()
        )

    def get_by_mobile(
        self,
        mobile: str,
    ):
        return (
            self.db.query(User)
            .filter(User.mobile == mobile)
            .first()
        )
