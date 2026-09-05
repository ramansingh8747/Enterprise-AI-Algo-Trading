from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import select, delete
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
        return self.db.scalars(stmt.order_by(PaperPortfolio.created_at.asc())).first()

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

        stmt = (
            select(PaperPortfolio)
            .where(
                PaperPortfolio.user_id == user_id,
                PaperPortfolio.strategy_instance_id == strategy_instance_id,
            )
            .order_by(PaperPortfolio.created_at.asc())
        )
        existing = self.db.scalars(stmt).first()
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

    def get_all_positions_for_user(self, user_id: UUID) -> List[PaperPosition]:
        """Retrieves all symbol positions for user across paper portfolios."""
        stmt = select(PaperPosition).where(PaperPosition.user_id == user_id)
        return list(self.db.execute(stmt).scalars().all())

    def save_position(self, position: PaperPosition) -> PaperPosition:
        """Adds or updates a PaperPosition within current transaction session."""
        self.db.add(position)
        self.db.flush()
        return position

    def list_all_open_positions_with_stop_loss(self) -> List[PaperPosition]:
        """Retrieves all open PAPER positions across all users that have a configured stop loss."""
        stmt = select(PaperPosition).where(
            PaperPosition.quantity > 0,
            PaperPosition.stop_loss.isnot(None),
            PaperPosition.status == "OPEN",
        )
        return list(self.db.execute(stmt).scalars().all())

    def reset_portfolio(self, portfolio_id: UUID, user_id: UUID) -> Optional[PaperPortfolio]:
        """Reset PAPER portfolios, positions, and executions atomically across panels."""
        from app.database.models.trading_execution import TradingExecution
        portfolio = self.get_portfolio_by_id(portfolio_id=portfolio_id, user_id=user_id)
        if not portfolio or str(portfolio.execution_mode).upper() != "PAPER":
            return None

        # Clean all paper positions and executions across shared paper sandbox
        self.db.execute(delete(PaperPosition))
        self.db.execute(
            delete(TradingExecution).where(
                TradingExecution.execution_mode == "PAPER",
            )
        )
        for p in self.db.query(PaperPortfolio).filter(PaperPortfolio.execution_mode == "PAPER").all():
            p.cash_balance = p.initial_balance if p.initial_balance and p.initial_balance > 0 else 10000
            p.realized_pnl = 0
            p.unrealized_pnl = 0
            p.total_pnl = 0
            self.db.add(p)

        self.db.commit()
        self.db.refresh(portfolio)
        return portfolio

    def reset_all_paper_for_user(self, user_id: UUID) -> Optional[PaperPortfolio]:
        """Reset all PAPER portfolios, positions, and executions atomically across panels."""
        from app.database.models.trading_execution import TradingExecution
        portfolios = self.get_all_portfolios_for_user(user_id)
        paper_portfolios = [p for p in portfolios if str(p.execution_mode).upper() == "PAPER"]
        if not paper_portfolios:
            default_port = self.get_or_create_default_portfolio(user_id)
            paper_portfolios = [default_port]

        # Clean all paper positions and executions across shared paper sandbox
        self.db.execute(delete(PaperPosition))
        self.db.execute(
            delete(TradingExecution).where(
                TradingExecution.execution_mode == "PAPER",
            )
        )
        for p in self.db.query(PaperPortfolio).filter(PaperPortfolio.execution_mode == "PAPER").all():
            p.cash_balance = p.initial_balance if p.initial_balance and p.initial_balance > 0 else 10000
            p.realized_pnl = 0
            p.unrealized_pnl = 0
            p.total_pnl = 0
            self.db.add(p)

        self.db.commit()
        primary = paper_portfolios[0]
        self.db.refresh(primary)
        return primary

