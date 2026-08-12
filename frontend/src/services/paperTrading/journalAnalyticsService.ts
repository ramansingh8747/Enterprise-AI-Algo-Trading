import { TradingJournalEntry } from '@/types/tradingJournal';
import { JournalAnalyticsSummary } from '@/types/journalAnalytics';

export const calculateJournalAnalytics = (entries: TradingJournalEntry[]): JournalAnalyticsSummary => {
  if (!entries || entries.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      openTrades: 0,
      winRate: 0,
      totalPnl: 0,
      averagePnl: 0,
      buyTradesCount: 0,
      sellTradesCount: 0,
      buyWinRate: 0,
      sellWinRate: 0,
      bestTrade: null,
      worstTrade: null,
    };
  }

  const completed = entries.filter(e => e.result !== 'OPEN');
  const winningTrades = completed.filter(e => e.result === 'WIN').length;
  const losingTrades = completed.filter(e => e.result === 'LOSS').length;
  const openTrades = entries.filter(e => e.result === 'OPEN').length;

  const totalPnl = completed.reduce((sum, e) => sum + (e.realizedPnl || 0), 0);
  const winRate = completed.length > 0 ? (winningTrades / completed.length) * 100 : 0;
  const averagePnl = completed.length > 0 ? totalPnl / completed.length : 0;

  const buyEntries = completed.filter(e => e.side === 'BUY');
  const buyWins = buyEntries.filter(e => e.result === 'WIN').length;
  const buyWinRate = buyEntries.length > 0 ? (buyWins / buyEntries.length) * 100 : 0;

  const sellEntries = completed.filter(e => e.side === 'SELL');
  const sellWins = sellEntries.filter(e => e.result === 'WIN').length;
  const sellWinRate = sellEntries.length > 0 ? (sellWins / sellEntries.length) * 100 : 0;

  const sortedByPnl = [...completed].sort((a, b) => (b.realizedPnl || 0) - (a.realizedPnl || 0));
  const bestTrade = sortedByPnl[0] && (sortedByPnl[0].realizedPnl || 0) > 0 ? sortedByPnl[0] : null;
  const worstTrade = sortedByPnl[sortedByPnl.length - 1] && (sortedByPnl[sortedByPnl.length - 1].realizedPnl || 0) < 0 ? sortedByPnl[sortedByPnl.length - 1] : null;

  return {
    totalTrades: entries.length,
    winningTrades,
    losingTrades,
    openTrades,
    winRate,
    totalPnl,
    averagePnl,
    buyTradesCount: entries.filter(e => e.side === 'BUY').length,
    sellTradesCount: entries.filter(e => e.side === 'SELL').length,
    buyWinRate,
    sellWinRate,
    bestTrade,
    worstTrade,
  };
};
