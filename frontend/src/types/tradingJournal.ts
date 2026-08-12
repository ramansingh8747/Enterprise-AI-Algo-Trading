export type TradeSide = "BUY" | "SELL";
export type TradeResult = "WIN" | "LOSS" | "BREAKEVEN" | "OPEN";

export interface TradingJournalEntry {
  id: string;
  symbol: string;
  name?: string;
  side: TradeSide;
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  tradeValue: number;
  realizedPnl: number;
  realizedPnlPercent: number;
  result: TradeResult;
  strategy?: string;
  signalStrength?: number;
  openedAt: string;
  closedAt?: string;
  mode: "PAPER";
  paper_trade_id?: string;
  broker_order_id?: string;
  strategy_instance_id?: string;
  strategy_signal_id?: string;
}


export interface TradingJournalSummary {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  openTrades: number;
  totalPnl: number;
  winRate: number;
  buyTrades: number;
  sellTrades: number;
}
