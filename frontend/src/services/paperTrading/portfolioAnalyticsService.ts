import { PaperHolding } from '@/types/paperPortfolio';
import { PortfolioAnalyticsSummary } from '@/types/portfolioAnalytics';

export const calculatePortfolioAnalytics = (holdings: PaperHolding[]): PortfolioAnalyticsSummary => {
  if (!holdings || holdings.length === 0) {
    return {
      totalInvested: 0,
      currentValue: 0,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
      winningCount: 0,
      losingCount: 0,
      neutralCount: 0,
      topGainer: null,
      topLoser: null,
    };
  }

  const totalInvested = holdings.reduce((sum, h) => sum + (h.investedValue || 0), 0);
  const currentValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
  const unrealizedPnl = currentValue - totalInvested;
  const unrealizedPnlPercent = totalInvested > 0 ? (unrealizedPnl / totalInvested) * 100 : 0;

  const winningCount = holdings.filter(h => h.pnl > 0).length;
  const losingCount = holdings.filter(h => h.pnl < 0).length;
  const neutralCount = holdings.filter(h => h.pnl === 0).length;

  const sortedByPnl = [...holdings].sort((a, b) => b.pnl - a.pnl);
  const topGainer = sortedByPnl[0] && sortedByPnl[0].pnl > 0 ? sortedByPnl[0] : null;
  const topLoser = sortedByPnl[sortedByPnl.length - 1] && sortedByPnl[sortedByPnl.length - 1].pnl < 0 ? sortedByPnl[sortedByPnl.length - 1] : null;

  return {
    totalInvested,
    currentValue,
    unrealizedPnl,
    unrealizedPnlPercent,
    winningCount,
    losingCount,
    neutralCount,
    topGainer,
    topLoser,
  };
};
