import { PaperHolding } from '@/types/paperPortfolio';

export type PositionFilter = 'ALL' | 'GAINERS' | 'LOSERS' | 'HIGH_EXPOSURE';
export type PositionSort = 'SYMBOL' | 'VALUE' | 'PNL' | 'EXPOSURE';

export interface PortfolioAnalyticsSummary {
  totalInvested: number;
  currentValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  winningCount: number;
  losingCount: number;
  neutralCount: number;
  topGainer: PaperHolding | null;
  topLoser: PaperHolding | null;
}
