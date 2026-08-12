from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app.dependencies.database import get_db
from app.dependencies.auth import get_current_active_user
from app.schemas.auth import UserResponse
from app.schemas.trading_journal import TradingJournalEntryCreate, TradingJournalEntryUpdate, TradingJournalEntryResponse
from app.database.repositories.trading_journal_repository import TradingJournalRepository

from typing import List, Optional
from app.database.models.strategy import StrategyInstance, StrategySignal

router = APIRouter(prefix="/trading-journal", tags=["trading-journal"])

@router.post("", response_model=TradingJournalEntryResponse)
def create_entry(
    entry: TradingJournalEntryCreate,
    current_user: UserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    repo = TradingJournalRepository(db)

    # 1. Ownership validation for strategy instance / signal references
    if entry.strategy_instance_id:
        inst = db.query(StrategyInstance).filter(
            StrategyInstance.id == entry.strategy_instance_id,
            StrategyInstance.user_id == current_user.id
        ).first()
        if not inst:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Referenced strategy instance not found or access denied")

    if entry.strategy_signal_id:
        sig = db.query(StrategySignal).filter(
            StrategySignal.id == entry.strategy_signal_id,
            StrategySignal.user_id == current_user.id
        ).first()
        if not sig:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Referenced strategy signal not found or access denied")

    # 2. Duplicate prevention for linked journal entries
    duplicate = repo.find_duplicate(
        user_id=current_user.id,
        paper_trade_id=entry.paper_trade_id,
        broker_order_id=entry.broker_order_id,
        strategy_signal_id=entry.strategy_signal_id
    )
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Journal entry for this trade/order/signal context already exists"
        )

    return repo.create(current_user.id, entry)

@router.get("", response_model=List[TradingJournalEntryResponse])
def list_entries(
    paper_trade_id: Optional[str] = None,
    broker_order_id: Optional[str] = None,
    strategy_instance_id: Optional[UUID] = None,
    strategy_signal_id: Optional[UUID] = None,
    symbol: Optional[str] = None,
    side: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    repo = TradingJournalRepository(db)
    return repo.list(
        user_id=current_user.id,
        paper_trade_id=paper_trade_id,
        broker_order_id=broker_order_id,
        strategy_instance_id=strategy_instance_id,
        strategy_signal_id=strategy_signal_id,
        symbol=symbol,
        side=side
    )


@router.get("/{entry_id}", response_model=TradingJournalEntryResponse)
def get_entry(
    entry_id: UUID,
    current_user: UserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    repo = TradingJournalRepository(db)
    entry = repo.get(current_user.id, entry_id)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found")
    return entry

@router.patch("/{entry_id}", response_model=TradingJournalEntryResponse)
def update_entry(
    entry_id: UUID,
    entry_update: TradingJournalEntryUpdate,
    current_user: UserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    repo = TradingJournalRepository(db)
    entry = repo.update(current_user.id, entry_id, entry_update)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found")
    return entry

@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(
    entry_id: UUID,
    current_user: UserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    repo = TradingJournalRepository(db)
    if not repo.delete(current_user.id, entry_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found")
    return None
