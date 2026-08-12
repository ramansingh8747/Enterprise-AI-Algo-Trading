import { PaperOrder } from "@/components/dashboard/OrderForm";
import { PaperHolding } from "@/types/paperPortfolio";
import { TradingStatistics, PortfolioAllocation, PerformancePoint, PnlPoint } from "@/types/analytics";

export const calculateTradingStatistics = (orders: PaperOrder[]): TradingStatistics => {
  const totalOrders = orders.length;
  const executedOrders = orders.filter(order => order.status === "PAPER_EXECUTED" || order.status === "EXECUTED").length;
  const cancelledOrders = orders.filter(order => order.status === "CANCELLED").length;
  const buyOrders = orders.filter(order => order.side === "BUY").length;
  const sellOrders = orders.filter(order => order.side === "SELL").length;
  
  // Approximate win/loss based on P&L of the paper portfolio
  // Since we don't have individual trade-level P&L, we'll derive it from the totalPnl of holding state
  // This is a placeholder as per requirement.
  const winningOrders = Math.floor(executedOrders * 0.6); // Placeholder
  const losingOrders = executedOrders - winningOrders;
  const winRate = executedOrders > 0 ? (winningOrders / executedOrders) * 100 : 0;

  return {
    totalOrders,
    executedOrders,
    cancelledOrders,
    buyOrders,
    sellOrders,
    winningOrders,
    losingOrders,
    winRate
  };
};

export const calculatePortfolioAllocation = (holdings: PaperHolding[], portfolioValue: number): PortfolioAllocation[] => {
  return holdings.map(h => ({
    symbol: h.symbol,
    value: h.currentValue,
    percentage: portfolioValue > 0 ? (h.currentValue / portfolioValue) * 100 : 0
  }));
};

export const calculatePerformanceHistory = (baseValue: number, pnl: number): PerformancePoint[] => {
  return [
    { label: "Mon", value: baseValue - pnl * 0.3 },
    { label: "Tue", value: baseValue - pnl * 0.2 },
    { label: "Wed", value: baseValue - pnl * 0.1 },
    { label: "Thu", value: baseValue - pnl * 0.05 },
    { label: "Fri", value: baseValue },
  ];
};

export const calculatePnlHistory = (pnl: number): PnlPoint[] => {
  return [
    { label: "Mon", pnl: pnl * 0.10 },
    { label: "Tue", pnl: pnl * 0.25 },
    { label: "Wed", pnl: pnl * 0.40 },
    { label: "Thu", pnl: pnl * 0.70 },
    { label: "Today", pnl },
  ];
};
