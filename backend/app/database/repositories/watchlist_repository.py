from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
import uuid
from app.database.models.watchlist import Watchlist, WatchlistItem

DEFAULT_WATCHLIST_SYMBOLS = [
    'RELIANCE',
    'TCS',
    'INFY',
    'HDFCBANK',
    'ICICIBANK',
    'SBIN',
    'ITC',
    'LT',
]

class WatchlistRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_or_create_default_watchlist(self, user_id: uuid.UUID) -> Watchlist:
        """Fetch user's default watchlist, or create a default one populated with initial symbols if none exists."""
        default_wl = (
            self.db.query(Watchlist)
            .filter(Watchlist.user_id == user_id, Watchlist.is_default == True)
            .first()
        )
        if default_wl:
            return default_wl

        # Check if user has any watchlist at all
        any_wl = self.db.query(Watchlist).filter(Watchlist.user_id == user_id).first()
        if any_wl:
            any_wl.is_default = True
            self.db.commit()
            self.db.refresh(any_wl)
            return any_wl

        # Create new default watchlist
        new_wl = Watchlist(
            id=uuid.uuid4(),
            user_id=user_id,
            name="Main Watchlist",
            is_default=True,
        )
        self.db.add(new_wl)
        self.db.flush()

        for idx, sym in enumerate(DEFAULT_WATCHLIST_SYMBOLS):
            item = WatchlistItem(
                id=uuid.uuid4(),
                watchlist_id=new_wl.id,
                symbol=sym,
                order_index=idx,
            )
            self.db.add(item)

        self.db.commit()
        self.db.refresh(new_wl)
        return new_wl

    def list_user_watchlists(self, user_id: uuid.UUID) -> List[Watchlist]:
        """List all watchlists owned by user. Ensures a default watchlist exists."""
        self.get_or_create_default_watchlist(user_id)
        return (
            self.db.query(Watchlist)
            .filter(Watchlist.user_id == user_id)
            .order_by(Watchlist.is_default.desc(), Watchlist.created_at.asc())
            .all()
        )

    def get_watchlist(self, watchlist_id: uuid.UUID, user_id: uuid.UUID) -> Optional[Watchlist]:
        """Fetch watchlist ensuring user ownership."""
        return (
            self.db.query(Watchlist)
            .filter(Watchlist.id == watchlist_id, Watchlist.user_id == user_id)
            .first()
        )

    def create_watchlist(self, user_id: uuid.UUID, name: str, is_default: bool = False) -> Watchlist:
        """Create custom watchlist for user."""
        if is_default:
            # Unset existing default watchlists for this user
            self.db.query(Watchlist).filter(Watchlist.user_id == user_id).update({"is_default": False})

        new_wl = Watchlist(
            id=uuid.uuid4(),
            user_id=user_id,
            name=name.strip(),
            is_default=is_default,
        )
        self.db.add(new_wl)
        self.db.commit()
        self.db.refresh(new_wl)
        return new_wl

    def add_item_to_watchlist(self, watchlist_id: uuid.UUID, user_id: uuid.UUID, symbol: str) -> WatchlistItem:
        """Add symbol item to watchlist after verifying ownership and checking for duplicates."""
        wl = self.get_watchlist(watchlist_id, user_id)
        if not wl:
            raise KeyError("Watchlist not found or unauthorized")

        normalized_symbol = symbol.strip().upper()
        if not normalized_symbol:
            raise ValueError("Symbol cannot be empty")

        # Check duplicate
        existing = (
            self.db.query(WatchlistItem)
            .filter(WatchlistItem.watchlist_id == watchlist_id, WatchlistItem.symbol == normalized_symbol)
            .first()
        )
        if existing:
            raise ValueError(f"Symbol '{normalized_symbol}' already exists in watchlist")

        max_idx = (
            self.db.query(WatchlistItem)
            .filter(WatchlistItem.watchlist_id == watchlist_id)
            .count()
        )

        item = WatchlistItem(
            id=uuid.uuid4(),
            watchlist_id=watchlist_id,
            symbol=normalized_symbol,
            order_index=max_idx,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def remove_item_from_watchlist(self, watchlist_id: uuid.UUID, user_id: uuid.UUID, symbol: str) -> bool:
        """Remove item matching symbol from user's watchlist."""
        wl = self.get_watchlist(watchlist_id, user_id)
        if not wl:
            raise KeyError("Watchlist not found or unauthorized")

        normalized_symbol = symbol.strip().upper()
        item = (
            self.db.query(WatchlistItem)
            .filter(WatchlistItem.watchlist_id == watchlist_id, WatchlistItem.symbol == normalized_symbol)
            .first()
        )
        if not item:
            return False

        self.db.delete(item)
        self.db.commit()
        return True

    def delete_watchlist(self, watchlist_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Delete custom watchlist owned by user."""
        wl = self.get_watchlist(watchlist_id, user_id)
        if not wl:
            raise KeyError("Watchlist not found or unauthorized")

        self.db.delete(wl)
        self.db.commit()

        # If deleted watchlist was default, set another watchlist as default
        remaining = self.db.query(Watchlist).filter(Watchlist.user_id == user_id).first()
        if remaining and not any(w.is_default for w in self.list_user_watchlists(user_id)):
            remaining.is_default = True
            self.db.commit()

        return True
