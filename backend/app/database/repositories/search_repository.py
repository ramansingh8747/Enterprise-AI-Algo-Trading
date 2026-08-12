import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.schemas.search import SearchResultItem
from app.database.models.strategy import StrategyDefinition, StrategyInstance
from app.database.models.trading_journal import TradingJournalEntry
from app.database.models.alert import Alert
from app.database.models.watchlist import Watchlist, WatchlistItem
from app.database.models.paper_portfolio import PaperPortfolio, PaperPosition

# Default Market Symbols for workspace symbol search
DEFAULT_SEARCH_EQUITIES = [
    {"symbol": "RELIANCE", "name": "Reliance Industries Ltd", "price": 2450.00},
    {"symbol": "TCS", "name": "Tata Consultancy Services", "price": 3520.00},
    {"symbol": "INFY", "name": "Infosys Limited", "price": 1420.00},
    {"symbol": "HDFCBANK", "name": "HDFC Bank Limited", "price": 1650.00},
    {"symbol": "ICICIBANK", "name": "ICICI Bank Limited", "price": 980.00},
    {"symbol": "SBIN", "name": "State Bank of India", "price": 575.00},
    {"symbol": "BHARTIARTL", "name": "Bharti Airtel Limited", "price": 860.00},
    {"symbol": "ITC", "name": "ITC Limited", "price": 445.00},
    {"symbol": "KOTAKBANK", "name": "Kotak Mahindra Bank", "price": 1780.00},
    {"symbol": "LT", "name": "Larsen & Toubro Ltd", "price": 2650.00},
]

NAVIGATION_ITEMS = [
    {"id": "nav-dash", "title": "Dashboard", "subtitle": "Trading Command Center & Summary", "route": "/dashboard"},
    {"id": "nav-markets", "title": "Markets / Watchlist", "subtitle": "Live Equities & Price Ticker", "route": "/watchlist"},
    {"id": "nav-strat", "title": "Strategy & Signals", "subtitle": "Algorithmic Signal Explorer", "route": "/strategy"},
    {"id": "nav-port", "title": "Portfolio", "subtitle": "Holdings & Asset Allocation", "route": "/portfolio"},
    {"id": "nav-orders", "title": "Orders & Trades", "subtitle": "Paper Trade Order Book", "route": "/orders"},
    {"id": "nav-journal", "title": "Trading Journal", "subtitle": "Trade Log & Performance Journal", "route": "/journal"},
    {"id": "nav-brokers", "title": "Brokers", "subtitle": "Broker Connectivity & Health", "route": "/brokers"},
]


