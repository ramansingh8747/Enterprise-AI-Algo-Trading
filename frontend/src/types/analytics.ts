export interface PerformancePoint {
  label: string;
  value: number;
}

export interface PnlPoint {
  label: string;
  pnl: number;
}

export interface TradingStatistics {
  totalOrders: number;
  executedOrders: number;
  cancelledOrders: number;
  buyOrders: number;
  sellOrders: number;
  winningOrders: number;
  losingOrders: number;
  winRate: number;
}

export interface PortfolioAllocation {
  symbol: string;
  value: number;
  percentage: number;
}
