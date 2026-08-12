import { Equity } from "@/types/market";
import { TradingSignal, SignalAction, SignalTrend } from "@/types/signal";

export const createTradingSignal = (equity: Equity): TradingSignal => {
  const { price, changePercent } = equity;

  let action: SignalAction = "HOLD";
  let trend: SignalTrend = "NEUTRAL";

  if (changePercent >= 1) {
    action = "BUY";
    trend = "BULLISH";
  } else if (changePercent <= -1) {
    action = "SELL";
    trend = "BEARISH";
  }

  const strength = Math.min(95, Math.max(50, Math.round(50 + Math.abs(changePercent) * 20)));

  const entryPrice = price;
  let targetPrice = 0;
  let stopLoss = 0;

  if (action === "BUY") {
    targetPrice = parseFloat((entryPrice * 1.03).toFixed(2));
    stopLoss = parseFloat((entryPrice * 0.98).toFixed(2));
  } else if (action === "SELL") {
    targetPrice = parseFloat((entryPrice * 0.97).toFixed(2));
    stopLoss = parseFloat((entryPrice * 1.02).toFixed(2));
  } else {
    targetPrice = parseFloat((entryPrice * 1.01).toFixed(2));
    stopLoss = parseFloat((entryPrice * 0.99).toFixed(2));
  }

  const indicators = {
    rsi: parseFloat(Math.min(80, Math.max(20, 50 + changePercent * 8)).toFixed(1)),
    movingAverage20: parseFloat((price * (1 - changePercent / 1000)).toFixed(2)),
    movingAverage50: parseFloat((price * (1 - changePercent / 700)).toFixed(2)),
    momentum: parseFloat((changePercent * 10).toFixed(1)),
  };

  const strategy = action === "BUY" ? "Momentum Breakout" : action === "SELL" ? "Momentum Reversal" : "Trend Watch";

  return {
    symbol: equity.symbol,
    name: equity.name,
    price,
    action,
    trend,
    strength,
    entryPrice,
    targetPrice,
    stopLoss,
    indicators,
    strategy,
    generatedAt: new Date().toISOString(),
    mode: "MOCK",
  };
};
