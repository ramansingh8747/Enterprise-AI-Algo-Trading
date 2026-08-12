import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { getJournalEntries, clearJournal } from '@/services/paperTrading/tradingJournalService';
import { calculateJournalAnalytics } from '@/services/paperTrading/journalAnalyticsService';
import { JournalTradeDetail } from '@/components/dashboard/JournalTradeDetail';
import { JournalPerformanceChart } from '@/components/dashboard/JournalPerformanceChart';
import { JournalReviewSummary } from '@/components/dashboard/JournalReviewSummary';
import { TradingJournalTable } from '@/components/dashboard/TradingJournalTable';
import { JournalEntryModal } from '@/components/dashboard/JournalEntryModal';
import { tradingJournalApi } from '@/services/api/tradingJournalApi';
import { useWebSocketSubscription } from '@/hooks/useWebSocketSubscription';
import { TradingJournalEntry } from '@/types/tradingJournal';
import { JournalFilterSide, JournalFilterResult, JournalSort } from '@/types/journalAnalytics';

export default function TradingJournalPage() {
  const navigate = useNavigate();
  const [localEntries] = useState<TradingJournalEntry[]>(() => getJournalEntries());
  const [serverEntries, setServerEntries] = useState<TradingJournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');


  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sideFilter, setSideFilter] = useState<JournalFilterSide>('ALL');
  const [resultFilter, setResultFilter] = useState<JournalFilterResult>('ALL');
  const [sort, setSort] = useState<JournalSort>('DATE');
  const [selectedEntry, setSelectedEntry] = useState<TradingJournalEntry | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchServerEntries = useCallback(async () => {
    try {
      setLoading(true);
      const data = await tradingJournalApi.listEntries();
      const mapped: TradingJournalEntry[] = data.map((item: any) => ({
        id: item.id,
        symbol: item.symbol,
        side: item.side,
        quantity: item.quantity,
        entryPrice: item.entry_price,
        exitPrice: item.exit_price ?? undefined,
        tradeValue: item.quantity * item.entry_price,
        realizedPnl: item.realized_pnl ?? 0,
        realizedPnlPercent: item.realized_pnl && item.entry_price ? (item.realized_pnl / (item.quantity * item.entry_price)) * 100 : 0,
        result: (item.result as any) || (item.realized_pnl > 0 ? 'WIN' : item.realized_pnl < 0 ? 'LOSS' : 'OPEN'),
        openedAt: item.created_at,
        mode: 'PAPER',
        paper_trade_id: item.paper_trade_id,
        broker_order_id: item.broker_order_id,
        strategy_instance_id: item.strategy_instance_id,
        strategy_signal_id: item.strategy_signal_id,
      }));
      setServerEntries(mapped);
    } catch (_err) {
      // Keep local entries if offline or unauthenticated
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServerEntries();
  }, [fetchServerEntries]);

  // Real-time WebSocket refresh subscription
  useWebSocketSubscription('journal:events', () => {
    fetchServerEntries();
  });

  const entries = useMemo(() => {
    const combined = [...serverEntries];
    for (const loc of localEntries) {
      if (!combined.some(s => s.id === loc.id)) {
        combined.push(loc);
      }
    }
    return combined;
  }, [serverEntries, localEntries]);

  const analytics = useMemo(() => calculateJournalAnalytics(entries), [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesSymbol = e.symbol.toLowerCase().includes(q);
        const matchesStrategy = e.strategy?.toLowerCase().includes(q);
        const matchesId = e.id.toLowerCase().includes(q);
        if (!matchesSymbol && !matchesStrategy && !matchesId) return false;
      }

      if (sideFilter !== 'ALL' && e.side !== sideFilter) return false;
      if (resultFilter !== 'ALL' && e.result !== resultFilter) return false;

      return true;
    }).sort((a, b) => {
      if (sort === 'SYMBOL') return a.symbol.localeCompare(b.symbol);
      if (sort === 'PNL') return (b.realizedPnl || 0) - (a.realizedPnl || 0);
      if (sort === 'QUANTITY') return b.quantity - a.quantity;
      return new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime();
    });
  }, [entries, search, sideFilter, resultFilter, sort]);

  const executeClearJournal = () => {
    clearJournal();
    setServerEntries([]);
    setConfirmClear(false);
    setNotification("Journal records cleared successfully.");
    setTimeout(() => setNotification(null), 3000);
  };


  return (
    <div style={{ color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '1.25rem',
          right: '1.25rem',
          zIndex: 100,
          background: '#064e3b',
          border: '1px solid #10b981',
          borderRadius: '0.5rem',
          padding: '0.85rem 1.25rem',
          color: '#a7f3d0',
          fontSize: '0.875rem',
          fontWeight: 600,
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}>
          <span>⚡ {notification}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            style={{ background: 'none', border: 'none', color: '#a7f3d0', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {confirmClear && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(2, 6, 23, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}>
          <div style={{
            background: '#111c2d',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '0.85rem',
            padding: '1.5rem',
            maxWidth: '420px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          }}>
            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>⚠️</span>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
              Clear Trading Journal?
            </h3>
            <p style={{ margin: '0.5rem 0 1.25rem 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Are you sure you want to clear all paper trading journal execution logs?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                style={{
                  padding: '0.55rem 1.1rem',
                  borderRadius: '0.375rem',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#cbd5e1',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeClearJournal}
                style={{
                  padding: '0.55rem 1.1rem',
                  borderRadius: '0.375rem',
                  background: 'rgba(239, 68, 68, 0.25)',
                  border: '1px solid rgba(248, 113, 113, 0.35)',
                  color: '#fca5a5',
                  fontWeight: 800,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Clear Log
              </button>
            </div>
          </div>
        </div>
      )}

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1 style={{ margin: 0, fontSize: '1.85rem', fontWeight: 900, color: '#f8fafc' }}>
                Trading Journal Intelligence
              </h1>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#fbbf24',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                padding: '0.2rem 0.65rem',
                borderRadius: '1rem',
              }}>
                PAPER TRADING ONLY — REAL ORDERS DISABLED
              </span>
              {loading && (
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8' }}>
                  Syncing...
                </span>
              )}
            </div>
            <p style={{ margin: '0.5rem 0 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>

              Review paper trades, execution log history, strategy win rates and performance analytics.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              style={{
                padding: '0.55rem 1.15rem',
                borderRadius: '0.5rem',
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.8125rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              + Add Journal Entry
            </button>

            {entries.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                style={{
                  padding: '0.55rem 1.1rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#fca5a5',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Clear Journal Log
              </button>
            )}
          </div>

        </div>

        {/* Journal Summary KPI Cards */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Total Paper Trades</span>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8' }}>
              {analytics.totalTrades}
            </p>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Win Rate %</span>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#4ade80' }}>
              {analytics.winRate.toFixed(1)}%
            </p>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Win / Loss Count</span>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#cbd5e1' }}>
              <span style={{ color: '#4ade80' }}>{analytics.winningTrades}</span> / <span style={{ color: '#f87171' }}>{analytics.losingTrades}</span>
            </p>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Total Realized P&L</span>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: analytics.totalPnl >= 0 ? '#4ade80' : '#f87171' }}>
              {analytics.totalPnl >= 0 ? '+' : ''}₹{analytics.totalPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Avg P&L per Trade</span>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: analytics.averagePnl >= 0 ? '#4ade80' : '#f87171' }}>
              {analytics.averagePnl >= 0 ? '+' : ''}₹{analytics.averagePnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </section>

        {/* Trade Review Summary */}
        <JournalReviewSummary entries={entries} analytics={analytics} onSelectEntry={(e) => setSelectedEntry(e)} />

        {/* P&L Performance Chart */}
        <JournalPerformanceChart entries={entries} />

        {/* Filter & Search Bar */}
        <div style={{
          background: '#0f172a',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          borderRadius: '0.75rem',
          padding: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <input
            type="text"
            placeholder="Search Journal by Symbol or Strategy (e.g. RELIANCE, Momentum)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '0.375rem',
              padding: '0.45rem 0.75rem',
              color: '#f8fafc',
              fontSize: '0.8rem',
              outline: 'none',
              minWidth: '240px',
            }}
          />

          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            {(['ALL', 'WIN', 'LOSS', 'OPEN'] as JournalFilterResult[]).map(r => (
              <button
                key={r}
                onClick={() => setResultFilter(r)}
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: '0.25rem',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  background: resultFilter === r ? '#0284c7' : '#1e293b',
                  border: '1px solid #334155',
                  color: resultFilter === r ? '#ffffff' : '#94a3b8',
                }}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Sort:</span>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as JournalSort)}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '0.375rem',
                padding: '0.45rem 0.75rem',
                color: '#f8fafc',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            >
              <option value="DATE">Newest First</option>
              <option value="PNL">Realized P&L</option>
              <option value="QUANTITY">Quantity</option>
              <option value="SYMBOL">Symbol</option>
            </select>
          </div>
        </div>

        {/* Trade History Table or Empty State */}
        {entries.length === 0 ? (
          <div style={{
            padding: '3.5rem 2rem',
            textAlign: 'center',
            background: '#0f172a',
            borderRadius: '0.85rem',
            border: '1px dashed #334155',
            color: '#94a3b8',
          }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>📓</span>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
              No Paper Trades Recorded Yet
            </h3>
            <p style={{ margin: '0.5rem 0 1.25rem 0', fontSize: '0.875rem' }}>
              Your simulated trade history and performance metrics will populate here automatically as paper orders execute.
            </p>
            <button
              type="button"
              onClick={() => navigate(ROUTES.DASHBOARD)}
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: '0.5rem',
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Go to Dashboard & Place Trade
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <TradingJournalTable entries={filteredEntries} onSelectEntry={(entry) => setSelectedEntry(entry)} />
          </div>
        )}
      </main>

      {/* Trade Detail Modal */}
      <JournalTradeDetail
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
        onNavigate={route => navigate(route)}
      />

      {/* Add Journal Entry Modal */}
      {showAddModal && (
        <JournalEntryModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            fetchServerEntries();
            setNotification('Journal entry added successfully!');
            setTimeout(() => setNotification(null), 3000);
          }}
        />
      )}
    </div>
  );
}

