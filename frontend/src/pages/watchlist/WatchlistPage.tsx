import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { MarketIndexCard } from '@/components/dashboard/MarketIndexCard';
import { WatchlistEquityRow } from '@/components/dashboard/WatchlistEquityRow';
import { MarketChartWidget } from '@/components/dashboard/MarketChartWidget';
import { OrderForm, PaperOrder } from '@/components/dashboard/OrderForm';
import { Equity, MarketIndex } from '@/types/market';
import { initialEquities, initialIndices } from '@/data/marketData';
import { createTradingSignal } from '@/services/signals/signalService';
import { getWatchlistSymbols } from '@/services/paperTrading/watchlistWorkspaceService';
import { watchlistApi, ServerWatchlist } from '@/services/api/watchlistApi';
import { marketApi } from '@/services/api/marketApi';
import { WatchlistFilter, WatchlistSort } from '@/types/watchlistWorkspace';
import { getMarketSessionStatus } from '@/utils/marketTiming';

export default function WatchlistPage() {
  const navigate = useNavigate();
  const [selectedSymbol, setSelectedSymbolState] = useState<string>(() => {
    try {
      return localStorage.getItem('watchlist_selected_symbol') || 'NIFTY50';
    } catch {
      return 'NIFTY50';
    }
  });

  const setSelectedSymbol = (sym: string) => {
    setSelectedSymbolState(sym);
    try {
      localStorage.setItem('watchlist_selected_symbol', sym);
    } catch {}
  };
  const [liveIndices, setLiveIndices] = useState<MarketIndex[]>(initialIndices);
  const [watchlists, setWatchlists] = useState<ServerWatchlist[]>([]);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(null);
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<WatchlistFilter>('ALL');
  const [sort, setSort] = useState<WatchlistSort>('SYMBOL');
  const [onlyWatchlist, setOnlyWatchlist] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [tradeRequest, setTradeRequest] = useState<{
    equity: Equity;
    side: 'BUY' | 'SELL';
  } | null>(null);

  const [notification, setNotification] = useState<string | null>(null);

  // Load server watchlists
  const loadServerWatchlists = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const serverList = await watchlistApi.getWatchlists();
      setWatchlists(serverList);

      const defaultWl = serverList.find(w => w.is_default) || serverList[0];
      if (defaultWl) {
        setActiveWatchlistId(defaultWl.id);
        const serverSyms = defaultWl.items.map(i => i.symbol);
        
        // One-time migration of local storage symbols if any exist
        const localSyms = getWatchlistSymbols();
        const missingLocal = localSyms.filter(s => !serverSyms.includes(s));
        if (missingLocal.length > 0) {
          for (const sym of missingLocal) {
            try {
              await watchlistApi.addItem(defaultWl.id, sym);
              serverSyms.push(sym);
            } catch (_err) {
              // Ignore duplicate/invalid migration errors
            }
          }
        }
        setWatchlistSymbols(serverSyms);
      }
    } catch (err: any) {
      if (err.status !== 401 && err.statusCode !== 401) {
        setErrorMsg(err.message || 'Failed to load watchlists from server');
      }
      // Fallback to local symbols if unauthenticated or offline
      setWatchlistSymbols(getWatchlistSymbols());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServerWatchlists();
    const interval = setInterval(() => {
      const session = getMarketSessionStatus();
      if (session.isOpen || session.canExit) {
        loadServerWatchlists();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [loadServerWatchlists]);

  // Real-time live benchmark indices stream (NIFTY 50, BANK NIFTY, SENSEX)
  useEffect(() => {
    let isMounted = true;
    const fetchLiveIndices = async () => {
      try {
        const data = await marketApi.getLiveIndices();
        if (isMounted && data && Array.isArray(data) && data.length > 0) {
          setLiveIndices(data);
        }
      } catch (err) {
        console.warn('Live indices fetch note:', err);
      }
    };
    fetchLiveIndices();
    const interval = setInterval(() => {
      const session = getMarketSessionStatus();
      if (session.isOpen || session.canExit) {
        fetchLiveIndices();
      }
    }, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Handle active watchlist change
  const handleSelectWatchlist = (wlId: string) => {
    setActiveWatchlistId(wlId);
    const target = watchlists.find(w => w.id === wlId);
    if (target) {
      setWatchlistSymbols(target.items.map(i => i.symbol));
    }
  };

  // Create new watchlist
  const handleCreateWatchlist = async () => {
    if (!newWatchlistName.trim()) return;
    try {
      const created = await watchlistApi.createWatchlist({ name: newWatchlistName.trim() });
      setWatchlists(prev => [...prev, created]);
      setActiveWatchlistId(created.id);
      setWatchlistSymbols([]);
      setNewWatchlistName('');
      setShowCreateModal(false);
      setNotification(`Watchlist "${created.name}" created!`);
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create watchlist');
    }
  };

  // Map equities to signals
  const equitiesWithSignals = useMemo(() => {
    return initialEquities.map(eq => ({
      equity: eq,
      signal: createTradingSignal(eq),
      inWatchlist: watchlistSymbols.includes(eq.symbol),
    }));
  }, [watchlistSymbols]);

  // Filter & Search Logic
  const filteredEquities = useMemo(() => {
    return equitiesWithSignals.filter(item => {
      if (onlyWatchlist && !item.inWatchlist) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSymbol = item.equity.symbol.toLowerCase().includes(q);
        const matchesName = item.equity.name.toLowerCase().includes(q);
        if (!matchesSymbol && !matchesName) return false;
      }

      if (filter === 'GAINERS') return item.equity.change > 0;
      if (filter === 'LOSERS') return item.equity.change < 0;
      if (filter === 'BUY') return item.signal.action === 'BUY';
      if (filter === 'SELL') return item.signal.action === 'SELL';
      if (filter === 'HOLD') return item.signal.action === 'HOLD';

      return true;
    }).sort((a, b) => {
      if (sort === 'PRICE') return b.equity.price - a.equity.price;
      if (sort === 'CHANGE') return b.equity.changePercent - a.equity.changePercent;
      if (sort === 'STRENGTH') return b.signal.strength - a.signal.strength;
      return a.equity.symbol.localeCompare(b.equity.symbol);
    });
  }, [equitiesWithSignals, onlyWatchlist, searchQuery, filter, sort]);

  // KPI Summary
  const summary = useMemo(() => {
    const totalCount = initialEquities.length;
    const gainersCount = initialEquities.filter(e => e.change > 0).length;
    const losersCount = initialEquities.filter(e => e.change < 0).length;
    const neutralCount = totalCount - gainersCount - losersCount;
    const signalCount = equitiesWithSignals.filter(e => e.signal.action !== 'HOLD').length;
    return { totalCount, gainersCount, losersCount, neutralCount, signalCount };
  }, [equitiesWithSignals]);

  const handleToggleWatchlist = async (equity: Equity) => {
    const isCurrentlyIn = watchlistSymbols.includes(equity.symbol);

    if (isCurrentlyIn) {
      // Optimistic update
      setWatchlistSymbols(prev => prev.filter(s => s !== equity.symbol));
      setNotification(`Removed ${equity.symbol} from watchlist.`);
      setTimeout(() => setNotification(null), 3000);

      if (activeWatchlistId) {
        try {
          await watchlistApi.removeItem(activeWatchlistId, equity.symbol);
        } catch (_err) {
          // Revert if error
          setWatchlistSymbols(prev => [...prev, equity.symbol]);
        }
      }
    } else {
      // Optimistic update
      setWatchlistSymbols(prev => [equity.symbol, ...prev]);
      setNotification(`Added ${equity.symbol} to watchlist.`);
      setTimeout(() => setNotification(null), 3000);

      if (activeWatchlistId) {
        try {
          await watchlistApi.addItem(activeWatchlistId, equity.symbol);
        } catch (err: any) {
          if (err.status === 409 || err.message?.includes('already exists')) {
            // Keep symbol if it already existed on server
            return;
          }
          // Revert if error
          setWatchlistSymbols(prev => prev.filter(s => s !== equity.symbol));
          setErrorMsg(err.message || `Failed to add ${equity.symbol}`);
        }
      }
    }
  };

  const marketSession = useMemo(() => getMarketSessionStatus(), []);

  const handleTrade = (equity: Equity, side: 'BUY' | 'SELL') => {
    const currentSession = getMarketSessionStatus();
    if (!currentSession.isOpen && side === 'BUY') {
      setErrorMsg(`🚫 Trading Blocked: Market is currently closed (${currentSession.statusText}). NSE trading hours are Monday to Friday 09:15 AM to 03:15 PM IST.`);
      setTimeout(() => setErrorMsg(null), 6000);
      return;
    }
    if (!currentSession.canExit && side === 'SELL') {
      setErrorMsg(`🚫 Trading Blocked: Market is closed (${currentSession.statusText}). Position exits are permitted during active market hours only.`);
      setTimeout(() => setErrorMsg(null), 6000);
      return;
    }
    setTradeRequest({ equity, side });
  };

  const isFiltered = Boolean(searchQuery.trim()) || filter !== 'ALL' || sort !== 'SYMBOL' || onlyWatchlist;

  const handleResetFilters = () => {
    setSearchQuery('');
    setFilter('ALL');
    setSort('SYMBOL');
    setOnlyWatchlist(false);
    setNotification('Watchlist filters and search reset to default.');
    setTimeout(() => setNotification(null), 2500);
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

      {/* Error / Validation Notification Banner */}
      {errorMsg && (
        <div style={{
          position: 'fixed',
          top: '1.25rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          background: 'rgba(239, 68, 68, 0.95)',
          border: '1px solid #f87171',
          borderRadius: '0.5rem',
          padding: '0.85rem 1.5rem',
          color: '#ffffff',
          fontSize: '0.875rem',
          fontWeight: 700,
          boxShadow: '0 10px 25px -3px rgba(239, 68, 68, 0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}>
          <span>⚠️ {errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontWeight: 800, fontSize: '1rem' }}
          >
            ✕
          </button>
        </div>
      )}

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.85rem', fontWeight: 900, color: '#f8fafc' }}>
                Market Workspace
              </h1>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '0.2rem 0.65rem',
                borderRadius: '1rem',
              }}>
                PAPER MARKET DATA
              </span>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: marketSession.isOpen ? '#4ade80' : '#f87171',
                background: marketSession.isOpen ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${marketSession.isOpen ? 'rgba(74, 222, 128, 0.35)' : 'rgba(248, 113, 113, 0.35)'}`,
                padding: '0.2rem 0.65rem',
                borderRadius: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}>
                <span>{marketSession.isOpen ? '🟢' : '🔴'}</span>
                <span>{marketSession.statusText}</span>
              </span>
              {loading && (
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8' }}>
                  Syncing...
                </span>
              )}
            </div>

            <p style={{ margin: '0.5rem 0 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>
              Track Indian market indices, evaluate algorithmic strategy signals, and execute paper trades.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {watchlists.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Active Watchlist:</span>
                <select
                  value={activeWatchlistId || ''}
                  onChange={e => handleSelectWatchlist(e.target.value)}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    outline: 'none',
                  }}
                >
                  {watchlists.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.is_default ? '(Default)' : ''} ({w.items.length} items)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.8125rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              + Create Watchlist
            </button>
          </div>
        </div>


        {errorMsg && (
          <div style={{ padding: '0.65rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
            ⚠️ {errorMsg}
          </div>
        )}


        {/* Top Section: Market Index Overview */}
        <section>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#94a3b8', margin: '0 0 0.85rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Benchmark Market Indices
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {liveIndices.map((idx: MarketIndex) => (
              <div
                key={idx.name}
                onClick={() => setSelectedSymbol(idx.symbol)}
                style={{
                  cursor: 'pointer',
                  borderRadius: '0.75rem',
                  border: selectedSymbol === idx.symbol ? '2px solid #38bdf8' : '2px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <MarketIndexCard index={idx} />
              </div>
            ))}
          </div>
        </section>

        {/* Live Interactive Market Candlestick & Technical Indicator Chart */}
        <section>
          <MarketChartWidget
            selectedSymbol={selectedSymbol}
            allEquities={initialEquities}
            allIndices={liveIndices}
            onSelectSymbol={setSelectedSymbol}
            onTrade={handleTrade}
          />
        </section>

        {/* Watchlist KPI Summary Cards */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem 1.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Total Tracked</span>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8' }}>{summary.totalCount}</p>
          </div>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem 1.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Gainers</span>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#4ade80' }}>{summary.gainersCount}</p>
          </div>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem 1.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Losers</span>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#f87171' }}>{summary.losersCount}</p>
          </div>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem 1.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Active Signals</span>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#a78bfa' }}>{summary.signalCount}</p>
          </div>
        </section>

        {/* Filter Bar & Workspace Search */}
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
          {/* Search Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '240px', position: 'relative' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search equities by symbol or name..."
              style={{
                width: '100%',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
                padding: searchQuery ? '0.55rem 2.2rem 0.55rem 0.85rem' : '0.55rem 0.85rem',
                color: '#f8fafc',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                title="Clear search"
                style={{
                  position: 'absolute',
                  right: '0.65rem',
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  padding: '0.2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setOnlyWatchlist(prev => !prev)}
              style={{
                padding: '0.45rem 0.75rem',
                borderRadius: '0.375rem',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
                background: onlyWatchlist ? 'rgba(251, 191, 36, 0.2)' : '#1e293b',
                border: onlyWatchlist ? '1px solid #fbbf24' : '1px solid #334155',
                color: onlyWatchlist ? '#fbbf24' : '#94a3b8',
              }}
            >
              ★ Starred Only
            </button>
            {(['ALL', 'GAINERS', 'LOSERS', 'BUY', 'SELL'] as WatchlistFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: '0.375rem',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  background: filter === f ? '#0284c7' : '#1e293b',
                  border: filter === f ? '1px solid #38bdf8' : '1px solid #334155',
                  color: filter === f ? '#ffffff' : '#94a3b8',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Sort Dropdown & Reset Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Sort:</span>
              <select
                value={sort}
                onChange={e => setSort(e.target.value as WatchlistSort)}
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
                <option value="SYMBOL">Symbol</option>
                <option value="PRICE">Price (High to Low)</option>
                <option value="CHANGE">Change %</option>
                <option value="STRENGTH">Signal Strength</option>
              </select>
            </div>

            {/* Reset Button */}
            <button
              type="button"
              onClick={handleResetFilters}
              title="Reset all search, filters, and sorting to default"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '0.375rem',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
                background: isFiltered ? 'rgba(239, 68, 68, 0.18)' : '#1e293b',
                border: isFiltered ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid #334155',
                color: isFiltered ? '#fca5a5' : '#94a3b8',
                transition: 'all 0.15s ease',
              }}
            >
              <span>🔄</span>
              <span>Reset</span>
              {isFiltered && (
                <span style={{
                  fontSize: '0.65rem',
                  padding: '0.1rem 0.35rem',
                  borderRadius: '0.25rem',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 800,
                  marginLeft: '0.25rem',
                }}>
                  Active
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Equity Workspace List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {filteredEquities.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', background: '#0f172a', borderRadius: '0.75rem', border: '1px dashed #334155' }}>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#94a3b8' }}>No equities match your current search or filter criteria.</p>
              <button
                onClick={handleResetFilters}
                style={{ marginTop: '0.85rem', padding: '0.45rem 1rem', background: '#0284c7', border: 'none', borderRadius: '0.375rem', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}
              >
                🔄 Reset Filters
              </button>
            </div>
          ) : (
            filteredEquities.map(({ equity, signal, inWatchlist }) => (
              <div
                key={equity.symbol}
                onClick={() => setSelectedSymbol(equity.symbol)}
                style={{
                  cursor: 'pointer',
                  borderRadius: '0.75rem',
                  outline: selectedSymbol === equity.symbol ? '2px solid #38bdf8' : 'none',
                  outlineOffset: '2px',
                }}
              >
                <WatchlistEquityRow
                  equity={equity}
                  signal={signal}
                  isInWatchlist={inWatchlist}
                  onToggleWatchlist={handleToggleWatchlist}
                  onTrade={(eq, side) => {
                    setSelectedSymbol(eq.symbol);
                    handleTrade(eq, side);
                  }}
                  onViewStrategy={_symbol => navigate(ROUTES.STRATEGY)}
                />
              </div>
            ))
          )}
        </div>
      </main>

      {/* Render OrderForm modal when tradeRequest is active (Paper default, Live gated) */}
      {tradeRequest && (
        <OrderForm
          initialSymbol={tradeRequest.equity.symbol}
          initialSide={tradeRequest.side}
          initialPrice={tradeRequest.equity.price}
          onClose={() => setTradeRequest(null)}
          onPaperOrderCreated={(order: PaperOrder) => {
            setNotification(`Paper ${order.side} order placed for ${order.symbol} @ ₹${order.price}`);
            setTradeRequest(null);
            setTimeout(() => setNotification(null), 4000);
          }}
          onLiveOrderCreated={(liveOrder) => {
            setNotification(`Live order submitted: ${liveOrder.order_id}`);
            setTradeRequest(null);
            setTimeout(() => setNotification(null), 4000);
          }}
        />
      )}

      {/* Render Create Watchlist Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '0.75rem',
            width: '100%',
            maxWidth: '420px',
            padding: '1.5rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
              📁 Create New Watchlist
            </h3>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.4rem' }}>
              Watchlist Name
            </label>
            <input
              type="text"
              value={newWatchlistName}
              onChange={e => setNewWatchlistName(e.target.value)}
              placeholder="e.g. IT Sector, High Volatility"
              style={{
                width: '100%',
                padding: '0.55rem 0.85rem',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '0.375rem',
                color: '#ffffff',
                fontSize: '0.875rem',
                outline: 'none',
                marginBottom: '1.25rem',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  background: '#334155',
                  border: 'none',
                  color: '#cbd5e1',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateWatchlist}
                style={{
                  padding: '0.5rem 1.15rem',
                  borderRadius: '0.375rem',
                  background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

