import React from 'react';
import { TradingJournalSummary } from '@/types/tradingJournal';

interface JournalSummaryProps {
  summary: TradingJournalSummary;
}

export const JournalSummary: React.FC<JournalSummaryProps> = ({ summary }) => {
  const cards = [
    { label: "Total Trades", value: summary.totalTrades, color: "text-white" },
    { label: "Win Rate", value: `${summary.winRate.toFixed(1)}%`, color: "text-emerald-400" },
    { label: "Total P&L", value: `₹${summary.totalPnl.toLocaleString()}`, color: summary.totalPnl >= 0 ? "text-emerald-400" : "text-red-400" },
    { label: "Wins / Losses", value: `${summary.winningTrades} / ${summary.losingTrades}`, color: "text-white" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map((card, i) => (
        <div key={i} className="bg-[#1e293b] p-4 rounded-lg border border-[#334155] text-center">
          <div className="text-xs text-gray-400 mb-1">{card.label}</div>
          <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
        </div>
      ))}
    </div>
  );
};
