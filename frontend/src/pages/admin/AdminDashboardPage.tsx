import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { adminOverviewApi, AdminOverviewResponse } from '@/services/api/adminOverviewApi';
import { adminSystemHealthApi, AdminSystemHealthResponse } from '@/services/api/adminSystemHealthApi';
import { useWebSocketContext } from '@/context/WebSocketProvider';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { getMarketSessionStatus } from '@/utils/marketTiming';
import './AdminDashboardPage.css';


const statusLabel = (status: string) => status === 'UP' ? 'SYSTEM HEALTHY' : status === 'DEGRADED' ? 'SYSTEM DEGRADED' : 'SYSTEM DOWN';

const AdminDashboardPage: React.FC = () => {
  const { state: websocketState } = useWebSocketContext();
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [health, setHealth] = useState<AdminSystemHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);



  const load = useCallback(async (background = false) => {
    background ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [overviewResult, healthResult] = await Promise.all([
        adminOverviewApi.get(),
        adminSystemHealthApi.get(),
      ]);
      setOverview(overviewResult);
      setHealth(healthResult);
    } catch (err: any) {
      setError(err?.message || 'Unable to load the Admin Control Center overview.');
      if (!background) {
        setOverview(null);
        setHealth(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      const session = getMarketSessionStatus();
      if (session.isOpen || session.canExit) {
        void load(true);
      }
    }, 15000);
    return () => window.clearInterval(interval);
  }, [load]);

  if (loading && !overview) {
    return <div className="admin-overview-loading" role="status">Loading Admin Control Center…</div>;
  }

  const metrics = overview?.metrics;

  return (
    <div className="admin-control-center admin-dashboard-page">
      <AdminSidebar activeLabel="Overview" />

      <main className="admin-overview-page">
        <header className="admin-overview-header">
          <div>
            <span className="admin-eyebrow">ENTERPRISE OPERATIONS</span>
            <h1>Admin Control Center</h1>
            <p>Database-backed operational overview for users, brokers, risk, orders, positions, portfolio, reconciliation, LIVE Gate and audit.</p>
          </div>
          <button type="button" className="admin-refresh-button" onClick={() => void load(true)} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </header>

        {error && <div className="admin-alert" role="alert"><strong>Overview unavailable.</strong><span>{error}</span><button type="button" onClick={() => void load()}>Retry</button></div>}

        {overview && (
          <>
            <section className="admin-status-strip" aria-label="System status">
              <div><span className="admin-section-label">SYSTEM STATUS</span><strong className={`admin-overall-status ${overview.overall_status.toLowerCase()}`}>{statusLabel(overview.overall_status)}</strong></div>
              <div className="admin-mode-grid">
                <span className="admin-mode-pill">LIVE TRADING <b>{overview.live_trading_enabled ? 'ON' : 'OFF'}</b></span>
                <span className="admin-mode-pill">SCHEDULER <b>{overview.strategy_scheduler_enabled ? 'ON' : 'OFF'}</b></span>
                <span className={`admin-mode-pill ${overview.metrics.kill_switch_active ? 'danger' : ''}`}>KILL SWITCH <b>{overview.metrics.kill_switch_active ? 'ACTIVE' : 'INACTIVE'}</b></span>
                <span className="admin-mode-pill">WEBSOCKET <b>{websocketState}</b></span>
              </div>
            </section>

            <section className="admin-metric-grid" aria-label="Operational metrics">
              {[
                ['Users', metrics?.total_users, `${metrics?.active_users ?? 0} active`],
                ['Brokers', metrics?.total_brokers, `${metrics?.connected_brokers ?? 0} connected`],
                ['Orders', metrics?.total_orders, `${metrics?.open_orders ?? 0} open · ${metrics?.today_orders ?? 0} today`],
                ['Strategies', metrics?.total_strategies, `${metrics?.running_strategies ?? 0} running`],
                ['PAPER Portfolios', metrics?.paper_portfolios, `${metrics?.open_paper_positions ?? 0} open positions`],
                ['PAPER Realized P&L', metrics?.paper_realized_pnl, 'persisted accounting'],
                ['PAPER Unrealized P&L', metrics?.paper_unrealized_pnl, 'persisted valuation'],
                ['Admin Users', metrics?.admin_users, 'server-side RBAC'],
                ['Active Brokers', metrics?.active_brokers, 'configuration enabled'],
              ].map(([label, value, note]) => (
                <article className="admin-metric-card" key={String(label)}><span>{label}</span><strong>{value ?? '—'}</strong><span>{note}</span></article>
              ))}
            </section>

            <section className="admin-content-grid">
              <article className="admin-panel">
                <div className="admin-panel-heading"><div><span className="admin-section-label">INFRASTRUCTURE</span><h2>System Health</h2></div><Link to={ROUTES.ADMIN_REALTIME_MONITOR}>Real-Time Monitor →</Link></div>
                <div className="health-list">
                  {(health?.components || []).map((component) => <div className="health-row" key={component.name}><div><strong>{component.name}</strong><span>{component.message}</span></div><span className={`health-badge ${component.status.toLowerCase()}`}>● {component.status}</span></div>)}
                  {(health?.brokers || []).map((broker) => <div className="health-row" key={broker.broker_id}><div><strong>{broker.broker_name}</strong><span>{broker.broker_type} · {broker.message}</span></div><span className={`health-badge ${broker.status.toLowerCase()}`}>● {broker.status}</span></div>)}
                </div>
              </article>

              <article className="admin-panel">
                <div className="admin-panel-heading"><div><span className="admin-section-label">CONTROL CENTER</span><h2>Operations</h2></div></div>
                <div className="admin-shortcuts">
                  {[
                    ['Users', 'Manage user visibility and RBAC status.', ROUTES.ADMIN_USERS],
                    ['Strategies', 'Inspect and manage all persisted strategy definitions.', ROUTES.ADMIN_STRATEGIES],
                    ['Brokers', 'Inspect broker configuration and sessions.', ROUTES.ADMIN_BROKERS],
                    ['Risk', 'Manage server-side risk limits and kill switch.', ROUTES.ADMIN_RISK],
                    ['Orders', 'Inspect persisted order lifecycle.', ROUTES.ADMIN_ORDERS],
                    ['Positions', 'Inspect PAPER/LIVE positions.', ROUTES.ADMIN_POSITIONS],
                    ['Portfolio', 'Inspect persisted valuation and P&L.', ROUTES.ADMIN_PORTFOLIO],
                    ['Reconcile', 'Compare internal and broker state.', ROUTES.ADMIN_RECONCILIATION],
                    ['LIVE Gate', 'Evaluate controlled LIVE readiness.', ROUTES.ADMIN_LIVE_GATE],
                    ['Audit', 'Review immutable operational audit events.', ROUTES.ADMIN_AUDIT],
                  ].map(([label, note, to]) => <Link key={label} to={to} className="admin-shortcut"><strong>{label}</strong><span>{note}</span><span className="admin-shortcut-arrow">→</span></Link>)}
                </div>
              </article>
            </section>

            <div className="admin-footer-meta"><span>Snapshot: {new Date(overview.generated_at).toLocaleString()}</span><span>LIVE execution: server-side OFF</span></div>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminDashboardPage;
