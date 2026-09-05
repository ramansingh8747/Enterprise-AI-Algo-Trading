import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { riskApi, RiskSettingsResponse, RiskSettingsUpdate, LiveRiskMetricsResponse } from '@/services/api/riskApi';
import { paperPortfolioApi } from '@/services/api/paperPortfolioApi';
import AdminSidebar from '@/components/admin/AdminSidebar';
import './AdminDashboardPage.css';
import './AdminRiskPage.css';


type FormState = Record<keyof RiskSettingsUpdate, string>;

const toForm = (settings: RiskSettingsResponse): FormState => ({
  max_order_quantity: settings.max_order_quantity,
  max_order_notional: settings.max_order_notional,
  max_position_quantity: settings.max_position_quantity,
  max_exposure_notional: settings.max_exposure_notional,
  max_orders_per_minute: String(settings.max_orders_per_minute),
  daily_loss_limit: settings.daily_loss_limit,
  max_drawdown_percent: settings.max_drawdown_percent,
});

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val);
};

const getBarColor = (pct: number) => {
  if (pct >= 90) return 'danger';
  if (pct >= 70) return 'warning';
  return 'safe';
};

const AdminRiskPage: React.FC = () => {
  const [settings, setSettings] = useState<RiskSettingsResponse | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<LiveRiskMetricsResponse | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [pending, setPending] = useState<'ACTIVATE' | 'DEACTIVATE' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'ACTIVATE' | 'DEACTIVATE' | null>(null);

  // Dynamic Paper Portfolio Reset State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetCashAmount, setResetCashAmount] = useState('10000');
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const [settingsRes, liveRes] = await Promise.all([
        riskApi.getSettings(),
        riskApi.getLiveMetrics().catch(() => null),
      ]);
      setSettings(settingsRes);
      setForm((current) => (!isSilent || !current ? toForm(settingsRes) : current));
      if (liveRes) setLiveMetrics(liveRes);
    } catch (err: any) {
      if (!isSilent) setError(err?.message || 'Unable to load risk controls.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(false); }, [load]);

  // 5-second auto-refresh polling loop
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void load(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, load]);

  const updateField = (key: keyof RiskSettingsUpdate, value: string) => {
    setForm((current) => current ? { ...current, [key]: value } : current);
  };

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const payload: RiskSettingsUpdate = {
        max_order_quantity: Number(form.max_order_quantity),
        max_order_notional: Number(form.max_order_notional),
        max_position_quantity: Number(form.max_position_quantity),
        max_exposure_notional: Number(form.max_exposure_notional),
        max_orders_per_minute: Number(form.max_orders_per_minute),
        daily_loss_limit: Number(form.daily_loss_limit),
        max_drawdown_percent: Number(form.max_drawdown_percent),
      };
      if (Object.values(payload).some((value) => !Number.isFinite(value) || value <= 0)) {
        throw new Error('All risk limits must contain valid positive values.');
      }
      if (payload.max_drawdown_percent > 100) {
        throw new Error('Maximum drawdown must be between 0 and 100 percent.');
      }
      const result = await riskApi.updateSettings(payload);
      setSettings(result);
      setForm(toForm(result));
      setFeedback('Risk controls saved successfully. The backend risk engine will use the updated platform limits.');
      void load(true);
    } catch (err: any) {
      setError(err?.message || 'Unable to save risk controls.');
    } finally {
      setSaving(false);
    }
  };

  const confirmKillSwitch = async () => {
    if (!confirmAction) return;
    setPending(confirmAction);
    setConfirmAction(null);
    setError(null);
    setFeedback(null);
    try {
      const result = confirmAction === 'ACTIVATE'
        ? await riskApi.activateKillSwitch()
        : await riskApi.deactivateKillSwitch();
      const latest = await riskApi.getSettings();
      setSettings(latest);
      setForm(toForm(latest));
      setFeedback(result.message || `Kill Switch ${result.status.toLowerCase()}.`);
      void load(true);
    } catch (err: any) {
      setError(err?.message || `Unable to ${confirmAction.toLowerCase()} the Emergency Kill Switch.`);
    } finally {
      setPending(null);
    }
  };

  const handleResetPaperAccount = async () => {
    const amount = Number(resetCashAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Please enter a valid positive cash amount.');
      return;
    }
    setResetting(true);
    setError(null);
    setFeedback(null);
    setShowResetModal(false);
    try {
      await paperPortfolioApi.resetPortfolio('ALL_CONSOLIDATED', amount);
      setFeedback(`Paper account successfully reset to ${formatCurrency(amount)} with 0 open positions! Ready for trading.`);
      await load(false);
    } catch (err: any) {
      setError(err?.message || 'Unable to reset paper portfolio.');
    } finally {
      setResetting(false);
    }
  };

  const killActive = settings?.kill_switch_active ?? false;
  const isBreached = liveMetrics?.risk_status === 'BREACH' || killActive;
  const isWarning = liveMetrics?.risk_status === 'WARNING';

  return (
    <div className="admin-control-center">
      <AdminSidebar activeLabel="Risk" />

      <main className="admin-control-center__content">
        <header className="admin-control-center__header">
          <div>
            <p className="admin-control-center__eyebrow">ADMIN CONTROL CENTER</p>
            <h1>Risk</h1>
            <p className="admin-control-center__subtitle">Platform-wide risk guardrails and emergency execution control.</p>
          </div>
          <div className="admin-risk__header-controls">
            <button
              type="button"
              className="admin-risk__button admin-risk__button--reset"
              onClick={() => setShowResetModal(true)}
              disabled={loading || saving || !!pending || resetting}
              title="Reset Paper Portfolio & Clear Positions"
            >
              🔄 Reset Paper Account
            </button>
            <label className="admin-risk__toggle-label">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span>Live Auto-Refresh (5s)</span>
              {autoRefresh && <span className="admin-risk__pulse-dot" title="Live Auto-Refresh Active" />}
            </label>
            <button type="button" onClick={() => void load(false)} disabled={loading || saving || !!pending || resetting} className="admin-control-center__refresh">
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </header>

        {isBreached && (
          <div className="admin-risk__alert-banner admin-risk__alert-banner--danger" role="alert">
            <span className="admin-risk__alert-icon">🚨</span>
            <div>
              <strong>RISK BREACH DETECTED / TRADING HALTED</strong>
              <p>{killActive ? 'Emergency Kill Switch is ACTIVE. Server-side order execution is blocked.' : 'Live risk utilization has exceeded 90% capacity limit.'}</p>
            </div>
          </div>
        )}

        {isWarning && !isBreached && (
          <div className="admin-risk__alert-banner admin-risk__alert-banner--warning" role="status">
            <span className="admin-risk__alert-icon">⚠️</span>
            <div>
              <strong>HIGH RISK UTILIZATION WARNING</strong>
              <p>Risk capacity has exceeded 70% threshold. Monitor active positions and exposure limits closely.</p>
            </div>
          </div>
        )}

        {feedback && <div className="admin-risk__feedback admin-risk__feedback--success" role="status">✓ {feedback}</div>}
        {error && <div className="admin-control-center__alert" role="alert"><strong>Risk controls unavailable.</strong><span>{error}</span><button type="button" onClick={() => void load(false)}>Retry</button></div>}

        {loading && !settings ? (
          <section className="admin-control-center__panel"><div className="admin-control-center__loading" role="status">Loading platform risk controls from backend…</div></section>
        ) : (
          <>
            <section className={`admin-risk__kill-card ${killActive ? 'is-active' : 'is-safe'}`} aria-labelledby="kill-switch-heading">
              <div>
                <p className="admin-control-center__eyebrow">EMERGENCY CONTROL</p>
                <h2 id="kill-switch-heading">Emergency Kill Switch</h2>
                <p>{killActive ? 'Trading is globally halted. The server-side RiskEngine will reject new order execution until the switch is deactivated.' : 'Trading is operating under configured risk limits. The emergency switch is currently inactive.'}</p>
              </div>
              <div className="admin-risk__kill-status">
                <strong>{killActive ? 'ACTIVE — TRADING HALTED' : 'INACTIVE — NORMAL RISK'}</strong>
                <span>{settings?.updated_at ? `Updated ${new Date(settings.updated_at).toLocaleString()}` : '—'}</span>
                <button type="button" className={killActive ? 'admin-risk__button admin-risk__button--success' : 'admin-risk__button admin-risk__button--danger'} onClick={() => setConfirmAction(killActive ? 'DEACTIVATE' : 'ACTIVATE')} disabled={!!pending}>
                  {pending ? `${pending === 'ACTIVATE' ? 'Activating' : 'Deactivating'}…` : killActive ? 'Deactivate Kill Switch' : 'Activate Kill Switch'}
                </button>
              </div>
            </section>

            {/* Live Risk Capacity & Utilization Dashboard */}
            {liveMetrics && (
              <section className="admin-control-center__panel admin-risk__metrics-panel" aria-labelledby="live-metrics-heading">
                <div className="admin-control-center__panel-header">
                  <div>
                    <h2 id="live-metrics-heading">Live Risk Utilization & Capacity Meters</h2>
                    <p>Real-time calculation of portfolio exposure, daily loss, and order velocity against platform risk limits.</p>
                  </div>
                  <span className="admin-risk__timestamp">Updated {new Date(liveMetrics.timestamp).toLocaleTimeString()}</span>
                </div>

                <div className="admin-risk__meters-grid">
                  {/* Meter 1: Capital Exposure Notional */}
                  <div className="admin-risk__meter-card">
                    <div className="admin-risk__meter-header">
                      <span className="admin-risk__meter-title">Capital Exposure Notional</span>
                      <span className={`admin-risk__meter-pct ${getBarColor(liveMetrics.exposure_utilization_pct)}`}>
                        {liveMetrics.exposure_utilization_pct}% Used
                      </span>
                    </div>
                    <div className="admin-risk__meter-bar-track">
                      <div
                        className={`admin-risk__meter-bar-fill ${getBarColor(liveMetrics.exposure_utilization_pct)}`}
                        style={{ width: `${Math.min(100, liveMetrics.exposure_utilization_pct)}%` }}
                      />
                    </div>
                    <div className="admin-risk__meter-values">
                      <span>Current: <strong>{formatCurrency(liveMetrics.current_exposure_notional)}</strong></span>
                      <span>Max Limit: <strong>{formatCurrency(liveMetrics.max_exposure_notional)}</strong></span>
                    </div>
                  </div>

                  {/* Meter 2: Daily Loss Limit */}
                  <div className="admin-risk__meter-card">
                    <div className="admin-risk__meter-header">
                      <span className="admin-risk__meter-title">Daily Loss Limit Utilization</span>
                      <span className={`admin-risk__meter-pct ${getBarColor(liveMetrics.daily_loss_utilization_pct)}`}>
                        {liveMetrics.daily_loss_utilization_pct}% Used
                      </span>
                    </div>
                    <div className="admin-risk__meter-bar-track">
                      <div
                        className={`admin-risk__meter-bar-fill ${getBarColor(liveMetrics.daily_loss_utilization_pct)}`}
                        style={{ width: `${Math.min(100, liveMetrics.daily_loss_utilization_pct)}%` }}
                      />
                    </div>
                    <div className="admin-risk__meter-values">
                      <span>Today's Loss: <strong>{formatCurrency(liveMetrics.current_daily_loss)}</strong></span>
                      <span>Max Loss Limit: <strong>{formatCurrency(liveMetrics.daily_loss_limit)}</strong></span>
                    </div>
                  </div>

                  {/* Meter 3: Order Velocity */}
                  <div className="admin-risk__meter-card">
                    <div className="admin-risk__meter-header">
                      <span className="admin-risk__meter-title">Order Velocity Rate</span>
                      <span className={`admin-risk__meter-pct ${getBarColor(liveMetrics.order_velocity_pct)}`}>
                        {liveMetrics.order_velocity_pct}% Rate
                      </span>
                    </div>
                    <div className="admin-risk__meter-bar-track">
                      <div
                        className={`admin-risk__meter-bar-fill ${getBarColor(liveMetrics.order_velocity_pct)}`}
                        style={{ width: `${Math.min(100, liveMetrics.order_velocity_pct)}%` }}
                      />
                    </div>
                    <div className="admin-risk__meter-values">
                      <span>Executions: <strong>{liveMetrics.current_orders_last_min} / min</strong></span>
                      <span>Max Rate: <strong>{liveMetrics.max_orders_per_minute} / min</strong></span>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="admin-control-center__panel" aria-labelledby="risk-limits-heading">
              <div className="admin-control-center__panel-header">
                <div><h2 id="risk-limits-heading">Platform Risk Controls</h2><p>These values are persisted in PostgreSQL and enforced by the backend RiskEngine before order dispatch.</p></div>
              </div>
              <form onSubmit={saveSettings} className="admin-risk__form">
                {form && (
                  <>
                    {([
                      ['max_order_quantity', 'Max Order Quantity'],
                      ['max_order_notional', 'Max Order Notional'],
                      ['max_position_quantity', 'Max Position Quantity'],
                      ['max_exposure_notional', 'Max Exposure Notional'],
                      ['max_orders_per_minute', 'Max Orders / Minute'],
                      ['daily_loss_limit', 'Daily Loss Limit'],
                      ['max_drawdown_percent', 'Max Drawdown %'],
                    ] as const).map(([key, label]) => (
                      <label key={key}>{label}<input type="number" min="0.0001" step="any" value={form[key]} onChange={(event) => updateField(key, event.target.value)} disabled={saving || !!pending} required /></label>
                    ))}
                  </>
                )}
                <div className="admin-risk__form-actions"><button type="submit" className="admin-risk__button admin-risk__button--primary" disabled={saving || !!pending}>{saving ? 'Saving…' : 'Save Risk Controls'}</button></div>
              </form>
            </section>

            <section className="admin-risk__status-grid" aria-label="Risk control status">
              <article><span>Kill Switch</span><strong className={killActive ? 'danger' : 'success'}>{killActive ? 'ACTIVE' : 'INACTIVE'}</strong><small>Platform-wide server gate</small></article>
              <article><span>Active Positions</span><strong className="success">{liveMetrics?.active_positions_count ?? 0} Open</strong><small>Live paper holdings count</small></article>
              <article><span>Risk Enforcement</span><strong className="success">SERVER-SIDE</strong><small>Applied before broker dispatch</small></article>
              <article><span>Audit Logging</span><strong className="success">ENABLED</strong><small>Risk actions emit audit/event records</small></article>
            </section>
          </>
        )}

        {confirmAction && (
          <div className="admin-risk__modal-backdrop" role="presentation">
            <div className="admin-risk__modal" role="dialog" aria-modal="true" aria-labelledby="risk-confirm-title">
              <h2 id="risk-confirm-title">{confirmAction === 'ACTIVATE' ? 'Activate Emergency Kill Switch?' : 'Deactivate Emergency Kill Switch?'}</h2>
              <p>{confirmAction === 'ACTIVATE' ? 'This will globally halt automated strategy execution and block new order execution.' : 'This will remove the global emergency halt. Normal server-side risk checks will resume.'}</p>
              <div className="admin-risk__modal-actions">
                <button type="button" onClick={() => setConfirmAction(null)}>Cancel</button>
                <button type="button" className={confirmAction === 'ACTIVATE' ? 'admin-risk__button admin-risk__button--danger' : 'admin-risk__button admin-risk__button--success'} onClick={() => void confirmKillSwitch()}>{confirmAction === 'ACTIVATE' ? 'Confirm Activation' : 'Confirm Deactivation'}</button>
              </div>
            </div>
          </div>
        )}

        {showResetModal && (
          <div
            className="admin-risk__modal-backdrop"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget && !resetting) {
                setShowResetModal(false);
              }
            }}
          >
            <div className="admin-risk__modal" role="dialog" aria-modal="true" aria-labelledby="reset-modal-title">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h2 id="reset-modal-title" style={{ margin: 0 }}>🔄 Reset Paper Trading Account</h2>
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  disabled={resetting}
                  style={{
                    background: 'transparent',
                    border: 0,
                    color: '#94a3b8',
                    fontSize: '18px',
                    cursor: 'pointer',
                    padding: '2px 6px'
                  }}
                  title="Close"
                >
                  ✕
                </button>
              </div>
              <p>This will close all open positions, clear previous test executions, and reset your starting paper cash balance.</p>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Starting Cash Balance (₹)
                </label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  value={resetCashAmount}
                  onChange={(e) => setResetCashAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '6px',
                    background: '#07111f',
                    color: '#f8fafc',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  disabled={resetting}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {['10000', '25000', '50000', '100000'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setResetCashAmount(preset)}
                    disabled={resetting}
                    style={{
                      border: resetCashAmount === preset ? '1px solid #38bdf8' : '1px solid rgba(51, 65, 85, 0.6)',
                      background: resetCashAmount === preset ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                      color: resetCashAmount === preset ? '#38bdf8' : '#cbd5e1',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    ₹{Number(preset).toLocaleString('en-IN')}
                  </button>
                ))}
              </div>

              <div className="admin-risk__modal-actions">
                <button type="button" onClick={() => setShowResetModal(false)} disabled={resetting}>Cancel</button>
                <button
                  type="button"
                  className="admin-risk__button admin-risk__button--primary"
                  onClick={() => void handleResetPaperAccount()}
                  disabled={resetting}
                >
                  {resetting ? 'Resetting…' : `Confirm Reset (₹${Number(resetCashAmount || 0).toLocaleString('en-IN')})`}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminRiskPage;

