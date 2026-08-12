from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.database.repositories.base_repository import BaseRepository
from app.database.models.paper_portfolio import PaperPortfolio, PaperPosition


class PaperPortfolioRepository(BaseRepository[PaperPortfolio]):
    """Repository managing persistence, queries, and row locking for Paper portfolios and positions."""

    def __init__(self, db: Session) -> None:
        super().__init__(model=PaperPortfolio, db=db)

    def get_portfolio_by_id(self, portfolio_id: UUID, user_id: UUID) -> Optional[PaperPortfolio]:
        """Retrieves a PaperPortfolio enforcing user ownership."""
        stmt = select(PaperPortfolio).where(
            PaperPortfolio.id == portfolio_id,
            PaperPortfolio.user_id == user_id,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def lock_portfolio_for_update(self, portfolio_id: UUID) -> Optional[PaperPortfolio]:
        """Retrieves a PaperPortfolio with FOR UPDATE row-level database locking."""
        stmt = select(PaperPortfolio).where(PaperPortfolio.id == portfolio_id).with_for_update()
        return self.db.execute(stmt).scalar_one_or_none()

    def get_all_portfolios_for_user(self, user_id: UUID) -> List[PaperPortfolio]:
        """Retrieves all PaperPortfolios owned by user with stable ordering."""
        stmt = (
            select(PaperPortfolio)
            .where(PaperPortfolio.user_id == user_id)
            .order_by(PaperPortfolio.created_at.asc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def get_portfolio_for_strategy(
        self, user_id: UUID, strategy_instance_id: UUID
    ) -> Optional[PaperPortfolio]:
        """Retrieves a PaperPortfolio associated with a specific strategy instance."""
        stmt = select(PaperPortfolio).where(
            PaperPortfolio.user_id == user_id,
            PaperPortfolio.strategy_instance_id == strategy_instance_id,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_or_create_default_portfolio(
        self, user_id: UUID, strategy_instance_id: Optional[UUID] = None
    ) -> PaperPortfolio:
        """
        Atomically gets or creates a dedicated PaperPortfolio for user/strategy.
        """
        if strategy_instance_id:
            existing = self.get_portfolio_for_strategy(user_id, strategy_instance_id)
            if existing:
                return existing

        stmt = select(PaperPortfolio).where(
            PaperPortfolio.user_id == user_id,
            PaperPortfolio.strategy_instance_id == strategy_instance_id,
        )
        existing = self.db.execute(stmt).scalar_one_or_none()
        if existing:
            return existing

        portfolio = PaperPortfolio(
            user_id=user_id,
            strategy_instance_id=strategy_instance_id,
            name="Strategy Paper Account" if strategy_instance_id else "Default Paper Portfolio",
            execution_mode="PAPER",
        )

        try:
            self.db.add(portfolio)
            self.db.commit()
            self.db.refresh(portfolio)
            return portfolio
        except IntegrityError:
            self.db.rollback()
            return self.db.execute(stmt).scalar_one()

    def get_position(self, paper_portfolio_id: UUID, symbol: str) -> Optional[PaperPosition]:
        """Retrieves a PaperPosition by portfolio ID and symbol."""
        stmt = select(PaperPosition).where(
            PaperPosition.paper_portfolio_id == paper_portfolio_id,
            PaperPosition.symbol == symbol.upper(),
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def lock_position_for_update(
        self, paper_portfolio_id: UUID, symbol: str
    ) -> Optional[PaperPosition]:
        """
        Retrieves a PaperPosition with FOR UPDATE row-level database locking.
        Ensures thread-safe and process-safe atomic position updates.
        """
        stmt = (
            select(PaperPosition)
            .where(
                PaperPosition.paper_portfolio_id == paper_portfolio_id,
                PaperPosition.symbol == symbol.upper(),
            )
            .with_for_update()
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_all_positions_for_portfolio(
        self, paper_portfolio_id: UUID, user_id: UUID
    ) -> List[PaperPosition]:
        """Retrieves all symbol positions for a paper portfolio enforcing user ownership."""
        stmt = select(PaperPosition).where(
            PaperPosition.paper_portfolio_id == paper_portfolio_id,
            PaperPosition.user_id == user_id,
        )
        return list(self.db.execute(stmt).scalars().all())

    def save_position(self, position: PaperPosition) -> PaperPosition:
        """Adds or updates a PaperPosition within current transaction session."""
        self.db.add(position)
        self.db.flush()
        return position
