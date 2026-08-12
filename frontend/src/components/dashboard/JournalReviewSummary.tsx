import React from 'react';
import { TradingJournalEntry } from '@/types/tradingJournal';
import { JournalAnalyticsSummary } from '@/types/journalAnalytics';

interface JournalReviewSummaryProps {
  entries: TradingJournalEntry[];
  analytics: JournalAnalyticsSummary;
  onSelectEntry?: (entry: TradingJournalEntry) => void;
}

export const JournalReviewSummary: React.FC<JournalReviewSummaryProps> = ({
  entries,
  analytics: _analytics,
  onSelectEntry,
}) => {
  const topWinningEntry = [...entries].filter(e => e.result === 'WIN').sort((a, b) => b.realizedPnl - a.realizedPnl)[0] || null;
  const topLosingEntry = [...entries].filter(e => e.result === 'LOSS').sort((a, b) => a.realizedPnl - b.realizedPnl)[0] || null;

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
          Trade Review & Performance Breakdown
        </h3>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Winning vs losing trade reviews, strategy contribution and top performers
        </span>
      </div>

      {/* Top & Worst Performers Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        {/* Top Win Trade Review */}
        <div style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: '0.65rem', padding: '1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 700 }}>BEST REVIEWED WIN</span>
          {topWinningEntry ? (
            <div style={{ marginTop: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '1.1rem', color: '#f8fafc' }}>{topWinningEntry.symbol}</strong>
                <button
                  onClick={() => onSelectEntry?.(topWinningEntry)}
                  style={{ background: 'transparent', border: 'none', color: '#4ade80', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                >
                  Review Trade →
                </button>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#4ade80', marginTop: '0.2rem' }}>
                +₹{topWinningEntry.realizedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          ) : (
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>No winning trade reviews recorded yet.</p>
          )}
        </div>

        {/* Worst Loss Trade Review */}
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '0.65rem', padding: '1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 700 }}>LARGEST REVIEWED LOSS</span>
          {topLosingEntry ? (
            <div style={{ marginTop: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '1.1rem', color: '#f8fafc' }}>{topLosingEntry.symbol}</strong>
                <button
                  onClick={() => onSelectEntry?.(topLosingEntry)}
                  style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                >
                  Review Trade →
                </button>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f87171', marginTop: '0.2rem' }}>
                ₹{topLosingEntry.realizedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          ) : (
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>No losing trade reviews recorded.</p>
          )}
        </div>
      </div>
    </div>
  );
};
