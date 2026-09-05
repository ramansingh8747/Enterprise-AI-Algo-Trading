import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminOrdersApi, AdminOrderFilters, AdminOrderItem } from '@/services/api/adminOrdersApi';
import { useWebSocketContext } from '@/context/WebSocketProvider';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { getMarketSessionStatus } from '@/utils/marketTiming';
import './AdminDashboardPage.css';
import './AdminOrdersPage.css';


const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const formatNumber = (value?: string | null) => {
  if (value == null) return '—';
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString(undefined, { maximumFractionDigits: 4 }) : value;
};

const AdminOrdersPage: React.FC = () => {
  const { state: websocketState, subscribe } = useWebSocketContext();
  const [orders, setOrders] = useState<AdminOrderItem[]>([]);
  const [selected, setSelected] = useState<AdminOrderItem | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AdminOrderFilters>({ page_size: 25 });
  const [draftSearch, setDraftSearch] = useState('');
  const [detailsLoading, setDetailsLoading] = useState(false);

  const loadOrders = useCallback(async (nextPage = page, background = false, nextFilters = filters) => {
    if (background) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const result = await adminOrdersApi.list({ ...nextFilters, page: nextPage });
      setOrders(result.items);
      setPage(result.page);
      setPages(result.pages);
      setTotal(result.total);
    } catch (err: any) {
      setError(err?.message || 'Unable to load admin order data.');
      if (!background) setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void loadOrders(1, false, filters);
    const interval = window.setInterval(() => {
      const session = getMarketSessionStatus();
      if (session.isOpen || session.canExit) {
        void loadOrders(page, true, filters);
      }
    }, 2500);
    return () => window.clearInterval(interval);
  }, [filters, page, loadOrders]);

  useEffect(() => {
    const unsubscribe = subscribe('admin:events', (event) => {
      if (event.event_type.startsWith('order.') || event.event_type === 'execution.created') {
        void loadOrders(page, true, filters);
      }
    });
    return () => unsubscribe();
  }, [subscribe, loadOrders, page, filters]);

  const handleApply = () => {
    const nextFilters = { ...filters, search: draftSearch.trim() || undefined };
    setFilters(nextFilters);
    setPage(1);
    void loadOrders(1, false, nextFilters);
  };

  const handleClear = () => {
    const nextFilters: AdminOrderFilters = { page_size: 25 };
    setDraftSearch('');
    setFilters(nextFilters);
    setPage(1);
    void loadOrders(1, false, nextFilters);
  };

  const openDetails = async (order: AdminOrderItem) => {
    setSelected(order);
    setDetailsLoading(true);
    try {
      const detail = await adminOrdersApi.get(order.order_ref);
      setSelected(detail);
    } catch (err: any) {
      setError(err?.message || 'Unable to load order details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const summary = useMemo(() => ({
    paper: orders.filter((order) => order.execution_mode === 'PAPER').length,
    live: orders.filter((order) => order.execution_mode === 'LIVE').length,
    open: orders.filter((order) => ['OPEN', 'SUBMITTED', 'PARTIAL'].includes(order.status)).length,
    filled: orders.filter((order) => order.status === 'FILLED').length,
  }), [orders]);

  return (
    <div className="admin-control-center">
      <AdminSidebar activeLabel="Orders" />

      <main className="admin-control-center__content">
        <header className="admin-control-center__header">
          <div>
            <p className="admin-control-center__eyebrow">ADMIN CONTROL CENTER</p>
            <h1>Orders</h1>
            <p className="admin-control-center__subtitle">Database-backed cross-account order visibility with PAPER/LIVE isolation and real-time lifecycle refresh.</p>
          </div>
          <button type="button" onClick={() => void loadOrders(page, true, filters)} disabled={refreshing} className="admin-control-center__refresh">
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </header>

        {error && <div className="admin-control-center__alert" role="alert"><strong>Orders unavailable.</strong><span>{error}</span><button type="button" onClick={() => void loadOrders()}>Retry</button></div>}

        <section className="admin-orders__summary" aria-label="Order summary">
          <article><span>Total Results</span><strong>{total}</strong></article>
          <article><span>Open / Pending</span><strong>{summary.open}</strong></article>
          <article><span>Filled</span><strong>{summary.filled}</strong></article>
          <article><span>Paper / Live</span><strong>{summary.paper} / {summary.live}</strong><small>Current page</small></article>
        </section>

        <section className="admin-control-center__panel">
          <div className="admin-orders__filters">
            <label>Search<input value={draftSearch} onChange={(e) => setDraftSearch(e.target.value)} placeholder="Symbol, order ID, user, broker" onKeyDown={(e) => { if (e.key === 'Enter') handleApply(); }} /></label>
            <label>Mode<select value={filters.execution_mode || ''} onChange={(e) => { const next = { ...filters, execution_mode: e.target.value || undefined, page: 1 }; setFilters(next); setPage(1); }}><option value="">All</option><option value="PAPER">PAPER</option><option value="LIVE">LIVE</option></select></label>
            <label>Status<select value={filters.status || ''} onChange={(e) => { const next = { ...filters, status: e.target.value || undefined, page: 1 }; setFilters(next); setPage(1); }}><option value="">All</option><option value="OPEN">OPEN</option><option value="SUBMITTED">SUBMITTED</option><option value="PARTIAL">PARTIAL</option><option value="FILLED">FILLED</option><option value="CANCELLED">CANCELLED</option><option value="REJECTED">REJECTED</option></select></label>
            <label>Side<select value={filters.side || ''} onChange={(e) => { const next = { ...filters, side: e.target.value || undefined, page: 1 }; setFilters(next); setPage(1); }}><option value="">All</option><option value="BUY">BUY</option><option value="SELL">SELL</option></select></label>
            <div className="admin-orders__filter-actions"><button type="button" onClick={handleApply}>Apply</button><button type="button" onClick={handleClear}>Clear</button></div>
          </div>
        </section>

        <section className="admin-control-center__panel" aria-labelledby="admin-orders-heading">
          <div className="admin-control-center__panel-header">
            <div><h2 id="admin-orders-heading">Order Ledger</h2><p>Read-only ADMIN view. No order placement, modification or cancellation is exposed here.</p></div>
            <span className={`admin-orders__ws ${websocketState === 'CONNECTED' ? 'is-good' : 'is-muted'}`}>● {websocketState}</span>
          </div>
          {loading ? (
            <div className="admin-control-center__loading" role="status">Loading orders from the database…</div>
          ) : orders.length === 0 ? (
            <div className="admin-control-center__empty"><strong>No orders found.</strong><span>Try changing the filters or wait for a new trading event.</span></div>
          ) : (
            <div className="admin-orders__table-wrap">
              <table className="admin-orders__table">
                <thead><tr><th>Order</th><th>User</th><th>Symbol</th><th>Side</th><th>Qty / Filled</th><th>Mode</th><th>Status</th><th>Price</th><th>Updated</th><th>Details</th></tr></thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={`${order.source}-${order.order_ref}`}>
                      <td><strong>{order.order_ref.slice(0, 12)}…</strong><small>{order.source === 'PAPER_EXECUTION' ? 'Paper execution' : order.broker_name || 'Broker order'}</small></td>
                      <td><strong>{order.user_name}</strong><small>{order.user_role}</small></td>
                      <td><strong>{order.symbol}</strong><small>{order.order_type || '—'}</small></td>
                      <td><span className={`admin-orders__side ${order.side === 'BUY' ? 'is-buy' : 'is-sell'}`}>{order.side}</span></td>
                      <td>{formatNumber(order.quantity)} / {formatNumber(order.filled_quantity)}</td>
                      <td><span className={`admin-orders__mode ${order.execution_mode === 'LIVE' ? 'is-live' : 'is-paper'}`}>{order.execution_mode}</span></td>
                      <td><span className={`admin-orders__status status-${order.status.toLowerCase()}`}>{order.status}</span></td>
                      <td>{formatNumber(order.average_fill_price || order.price)}</td>
                      <td>{formatDate(order.updated_at)}</td>
                      <td><button type="button" className="admin-orders__details" onClick={() => void openDetails(order)}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="admin-orders__pagination">
            <span>Page {page} of {pages || 1}</span>
            <div><button type="button" disabled={page <= 1 || loading} onClick={() => { const next = page - 1; setPage(next); void loadOrders(next, false, filters); }}>Previous</button><button type="button" disabled={pages === 0 || page >= pages || loading} onClick={() => { const next = page + 1; setPage(next); void loadOrders(next, false, filters); }}>Next</button></div>
          </div>
        </section>
      </main>

      {selected && (
        <div className="admin-orders__modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelected(null); }}>
          <section className="admin-orders__modal" aria-label="Order details">
            <div className="admin-orders__modal-header"><div><p className="admin-control-center__eyebrow">ORDER DETAILS</p><h2>{selected.symbol} · {selected.side}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Close order details">×</button></div>
            {detailsLoading ? <div className="admin-control-center__loading">Loading latest order details…</div> : (
              <div className="admin-orders__detail-grid">
                <div><span>Order Reference</span><strong>{selected.order_ref}</strong></div>
                <div><span>Status</span><strong>{selected.status}</strong></div>
                <div><span>Execution Mode</span><strong>{selected.execution_mode}</strong></div>
                <div><span>User</span><strong>{selected.user_name} · {selected.user_role}</strong></div>
                <div><span>Broker</span><strong>{selected.broker_name || 'Paper / internal'}</strong></div>
                <div><span>Quantity</span><strong>{formatNumber(selected.quantity)}</strong></div>
                <div><span>Filled</span><strong>{formatNumber(selected.filled_quantity)}</strong></div>
                <div><span>Average Fill</span><strong>{formatNumber(selected.average_fill_price)}</strong></div>
                <div><span>Order Type</span><strong>{selected.order_type || '—'}</strong></div>
                <div><span>Product</span><strong>{selected.product || '—'}</strong></div>
                <div><span>Strategy Instance</span><strong>{selected.strategy_instance_id || '—'}</strong></div>
                <div><span>Execution</span><strong>{selected.execution_id || '—'}</strong></div>
                <div><span>Executed At</span><strong>{formatDate(selected.executed_at)}</strong></div>
                <div><span>Last Broker Sync</span><strong>{formatDate(selected.last_synced_at)}</strong></div>
              </div>
            )}
            <div className="admin-orders__safety-note"><strong>Safety:</strong> Admin order view is read-only. LIVE order actions are intentionally not exposed in this step.</div>
          </section>
        </div>
      )}
    </div>
  );
};

export default AdminOrdersPage;
