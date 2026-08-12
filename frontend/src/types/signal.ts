export type SignalAction = "BUY" | "SELL" | "HOLD";
export type SignalTrend = "BULLISH" | "BEARISH" | "NEUTRAL";

export interface TechnicalIndicators {
  rsi: number;
  movingAverage20: number;
  movingAverage50: number;
  momentum: number;
}

export interface TradingSignal {
  symbol: string;
  name: string;
  price: number;
  action: SignalAction;
  trend: SignalTrend;
  strength: number;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  indicators: TechnicalIndicators;
  strategy: string;
  generatedAt: string;
  mode: "MOCK";
}