class SearchRepository:
    def __init__(self, db: Session):
        self.db = db

    def search_all(
        self,
        user_id: uuid.UUID,
        query: str,
        category: Optional[str] = None,
        limit: int = 20
    ) -> List[SearchResultItem]:
        q = query.strip().lower()
        if not q:
            return []

        results: List[SearchResultItem] = []
        pattern = f"%{q}%"

        # 1. Navigation Routes
        if not category or category.upper() in ["ALL", "NAVIGATION"]:
            for item in NAVIGATION_ITEMS:
                if q in item["title"].lower() or q in item["subtitle"].lower():
                    results.append(
                        SearchResultItem(
                            id=item["id"],
                            category="NAVIGATION",
                            title=item["title"],
                            subtitle=item["subtitle"],
                            route=item["route"],
                            action="NAVIGATE"
                        )
                    )

        # 2. Market / Equities
        if not category or category.upper() in ["ALL", "EQUITY"]:
            # Query Watchlist items for user first
            user_symbols = (
                self.db.query(WatchlistItem.symbol)
                .join(Watchlist, WatchlistItem.watchlist_id == Watchlist.id)
                .filter(Watchlist.user_id == user_id)
                .filter(WatchlistItem.symbol.ilike(pattern))
                .all()
            )
            found_symbols = {s[0].upper() for s in user_symbols}

            # Search in default equities list
            for eq in DEFAULT_SEARCH_EQUITIES:
                if q in eq["symbol"].lower() or q in eq["name"].lower() or eq["symbol"] in found_symbols:
                    results.append(
                        SearchResultItem(
                            id=f"eq-{eq['symbol']}",
                            category="EQUITY",
                            title=eq["symbol"],
                            subtitle=eq["name"],
                            description=f"Market Quote: ₹{eq['price']:.2f}",
                            symbol=eq["symbol"],
                            route="/watchlist",
                            action="OPEN_ORDER",
                            metadata={"price": eq["price"], "side": "BUY"}
                        )
                    )

        # 3. User Strategy Definitions & Instances (Strict User Isolation)
        if not category or category.upper() in ["ALL", "STRATEGY"]:
            definitions = (
                self.db.query(StrategyDefinition)
                .filter(StrategyDefinition.user_id == user_id)
                .filter(
                    or_(
                        StrategyDefinition.name.ilike(pattern),
                        StrategyDefinition.strategy_type.ilike(pattern)
                    )
                )
                .limit(limit)
                .all()
            )
            for d in definitions:
                results.append(
                    SearchResultItem(
                        id=f"strat-def-{d.id}",
                        category="STRATEGY",
                        title=d.name,
                        subtitle=f"Strategy Definition • {d.strategy_type}",
                        description=f"Type: {d.strategy_type}",
                        route="/strategy",
                        action="NAVIGATE"
                    )
                )


            instances = (
                self.db.query(StrategyInstance)
                .join(StrategyDefinition, StrategyInstance.strategy_definition_id == StrategyDefinition.id)
                .filter(StrategyInstance.user_id == user_id)
                .filter(
                    or_(
                        StrategyDefinition.name.ilike(pattern),
                        StrategyInstance.execution_mode.ilike(pattern),
                        StrategyInstance.status.ilike(pattern)
                    )
                )
                .limit(limit)
                .all()
            )
            for inst in instances:
                results.append(
                    SearchResultItem(
                        id=f"strat-inst-{inst.id}",
                        category="STRATEGY",
                        title=f"Instance: {inst.status}",
                        subtitle=f"Status: {inst.status} ({inst.execution_mode})",
                        route="/strategy",
                        action="NAVIGATE"
                    )
                )


        # 4. User Trading Journal Entries (Strict User Isolation)
        if not category or category.upper() in ["ALL", "JOURNAL"]:
            journal_entries = (
                self.db.query(TradingJournalEntry)
                .filter(TradingJournalEntry.user_id == user_id)
                .filter(
                    or_(
                        TradingJournalEntry.symbol.ilike(pattern),
                        TradingJournalEntry.notes.ilike(pattern),
                        TradingJournalEntry.tags.ilike(pattern)
                    )
                )
                .limit(limit)
                .all()
            )
            for j in journal_entries:
                results.append(
                    SearchResultItem(
                        id=f"journal-{j.id}",
                        category="JOURNAL",
                        title=f"Journal: {j.symbol} ({j.side})",
                        subtitle=f"Entry Date: {j.created_at.strftime('%Y-%m-%d') if j.created_at else 'Recent'}",
                        description=j.notes or f"Qty: {j.quantity} @ ₹{j.entry_price}",
                        symbol=j.symbol,
                        route="/journal",
                        action="NAVIGATE"
                    )
                )

        # 5. User System & Risk Alerts (Strict User Isolation)
        if not category or category.upper() in ["ALL", "ALERT"]:
            alerts = (
                self.db.query(Alert)
                .filter(Alert.user_id == user_id)
                .filter(
                    or_(
                        Alert.title.ilike(pattern),
                        Alert.message.ilike(pattern),
                        Alert.type.ilike(pattern)
                    )
                )
                .limit(limit)
                .all()
            )
            for a in alerts:
                results.append(
                    SearchResultItem(
                        id=f"alert-{a.id}",
                        category="ALERT",
                        title=a.title,
                        subtitle=f"[{a.severity}] {a.type} Alert",
                        description=a.message,
                        route=a.route or "/dashboard",
                        action="NAVIGATE"
                    )
                )

        # 6. User Paper Portfolios & Positions (Strict User Isolation)
        if not category or category.upper() in ["ALL", "ORDER", "PORTFOLIO"]:
            portfolios = (
                self.db.query(PaperPortfolio)
                .filter(PaperPortfolio.user_id == user_id)
                .filter(PaperPortfolio.name.ilike(pattern))
                .limit(limit)
                .all()
            )
            for p in portfolios:
                results.append(
                    SearchResultItem(
                        id=f"port-{p.id}",
                        category="ORDER",
                        title=f"Portfolio: {p.name}",
                        subtitle=f"Balance: ₹{float(p.cash_balance):,.2f}",
                        route="/portfolio",
                        action="NAVIGATE"
                    )
                )

            positions = (
                self.db.query(PaperPosition)
                .filter(PaperPosition.user_id == user_id)
                .filter(PaperPosition.symbol.ilike(pattern))
                .limit(limit)
                .all()
            )
            for pos in positions:
                results.append(
                    SearchResultItem(
                        id=f"pos-{pos.id}",
                        category="ORDER",
                        title=f"Position: {pos.symbol}",
                        subtitle=f"Qty: {pos.quantity} @ ₹{float(pos.average_price):,.2f}",
                        symbol=pos.symbol,
                        route="/portfolio",
                        action="NAVIGATE"
                    )
                )


        # 7. Quick Trading Actions
        if not category or category.upper() in ["ALL", "ACTION"]:
            if "buy" in q or "order" in q:
                results.append(
                    SearchResultItem(
                        id="act-buy",
                        category="ACTION",
                        title="Place Paper BUY Order",
                        subtitle="Open Paper Trading Order Form (BUY)",
                        action="OPEN_ORDER",
                        metadata={"side": "BUY"}
                    )
                )
            if "sell" in q or "order" in q:
                results.append(
                    SearchResultItem(
                        id="act-sell",
                        category="ACTION",
                        title="Place Paper SELL Order",
                        subtitle="Open Paper Trading Order Form (SELL)",
                        action="OPEN_ORDER",
                        metadata={"side": "SELL"}
                    )
                )

        return results[:limit]
