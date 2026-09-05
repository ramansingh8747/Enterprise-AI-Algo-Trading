import React, { useCallback, useEffect, useState } from 'react';
import { frozenPaperTradingApi } from '@/services/api/frozenPaperTradingApi';
import {
  FrozenStrategyConfig,
  FrozenPaperSessionState,
  FrozenPaperTradeAudit,
} from '@/types/frozenPaperTrading';

export default function FrozenStrategyPaperTradingDashboard() {
  const [config, setConfig] = useState<FrozenStrategyConfig | null>(null);
  const [session, setSession] = useState<FrozenPaperSessionState | null>(null);
  const [trades, setTrades] = useState<FrozenPaperTradeAudit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [streaming, setStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [feedCandleCount, setFeedCandleCount] = useState<number>(80);

  const versionId = 'COALINDIA_WFA_FROZEN_v1';

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [cfg, sess, trd] = await Promise.all([
        frozenPaperTradingApi.getConfig(versionId),
        frozenPaperTradingApi.getSessionState(versionId),
        frozenPaperTradingApi.getTradeAuditLog(versionId),
      ]);
      setConfig(cfg);
      setSession(sess);
      setTrades(trd);
    } catch (err: any) {
      console.error('Failed to load frozen paper trading session:', err);
      setError(err?.message || 'Failed to connect to backend paper engine.');
    } finally {
      setLoading(false);
    }
  }, [versionId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSimulateFeed = async () => {
    try {
      setStreaming(true);
      setError(null);
      const updatedSess = await frozenPaperTradingApi.simulateFeed(versionId, {
        candle_count: feedCandleCount,
        seed: Math.floor(Math.random() * 10000) + 1,
        base_volatility_pct: 1.3,
        drift_pct: 0.15,
      });
      const updatedTrades = await frozenPaperTradingApi.getTradeAuditLog(versionId);
      setSession(updatedSess);
      setTrades(updatedTrades);
    } catch (err: any) {
      setError(err?.message || 'Failed to simulate feed.');
    } finally {
      setStreaming(false);
    }
  };

  const handleSingleStep = async () => {
    if (!config) return;
    try {
      setStreaming(true);
      const base = Number(config.buy_threshold) || 390.0;
      const shock = (Math.random() - 0.48) * 0.02;
      const closeP = Number((base * (1 + shock)).toFixed(2));
      const openP = base;
      const highP = Number((Math.max(openP, closeP) * 1.008).toFixed(2));
      const lowP = Number((Math.min(openP, closeP) * 0.992).toFixed(2));
      const chg = Number((((closeP - openP) / openP) * 100).toFixed(2));

      const updatedSess = await frozenPaperTradingApi.stepSession(versionId, {
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        open: openP,
        high: highP,
        low: lowP,
        close: closeP,
        change_percent: chg,
      });
      const updatedTrades = await frozenPaperTradingApi.getTradeAuditLog(versionId);
      setSession(updatedSess);
      setTrades(updatedTrades);
    } catch (err: any) {
      setError(err?.message || 'Failed to process step.');
    } finally {
      setStreaming(false);
    }
  };

  const handleResetSession = async () => {
    try {
      setLoading(true);
      const updatedSess = await frozenPaperTradingApi.resetSession(versionId);
      const updatedTrades = await frozenPaperTradingApi.getTradeAuditLog(versionId);
      setSession(updatedSess);
      setTrades(updatedTrades);
    } catch (err: any) {
      setError(err?.message || 'Failed to reset session.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !session) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
        <h2>Loading COALINDIA_WFA_FROZEN_v1 Paper Trading Engine...</h2>
      </div>
    );
  }

  const pnlNum = Number(session?.cumulative_realized_pnl || 0);
  const isPnlPositive = pnlNum >= 0;
  const scorecard = session?.validation_scorecard;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* 1. Header & Frozen Badge */}
      <div style={{ background: '#1e293b', color: '#f8fafc', padding: '1.5rem', borderRadius: '10px', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>
                COALINDIA_WFA_FROZEN_v1 Virtual Paper Trading Engine
              </h1>
              <span style={{ background: '#059669', color: '#fff', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                STATUS: FROZEN
              </span>
              <span style={{ background: '#475569', color: '#f8fafc', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                AIR-GAPPED (PAPER ONLY)
              </span>
            </div>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>
              Strategy 25 (COALINDIA) | SHA-256 Hash: <code style={{ color: '#38bdf8' }}>{config?.config_hash || 'd3e8a49c2f10b7ea'}</code> | Same-Bar Ambiguity: <span style={{ color: '#fbbf24' }}>SL_FIRST</span>
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Allocated Capital Bucket:</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#38bdf8' }}>
              ₹{Number(config?.allocated_capital || 22727.27).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Frozen Specifications Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1.25rem', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Buy Threshold:</span>
            <div style={{ fontWeight: 600 }}>₹{config?.buy_threshold || 390.78}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Stop-Loss (SL):</span>
            <div style={{ fontWeight: 600, color: '#f87171' }}>₹{config?.stop_loss || 382.20} (-2.0%)</div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Target (TP):</span>
            <div style={{ fontWeight: 600, color: '#4ade80' }}>₹{config?.target || 403.65} (+3.5%)</div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Trend Filter:</span>
            <div style={{ fontWeight: 600 }}>{config?.use_trend_filter ? 'ACTIVE (≥ 0.2%)' : 'DISABLED'}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Volatility Filter:</span>
            <div style={{ fontWeight: 600 }}>{config?.use_volatility_filter ? 'ACTIVE (≤ 3.5%)' : 'DISABLED'}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Taxes & Slippage:</span>
            <div style={{ fontWeight: 600 }}>Indian CNC + Dynamic</div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #f87171', color: '#b91c1c', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* 2. Executive Metrics Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Virtual Portfolio NAV</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0f172a', marginTop: '0.25rem' }}>
            ₹{Number(session?.portfolio_nav || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Cash: ₹{Number(session?.cash_balance || 0).toFixed(2)}</span>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Cumulative Net Realized P&L</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: isPnlPositive ? '#16a34a' : '#dc2626', marginTop: '0.25rem' }}>
            {isPnlPositive ? '+' : ''}₹{pnlNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '0.75rem', color: isPnlPositive ? '#16a34a' : '#dc2626' }}>
            Charges Deducted: ₹{Number(session?.total_charges_paid || 0).toFixed(2)}
          </span>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Win Rate % ({session?.winning_trades_count || 0}W / {session?.losing_trades_count || 0}L)</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0f172a', marginTop: '0.25rem' }}>
            {session?.win_rate_pct || 0}%
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Target: ≥ 40.0%</span>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Profit Factor (PF)</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0f172a', marginTop: '0.25rem' }}>
            {session?.profit_factor || 0}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Target: ≥ 1.10</span>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Max Drawdown</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0f172a', marginTop: '0.25rem' }}>
            {session?.max_drawdown_pct || 0}%
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Limit: ≤ 15.0%</span>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Promotion Readiness (N ≥ 50 Gate)</span>
          <div style={{
            fontSize: '0.95rem',
            fontWeight: 'bold',
            marginTop: '0.5rem',
            padding: '0.35rem 0.6rem',
            borderRadius: '4px',
            textAlign: 'center',
            background: scorecard?.promotion_readiness_status === 'ROBUST_PAPER_CANDIDATE' || scorecard?.promotion_readiness_status === 'PAPER_VALIDATED' ? '#dcfce7' : scorecard?.promotion_readiness_status === 'REJECTED' ? '#fee2e2' : '#fef3c7',
            color: scorecard?.promotion_readiness_status === 'ROBUST_PAPER_CANDIDATE' || scorecard?.promotion_readiness_status === 'PAPER_VALIDATED' ? '#15803d' : scorecard?.promotion_readiness_status === 'REJECTED' ? '#b91c1c' : '#b45309',
          }}>
            {scorecard?.promotion_readiness_status || 'INSUFFICIENT_SAMPLE'}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '0.25rem' }}>
            {scorecard?.completed_trades || 0}/50 Trades | Invariant Violations: {scorecard?.tp_sl_invariant_violations || 0}
          </span>
        </div>
      </div>

      {/* 3. Controls & Active Position Monitor */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Interactive Feed Simulator Controller */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '0 0 1rem 0' }}>Virtual Market Feed Simulator</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
            Simulate an independent live market candle feed to generate fresh trades and validate the ≥30 completed trades robustness gate.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Simulation Candles:</label>
              <select
                value={feedCandleCount}
                onChange={(e) => setFeedCandleCount(Number(e.target.value))}
                style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
              >
                <option value={40}>40 Candles (~10-15 Trades)</option>
                <option value={80}>80 Candles (~25-35 Trades - Targets ≥30)</option>
                <option value={150}>150 Candles (~50+ Trades)</option>
              </select>
            </div>

            <button
              onClick={handleSimulateFeed}
              disabled={streaming}
              style={{
                background: streaming ? '#94a3b8' : '#2563eb',
                color: '#fff',
                border: 'none',
                padding: '0.6rem 1.25rem',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: streaming ? 'not-allowed' : 'pointer',
                marginTop: '1.25rem',
              }}
            >
              {streaming ? 'Simulating Feed...' : '⚡ Stream Market Feed (Generate Trades)'}
            </button>

            <button
              onClick={handleSingleStep}
              disabled={streaming}
              style={{
                background: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                padding: '0.6rem 1rem',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: streaming ? 'not-allowed' : 'pointer',
                marginTop: '1.25rem',
              }}
            >
              Step Single Candle
            </button>

            <button
              onClick={handleResetSession}
              disabled={streaming}
              style={{
                background: '#fff',
                color: '#dc2626',
                border: '1px solid #fca5a5',
                padding: '0.6rem 1rem',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: streaming ? 'not-allowed' : 'pointer',
                marginTop: '1.25rem',
                marginLeft: 'auto',
              }}
            >
              Reset Session
            </button>
          </div>

          {/* Validation Quality Gate Scorecard */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Validation Gate Scorecard (Target: N ≥ 30)</span>
              <span
                style={{
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  background: scorecard?.overall_status === 'ROBUST_WINNER' ? '#dcfce7' : '#fef3c7',
                  color: scorecard?.overall_status === 'ROBUST_WINNER' ? '#15803d' : '#b45309',
                }}
              >
                {scorecard?.overall_status || 'INSUFFICIENT_SAMPLE_SIZE'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', fontSize: '0.8rem' }}>
              <div>Sample Size: <strong style={{ color: scorecard?.sample_size_satisfied ? '#16a34a' : '#b45309' }}>{scorecard?.completed_trades || 0} / 30</strong></div>
              <div>Win Rate: <strong style={{ color: scorecard?.win_rate_satisfied ? '#16a34a' : '#dc2626' }}>{scorecard?.win_rate_pct || 0}%</strong></div>
              <div>Profit Factor: <strong style={{ color: scorecard?.profit_factor_satisfied ? '#16a34a' : '#dc2626' }}>{scorecard?.profit_factor || 0}</strong></div>
              <div>Net Realized: <strong style={{ color: scorecard?.net_pnl_positive ? '#16a34a' : '#dc2626' }}>₹{Number(scorecard?.cumulative_net_pnl || 0).toFixed(2)}</strong></div>
            </div>
          </div>
        </div>

        {/* Active Virtual Position Monitor */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '0 0 1rem 0' }}>Active Virtual Position</h2>
          {session?.active_position ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#0f172a' }}>{session.active_position.symbol}</span>
                <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                  LONG ({Number(session.active_position.quantity)} Qty)
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Entry Price:</span>
                  <div style={{ fontWeight: 600 }}>₹{Number(session.active_position.entry_price).toFixed(2)}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Mark Price:</span>
                  <div style={{ fontWeight: 600 }}>₹{Number(session.active_position.current_price).toFixed(2)}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Stop-Loss Trigger:</span>
                  <div style={{ fontWeight: 600, color: '#dc2626' }}>₹{Number(session.active_position.stop_loss_price).toFixed(2)}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Target Trigger:</span>
                  <div style={{ fontWeight: 600, color: '#16a34a' }}>₹{Number(session.active_position.target_price).toFixed(2)}</div>
                </div>
              </div>
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Unrealized P&L:</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: Number(session.active_position.unrealized_pnl) >= 0 ? '#16a34a' : '#dc2626' }}>
                  {Number(session.active_position.unrealized_pnl) >= 0 ? '+' : ''}₹{Number(session.active_position.unrealized_pnl).toFixed(2)} ({session.active_position.unrealized_return_pct.toFixed(2)}%)
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛡️</div>
              <p style={{ margin: 0, fontWeight: 500 }}>No Open Virtual Position</p>
              <span style={{ fontSize: '0.75rem' }}>Awaiting buy signal above ₹{config?.buy_threshold || 390.78} with positive trend momentum.</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Fresh-Trade Audit Log Table */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>
            Fresh-Trade Audit Log ({trades.length} Completed Trades)
          </h2>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>STT, Stamp Duty, GST & Slippage Deducted at Source</span>
        </div>

        {trades.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
            No trades executed yet. Click <strong>"Stream Market Feed"</strong> to simulate fresh market candles and generate paper trades.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '0.75rem' }}>Trade ID</th>
                  <th style={{ padding: '0.75rem' }}>Entry Time / Price</th>
                  <th style={{ padding: '0.75rem' }}>Exit Time / Price</th>
                  <th style={{ padding: '0.75rem' }}>Qty</th>
                  <th style={{ padding: '0.75rem' }}>Gross P&L</th>
                  <th style={{ padding: '0.75rem' }}>Indian Taxes & Fees</th>
                  <th style={{ padding: '0.75rem' }}>Net Realized P&L</th>
                  <th style={{ padding: '0.75rem' }}>Return %</th>
                  <th style={{ padding: '0.75rem' }}>Exit Reason</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t, idx) => {
                  const netNum = Number(t.net_pnl);
                  const isWin = netNum > 0;
                  return (
                    <tr key={t.trade_id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>#{t.trade_id}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <div>{t.entry_timestamp}</div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem' }}>₹{Number(t.entry_price).toFixed(2)}</div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div>{t.exit_timestamp}</div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem' }}>₹{Number(t.exit_price).toFixed(2)}</div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>{Number(t.quantity)}</td>
                      <td style={{ padding: '0.75rem', color: Number(t.gross_pnl) >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                        {Number(t.gross_pnl) >= 0 ? '+' : ''}₹{Number(t.gross_pnl).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.75rem', color: '#64748b' }}>
                        ₹{Number(t.total_charges).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.75rem', color: isWin ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>
                        {isWin ? '+' : ''}₹{netNum.toFixed(2)}
                      </td>
                      <td style={{ padding: '0.75rem', color: isWin ? '#16a34a' : '#dc2626' }}>
                        {t.return_pct.toFixed(2)}%
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: t.exit_reason === 'TAKE_PROFIT' ? '#dcfce7' : '#fee2e2',
                            color: t.exit_reason === 'TAKE_PROFIT' ? '#15803d' : '#b91c1c',
                          }}
                        >
                          {t.exit_reason}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
