import { TradingJournalEntry } from '@/types/tradingJournal';

export type JournalFilterSide = 'ALL' | 'BUY' | 'SELL';
export type JournalFilterResult = 'ALL' | 'WIN' | 'LOSS' | 'BREAKEVEN' | 'OPEN';
export type JournalSort = 'DATE' | 'PNL' | 'QUANTITY' | 'SYMBOL';

export interface JournalAnalyticsSummary {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  openTrades: number;
  winRate: number;
  totalPnl: number;
  averagePnl: number;
  buyTradesCount: number;
  sellTradesCount: number;
  buyWinRate: number;
  sellWinRate: number;
  bestTrade: TradingJournalEntry | null;
  worstTrade: TradingJournalEntry | null;
}
