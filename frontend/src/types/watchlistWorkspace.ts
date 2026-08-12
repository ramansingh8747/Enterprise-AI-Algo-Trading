export type WatchlistFilter = 'ALL' | 'GAINERS' | 'LOSERS' | 'BUY' | 'SELL' | 'HOLD';
export type WatchlistSort = 'SYMBOL' | 'PRICE' | 'CHANGE' | 'STRENGTH';

export interface WatchlistSummary {
  totalCount: number;
  gainersCount: number;
  losersCount: number;
  neutralCount: number;
  signalCount: number;
}
