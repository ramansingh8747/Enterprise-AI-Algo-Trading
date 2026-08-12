from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from app.database.models.trading_journal import TradingJournalEntry
from app.schemas.trading_journal import TradingJournalEntryCreate, TradingJournalEntryUpdate

class TradingJournalRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, user_id: UUID, entry: TradingJournalEntryCreate) -> TradingJournalEntry:
        db_entry = TradingJournalEntry(user_id=user_id, **entry.model_dump())
        self.db.add(db_entry)
        self.db.commit()
        self.db.refresh(db_entry)
        return db_entry

    def find_duplicate(
        self,
        user_id: UUID,
        paper_trade_id: Optional[str] = None,
        broker_order_id: Optional[str] = None,
        strategy_signal_id: Optional[UUID] = None
    ) -> Optional[TradingJournalEntry]:
        if not (paper_trade_id or broker_order_id or strategy_signal_id):
            return None
        from sqlalchemy import or_
        conditions = []
        if paper_trade_id:
            conditions.append(TradingJournalEntry.paper_trade_id == paper_trade_id)
        if broker_order_id:
            conditions.append(TradingJournalEntry.broker_order_id == broker_order_id)
        if strategy_signal_id:
            conditions.append(TradingJournalEntry.strategy_signal_id == strategy_signal_id)
        return self.db.query(TradingJournalEntry).filter(
            TradingJournalEntry.user_id == user_id,
            or_(*conditions)
        ).first()

    def list(
        self,
        user_id: UUID,
        paper_trade_id: Optional[str] = None,
        broker_order_id: Optional[str] = None,
        strategy_instance_id: Optional[UUID] = None,
        strategy_signal_id: Optional[UUID] = None,
        symbol: Optional[str] = None,
        side: Optional[str] = None
    ) -> List[TradingJournalEntry]:
        query = self.db.query(TradingJournalEntry).filter(TradingJournalEntry.user_id == user_id)
        if paper_trade_id:
            query = query.filter(TradingJournalEntry.paper_trade_id == paper_trade_id)
        if broker_order_id:
            query = query.filter(TradingJournalEntry.broker_order_id == broker_order_id)
        if strategy_instance_id:
            query = query.filter(TradingJournalEntry.strategy_instance_id == strategy_instance_id)
        if strategy_signal_id:
            query = query.filter(TradingJournalEntry.strategy_signal_id == strategy_signal_id)
        if symbol:
            query = query.filter(TradingJournalEntry.symbol == symbol)
        if side:
            query = query.filter(TradingJournalEntry.side == side)
        return query.all()


    def get(self, user_id: UUID, entry_id: UUID) -> Optional[TradingJournalEntry]:
        return self.db.query(TradingJournalEntry).filter(
            TradingJournalEntry.user_id == user_id,
            TradingJournalEntry.id == entry_id
        ).first()

    def update(self, user_id: UUID, entry_id: UUID, entry_update: TradingJournalEntryUpdate) -> Optional[TradingJournalEntry]:
        db_entry = self.get(user_id, entry_id)
        if db_entry:
            for key, value in entry_update.model_dump(exclude_unset=True).items():
                setattr(db_entry, key, value)
            self.db.commit()
            self.db.refresh(db_entry)
        return db_entry

    def delete(self, user_id: UUID, entry_id: UUID) -> bool:
        db_entry = self.get(user_id, entry_id)
        if db_entry:
            self.db.delete(db_entry)
            self.db.commit()
            return True
        return False
