import React, { useCallback, useEffect, useState } from 'react';
import { adminPositionsApi, AdminPositionFilters, AdminPositionItem } from '@/services/api/adminPositionsApi';
import { useWebSocketContext } from '@/context/WebSocketProvider';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { getMarketSessionStatus } from '@/utils/marketTiming';
import './AdminDashboardPage.css';
import './AdminPositionsPage.css';


const money = (value?: string | null) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n) : '—';
};
const number = (value?: string | null) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toLocaleString('en-IN', { maximumFractionDigits: 4 }) : value ?? '—';
};
const date = (value?: string | null) => value ? new Date(value).toLocaleString() : '—';

const AdminPositionsPage: React.FC = () => {
  const { state: websocketState, subscribe } = useWebSocketContext();
  const [items, setItems] = useState<AdminPositionItem[]>([]);
  const [selected, setSelected] = useState<AdminPositionItem | null>(null);
  const [filters, setFilters] = useState<AdminPositionFilters>({ page_size: 25 });
  const [draftSearch, setDraftSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<AdminPositionFilters & { total_positions?: number; paper_positions?: number; live_positions?: number; total_market_value?: string; realized_pnl?: string; unrealized_pnl?: string }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const load = useCallback(async (nextPage = page, background = false, nextFilters = filters) => {
    background ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const result = await adminPositionsApi.list({ ...nextFilters, page: nextPage });
      setItems(result.items);
      setPage(result.page);
      setPages(result.pages);
      setTotal(result.total);
      setSummary(result.summary);
    } catch (err: any) {
      setError(err?.message || 'Unable to load admin positions.');
      if (!background) setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void load(1, false, filters);
    const interval = window.setInterval(() => {
      const session = getMarketSessionStatus();
      if (session.isOpen || session.canExit) {
        void load(page, true, filters);
      }
    }, 15000);
    return () => window.clearInterval(interval);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unsubscribe = subscribe('admin:events', (event) => {
      if (event.event_type === 'position.updated' || event.event_type === 'portfolio.valuation.updated' || event.event_type === 'execution.created') {
        void load(page, true, filters);
      }
    });
    return () => unsubscribe();
  }, [subscribe, load, page, filters]);

  const apply = () => {
    const next = { ...filters, search: draftSearch.trim() || undefined };
    setFilters(next);
    setPage(1);
    void load(1, false, next);
  };
  const clear = () => {
    const next: AdminPositionFilters = { page_size: 25 };
    setDraftSearch(''); setFilters(next); setPage(1); void load(1, false, next);
  };
  const openDetails = async (item: AdminPositionItem) => {
    setSelected(item); setDetailsLoading(true);
    try { setSelected(await adminPositionsApi.get(item.position_ref, item.source)); }
    catch { /* keep list snapshot visible if details request fails */ }
    finally { setDetailsLoading(false); }
  };

  return (
    <div className="admin-control-center">
      <AdminSidebar activeLabel="Positions" />

      <main className="admin-control-center__content">
        <header className="admin-control-center__header">
          <div><p className="admin-control-center__eyebrow">ADMIN CONTROL CENTER</p><h1>Positions</h1><p className="admin-control-center__subtitle">Database-backed PAPER and LIVE positions with persisted valuation and P&amp;L.</p></div>
          <button type="button" onClick={() => void load(page, true)} disabled={refreshing} className="admin-control-center__refresh">{refreshing ? 'Refreshing…' : 'Refresh'}</button>
        </header>

        {error && <div className="admin-control-center__alert" role="alert"><strong>Positions unavailable.</strong><span>{error}</span><button type="button" onClick={() => void load(page)}>Retry</button></div>}

        <section className="admin-positions__summary">
          <article><span>Total Positions</span><strong>{summary.total_positions ?? 0}</strong><small>{summary.paper_positions ?? 0} PAPER · {summary.live_positions ?? 0} LIVE</small></article>
          <article><span>Market Value</span><strong>{money(summary.total_market_value)}</strong><small>Persisted valuation</small></article>
          <article><span>Realized P&amp;L</span><strong className={Number(summary.realized_pnl ?? 0) >= 0 ? 'is-profit' : 'is-loss'}>{money(summary.realized_pnl)}</strong><small>Persisted accounting</small></article>
          <article><span>Unrealized P&amp;L</span><strong className={Number(summary.unrealized_pnl ?? 0) >= 0 ? 'is-profit' : 'is-loss'}>{money(summary.unrealized_pnl)}</strong><small>Last persisted valuation</small></article>
        </section>

        <section className="admin-control-center__panel">
          <div className="admin-control-center__panel-header"><div><h2>Position Inventory</h2><p>Source of truth is PostgreSQL. No browser-local position state is used.</p></div><span className={`admin-positions__ws ${websocketState === 'CONNECTED' ? 'is-good' : 'is-muted'}`}>● {websocketState}</span></div>
          <div className="admin-positions__filters">
            <label>Search<input value={draftSearch} onChange={e => setDraftSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') apply(); }} placeholder="Symbol / user / broker / strategy" /></label>
            <label>Mode<select value={filters.execution_mode ?? ''} onChange={e => setFilters({ ...filters, execution_mode: e.target.value || undefined })}><option value="">All</option><option value="PAPER">PAPER</option><option value="LIVE">LIVE</option></select></label>
            <div className="admin-positions__filter-actions"><button type="button" onClick={apply}>Apply</button><button type="button" onClick={clear}>Clear</button></div>
          </div>

          {loading ? <div className="admin-control-center__loading" role="status">Loading persisted positions…</div> : items.length === 0 ? <div className="admin-control-center__empty">No open positions match the selected filters.</div> : (
            <div className="admin-positions__table-wrap"><table className="admin-positions__table"><thead><tr><th>Symbol</th><th>User</th><th>Mode</th><th>Broker</th><th>Strategy</th><th>Qty</th><th>Avg Price</th><th>Last Price</th><th>Market Value</th><th>P&amp;L</th><th>Updated</th><th /></tr></thead>
              <tbody>{items.map(item => { const pnl = Number(item.realized_pnl) + Number(item.unrealized_pnl); return <tr key={`${item.source}:${item.position_ref}`}><td><strong>{item.symbol}</strong><small>{item.source}</small></td><td><strong>{item.user_name}</strong><small>{item.user_role}</small></td><td><span className={`admin-positions__mode ${item.execution_mode === 'LIVE' ? 'is-live' : 'is-paper'}`}>{item.execution_mode}</span></td><td>{item.broker_name || '—'}</td><td>{item.strategy_name || 'Manual / Default'}</td><td>{number(item.quantity)}</td><td>{money(item.average_price)}</td><td>{money(item.last_price)}</td><td>{money(item.market_value)}</td><td className={pnl >= 0 ? 'is-profit' : 'is-loss'}>{money(String(pnl))}</td><td>{date(item.updated_at)}</td><td><button className="admin-positions__details" type="button" onClick={() => void openDetails(item)}>View</button></td></tr>; })}</tbody>
            </table></div>
          )}
          <div className="admin-positions__pagination"><span>Showing {items.length ? ((page - 1) * 25) + 1 : 0}–{Math.min(page * 25, total)} of {total}</span><div><button type="button" disabled={page <= 1 || loading} onClick={() => void load(page - 1, false)}>Previous</button><button type="button" disabled={page >= pages || loading} onClick={() => void load(page + 1, false)}>Next</button></div></div>
        </section>
      </main>

      {selected && <div className="admin-positions__modal-backdrop" role="presentation" onClick={() => setSelected(null)}><section className="admin-positions__modal" role="dialog" aria-modal="true" aria-labelledby="position-details-title" onClick={e => e.stopPropagation()}><div className="admin-positions__modal-header"><div><p className="admin-control-center__eyebrow">POSITION DETAILS</p><h2 id="position-details-title">{selected.symbol} · {selected.execution_mode}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Close">×</button></div>{detailsLoading ? <div className="admin-control-center__loading">Loading details…</div> : <div className="admin-positions__detail-grid"><div><span>User</span><strong>{selected.user_name}</strong></div><div><span>Role</span><strong>{selected.user_role}</strong></div><div><span>Broker</span><strong>{selected.broker_name || '—'}</strong></div><div><span>Strategy</span><strong>{selected.strategy_name || 'Manual / Default'}</strong></div><div><span>Quantity</span><strong>{number(selected.quantity)}</strong></div><div><span>Average Price</span><strong>{money(selected.average_price)}</strong></div><div><span>Last Price</span><strong>{money(selected.last_price)}</strong></div><div><span>Market Value</span><strong>{money(selected.market_value)}</strong></div><div><span>Realized P&amp;L</span><strong className={Number(selected.realized_pnl) >= 0 ? 'is-profit' : 'is-loss'}>{money(selected.realized_pnl)}</strong></div><div><span>Unrealized P&amp;L</span><strong className={Number(selected.unrealized_pnl) >= 0 ? 'is-profit' : 'is-loss'}>{money(selected.unrealized_pnl)}</strong></div><div><span>Valuation At</span><strong>{date(selected.valuation_at)}</strong></div><div><span>Updated</span><strong>{date(selected.updated_at)}</strong></div></div>}<div className="admin-positions__safety"><strong>Safety:</strong> This screen is read-only. No position, order, broker or LIVE action is exposed here.</div></section></div>}
    </div>
  );
};

export default AdminPositionsPage;
