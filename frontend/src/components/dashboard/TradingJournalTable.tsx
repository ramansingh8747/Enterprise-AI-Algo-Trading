import React from 'react';
import { TradingJournalEntry } from '@/types/tradingJournal';

interface TradingJournalTableProps {
  entries: TradingJournalEntry[];
  onSelectEntry?: (entry: TradingJournalEntry) => void;
}

export const TradingJournalTable: React.FC<TradingJournalTableProps> = ({ entries, onSelectEntry }) => {
  return (
    <div className="overflow-x-auto bg-[#1e293b] rounded-lg border border-[#334155]">
      <table className="w-full text-left text-xs text-gray-300">
        <thead className="bg-[#0f172a] text-gray-400 uppercase">
          <tr>
            <th className="p-3">Date</th>
            <th className="p-3">Symbol</th>
            <th className="p-3">Side</th>
            <th className="p-3">Qty</th>
            <th className="p-3">Entry</th>
            <th className="p-3">Exit</th>
            <th className="p-3">P&L</th>
            <th className="p-3">Result</th>
            <th className="p-3">Source</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(e => {
            const getSourceBadge = () => {
              if (e.paper_trade_id) return { label: `Paper: ${e.paper_trade_id}`, color: '#fbbf24' };
              if (e.broker_order_id) return { label: `Broker: ${e.broker_order_id}`, color: '#38bdf8' };
              if (e.strategy_signal_id) return { label: `Signal: ${e.strategy_signal_id.substring(0, 6)}`, color: '#a855f7' };
              if (e.strategy_instance_id) return { label: `Strategy: ${e.strategy_instance_id.substring(0, 6)}`, color: '#818cf8' };
              return { label: 'Manual', color: '#94a3b8' };
            };
            const badge = getSourceBadge();

            return (
              <tr
                key={e.id}
                onClick={() => onSelectEntry?.(e)}
                className="border-t border-[#334155] hover:bg-[#0f172a] cursor-pointer transition-colors"
              >
                <td className="p-3">{new Date(e.openedAt).toLocaleDateString()}</td>
                <td className="p-3 font-bold text-white">{e.symbol}</td>
                <td className={`p-3 font-bold ${e.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>{e.side}</td>
                <td className="p-3">{e.quantity}</td>
                <td className="p-3">₹{e.entryPrice.toFixed(2)}</td>
                <td className="p-3">{e.exitPrice ? `₹${e.exitPrice.toFixed(2)}` : '-'}</td>
                <td className={`p-3 font-bold ${e.realizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {e.realizedPnl !== 0 ? `₹${e.realizedPnl.toFixed(2)}` : '-'}
                </td>
                <td className={`p-3 font-bold ${e.result === 'WIN' ? 'text-emerald-400' : e.result === 'LOSS' ? 'text-red-400' : 'text-gray-400'}`}>
                  {e.result}
                </td>
                <td className="p-3">
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '0.25rem',
                    color: badge.color,
                    background: `${badge.color}20`,
                    border: `1px solid ${badge.color}40`,
                  }}>
                    {badge.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>

      </table>
    </div>
  );
};
