import { SearchResult } from '@/types/globalSearch';
import { initialEquities } from '@/data/marketData';
import { ROUTES } from '@/constants/routes';
import { searchApi } from '@/services/api/searchApi';

const RECENT_SEARCHES_KEY = 'algo_trading_recent_searches';

export const getRecentSearches = (): string[] => {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveRecentSearch = (query: string): void => {
  if (!query.trim()) return;
  const recent = getRecentSearches();
  const filtered = recent.filter(q => q.toLowerCase() !== query.toLowerCase());
  const updated = [query.trim(), ...filtered].slice(0, 10);
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch (_err) {
    // Ignored localStorage error
  }
};

export const clearRecentSearches = (): void => {
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([]));
  } catch (_err) {
    // Ignored localStorage error
  }
};

export const searchGlobalAsync = async (query: string): Promise<SearchResult[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const serverResults = await searchApi.search(trimmed);
    if (serverResults && serverResults.length > 0) {
      return serverResults;
    }
  } catch (error) {
    console.warn('Server search API call failed, using client fallback:', error);
  }

  return searchGlobal(trimmed);
};

export const searchGlobal = (query: string): SearchResult[] => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const results: SearchResult[] = [];

  // 1. Navigation Routes
  const navigationItems: SearchResult[] = [
    { id: 'nav-dash', category: 'NAVIGATION', title: 'Dashboard', subtitle: 'Trading Command Center & Summary', route: ROUTES.DASHBOARD, action: 'NAVIGATE' },
    { id: 'nav-markets', category: 'NAVIGATION', title: 'Markets / Watchlist', subtitle: 'Live Equities & Price Ticker', route: ROUTES.WATCHLIST, action: 'NAVIGATE' },
    { id: 'nav-strat', category: 'NAVIGATION', title: 'Strategy & Signals', subtitle: 'Algorithmic Signal Explorer', route: ROUTES.STRATEGY, action: 'NAVIGATE' },
    { id: 'nav-port', category: 'NAVIGATION', title: 'Portfolio', subtitle: 'Holdings & Asset Allocation', route: ROUTES.PORTFOLIO, action: 'NAVIGATE' },
    { id: 'nav-orders', category: 'NAVIGATION', title: 'Orders & Trades', subtitle: 'Paper Trade Order Book', route: ROUTES.ORDERS, action: 'NAVIGATE' },
    { id: 'nav-journal', category: 'NAVIGATION', title: 'Trading Journal', subtitle: 'Trade Log & Performance Journal', route: ROUTES.JOURNAL, action: 'NAVIGATE' },
    { id: 'nav-brokers', category: 'NAVIGATION', title: 'Brokers', subtitle: 'Broker Connectivity & Health', route: ROUTES.BROKERS, action: 'NAVIGATE' },
  ];

  navigationItems.forEach(item => {
    if (item.title.toLowerCase().includes(trimmed) || item.subtitle?.toLowerCase().includes(trimmed)) {
      results.push(item);
    }
  });

  // 2. Market Equities
  initialEquities.forEach(eq => {
    if (eq.symbol.toLowerCase().includes(trimmed) || eq.name.toLowerCase().includes(trimmed)) {
      results.push({
        id: `eq-${eq.symbol}`,
        category: 'EQUITY',
        title: eq.symbol,
        subtitle: eq.name,
        description: `Current Price: ₹${eq.price.toFixed(2)} (${eq.changePercent >= 0 ? '+' : ''}${eq.changePercent.toFixed(2)}%)`,
        symbol: eq.symbol,
        route: ROUTES.WATCHLIST,
        action: 'OPEN_ORDER',
        metadata: { price: eq.price, side: 'BUY' },
      });
    }
  });

  // 3. Quick Actions
  if ('paper buy'.includes(trimmed) || 'buy'.includes(trimmed)) {
    results.push({
      id: 'act-buy',
      category: 'ACTION',
      title: 'Place Paper BUY Order',
      subtitle: 'Open Paper Trading Order Form (BUY)',
      action: 'OPEN_ORDER',
      metadata: { side: 'BUY' },
    });
  }

  if ('paper sell'.includes(trimmed) || 'sell'.includes(trimmed)) {
    results.push({
      id: 'act-sell',
      category: 'ACTION',
      title: 'Place Paper SELL Order',
      subtitle: 'Open Paper Trading Order Form (SELL)',
      action: 'OPEN_ORDER',
      metadata: { side: 'SELL' },
    });
  }

  return results;
};
