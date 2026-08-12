import { PaperHolding, PaperAccountSummary } from "@/types/paperPortfolio";
import { PaperOrder } from "@/components/dashboard/OrderForm";
import { initialEquities } from "@/data/marketData";

export const INITIAL_PAPER_BALANCE = 1000000; // ₹10,00,000

export const getMockCurrentPrice = (symbol: string, fallbackPrice: number): number => {
  const match = initialEquities.find((e) => e.symbol.toUpperCase() === symbol.toUpperCase());
  return match ? match.price : fallbackPrice;
};

export const recalculateHolding = (h: PaperHolding, currentPrice: number): PaperHolding => {
  const investedValue = h.quantity * h.averagePrice;
  const currentValue = h.quantity * currentPrice;
  const pnl = currentValue - investedValue;
  const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0;

  return {
    ...h,
    currentPrice,
    investedValue,
    currentValue,
    pnl,
    pnlPercent,
  };
};

export const applyBuyOrder = (
  holdings: PaperHolding[],
  order: PaperOrder
): { newHoldings: PaperHolding[]; tradeValue: number } => {
  const symbol = order.symbol.toUpperCase();
  const tradeValue = order.quantity * order.price;
  const currentPrice = getMockCurrentPrice(symbol, order.price);

  const existingIndex = holdings.findIndex((h) => h.symbol.toUpperCase() === symbol);

  const newHoldings = [...holdings];

  if (existingIndex >= 0) {
    const existing = holdings[existingIndex];
    const newQty = existing.quantity + order.quantity;
    const newInvestedVal = existing.quantity * existing.averagePrice + tradeValue;
    const newAvgPrice = newInvestedVal / newQty;

    newHoldings[existingIndex] = recalculateHolding(
      {
        ...existing,
        quantity: newQty,
        averagePrice: newAvgPrice,
      },
      currentPrice
    );
  } else {
    const newHolding: PaperHolding = recalculateHolding(
      {
        symbol,
        quantity: order.quantity,
        averagePrice: order.price,
        currentPrice,
        investedValue: tradeValue,
        currentValue: tradeValue,
        pnl: 0,
        pnlPercent: 0,
      },
      currentPrice
    );
    newHoldings.unshift(newHolding);
  }

  return { newHoldings, tradeValue };
};

export const applySellOrder = (
  holdings: PaperHolding[],
  order: PaperOrder
): { newHoldings: PaperHolding[]; tradeValue: number } => {
  const symbol = order.symbol.toUpperCase();
  const tradeValue = order.quantity * order.price;
  const currentPrice = getMockCurrentPrice(symbol, order.price);

  const existingIndex = holdings.findIndex((h) => h.symbol.toUpperCase() === symbol);

  if (existingIndex < 0) {
    return { newHoldings: holdings, tradeValue: 0 };
  }

  const existing = holdings[existingIndex];
  const newQty = Math.max(0, existing.quantity - order.quantity);

  const newHoldings = [...holdings];

  if (newQty === 0) {
    newHoldings.splice(existingIndex, 1);
  } else {
    newHoldings[existingIndex] = recalculateHolding(
      {
        ...existing,
        quantity: newQty,
      },
      currentPrice
    );
  }

  return { newHoldings, tradeValue };
};

export const calculateAccountSummary = (
  paperBalance: number,
  holdings: PaperHolding[]
): PaperAccountSummary => {
  const updatedHoldings = holdings.map((h) =>
    recalculateHolding(h, getMockCurrentPrice(h.symbol, h.currentPrice))
  );

  const investedValue = updatedHoldings.reduce((sum, h) => sum + h.investedValue, 0);
  const portfolioValue = updatedHoldings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalPnl = portfolioValue - investedValue;
  const totalPnlPercent = investedValue > 0 ? (totalPnl / investedValue) * 100 : 0;

  return {
    paperBalance,
    portfolioValue,
    investedValue,
    totalPnl,
    totalPnlPercent,
  };
};
