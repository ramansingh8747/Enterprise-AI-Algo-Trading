const WATCHLIST_STORAGE_KEY = 'algo_trading_watchlist_symbols';

const DEFAULT_SYMBOLS = [
  'RELIANCE',
  'TCS',
  'INFY',
  'HDFCBANK',
  'ICICIBANK',
  'SBIN',
  'ITC',
  'LT',
];

export const getWatchlistSymbols = (): string[] => {
  try {
    const stored = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(DEFAULT_SYMBOLS));
      return DEFAULT_SYMBOLS;
    }
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SYMBOLS;
  } catch {
    return DEFAULT_SYMBOLS;
  }
};

export const addWatchlistSymbol = (symbol: string): string[] => {
  const current = getWatchlistSymbols();
  const upper = symbol.trim().toUpperCase();
  if (current.includes(upper)) return current;
  const updated = [upper, ...current];
  try {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(updated));
  } catch (_err) {
    // Ignored localStorage error
  }
  return updated;
};

export const removeWatchlistSymbol = (symbol: string): string[] => {
  const current = getWatchlistSymbols();
  const upper = symbol.trim().toUpperCase();
  const updated = current.filter(s => s !== upper);
  try {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(updated));
  } catch (_err) {
    // Ignored localStorage error
  }
  return updated;
};

export const isSymbolInWatchlist = (symbol: string): boolean => {
  const current = getWatchlistSymbols();
  return current.includes(symbol.trim().toUpperCase());
};
