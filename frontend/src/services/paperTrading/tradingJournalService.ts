import { TradingJournalEntry, TradingJournalSummary } from "@/types/tradingJournal";

const JOURNAL_KEY = "algo_trading_paper_journal";

export function getJournalEntries(): TradingJournalEntry[] {
  try {
    const stored = localStorage.getItem(JOURNAL_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveJournalEntries(entries: TradingJournalEntry[]): void {
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
}

export function addJournalEntry(entry: TradingJournalEntry): void {
  const entries = getJournalEntries();
  saveJournalEntries([entry, ...entries]);
}

export function clearJournal(): void {
  localStorage.removeItem(JOURNAL_KEY);
}

export function getJournalSummary(): TradingJournalSummary {
  const entries = getJournalEntries();
  
  const completed = entries.filter(e => e.result !== "OPEN");
  const winningTrades = completed.filter(e => e.result === "WIN").length;
  const losingTrades = completed.filter(e => e.result === "LOSS").length;
  const openTrades = entries.filter(e => e.result === "OPEN").length;
  
  const totalPnl = completed.reduce((sum, e) => sum + e.realizedPnl, 0);
  const winRate = completed.length > 0 ? (winningTrades / completed.length) * 100 : 0;
  
  return {
    totalTrades: entries.length,
    winningTrades,
    losingTrades,
    openTrades,
    totalPnl,
    winRate,
    buyTrades: entries.filter(e => e.side === "BUY").length,
    sellTrades: entries.filter(e => e.side === "SELL").length,
  };
}
