import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { strategyApi, StrategyDefinition } from '@/services/api/strategyApi';
import { StrategyDefinitionUpdatePayload } from '@/types/strategy';
import { ApiError } from '@/services/api/ApiError';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import './styles/StrategyEdit.css';

/**
 * Strategy Edit Page
 *
 * Loads an existing strategy definition and allows editing.
 */
export default function StrategyEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [strategy, setStrategy] = useState<StrategyDefinition | null>(null);
  const [name, setName] = useState('');
  const [configJson, setConfigJson] = useState('');
  const [autoPilot, setAutoPilot] = useState(true);
  const [budgetCapital, setBudgetCapital] = useState('1000.00');
  const [sizingMode, setSizingMode] = useState('BUDGET_BASED');
  const [minHoldingSec, setMinHoldingSec] = useState('60');
  const [confirmVolume, setConfirmVolume] = useState(true);
  const [enforceSentiment, setEnforceSentiment] = useState(true);

  // Multi-Bucket Dynamic Capital Allocation
  const [morningBudget, setMorningBudget] = useState('5000.00');
  const [heroZeroBudget, setHeroZeroBudget] = useState('500.00');
  const [fullDayBudget, setFullDayBudget] = useState('10000.00');
  const [riskPerTrade, setRiskPerTrade] = useState('500.00');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const syncConfig = (
    ap: boolean,
    cap: string,
    mode: string,
    holdSec: string,
    vol: boolean,
    sent: boolean,
    mornBud: string = morningBudget,
    hzBud: string = heroZeroBudget,
    fdBud: string = fullDayBudget,
    rpt: string = riskPerTrade
  ) => {
    try {
      let existing = {};
      if (configJson.trim()) {
        try { existing = JSON.parse(configJson); } catch {}
      }
      const updated = {
        ...existing,
        auto_pilot: ap,
        position_sizing_mode: mode,
        capital: cap,
        min_holding_seconds: parseInt(holdSec, 10) || 60,
        confirm_volume_spike: vol,
        enforce_market_sentiment: sent,
        morning_scalper_budget_inr: parseFloat(mornBud) || 5000.0,
        hero_zero_budget_inr: parseFloat(hzBud) || 500.0,
        full_day_equity_budget_inr: parseFloat(fdBud) || 10000.0,
        risk_per_trade_inr: parseFloat(rpt) || 500.0,
      };
      setConfigJson(JSON.stringify(updated, null, 2));
    } catch {}
  };

  useEffect(() => {
    if (!id) {
      setError('Strategy ID is missing');
      setLoading(false);
      return;
    }

    const loadStrategy = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await strategyApi.getDefinition(id);
        setStrategy(data);
        setName(data.name);
        const cfgStr = data.config_json || '';
        setConfigJson(cfgStr);
        if (cfgStr.trim()) {
          try {
            const parsed = JSON.parse(cfgStr);
            if (typeof parsed === 'object' && parsed !== null) {
              if (parsed.auto_pilot !== undefined) setAutoPilot(Boolean(parsed.auto_pilot));
              if (parsed.capital !== undefined) setBudgetCapital(String(parsed.capital));
              if (parsed.position_sizing_mode !== undefined) setSizingMode(String(parsed.position_sizing_mode));
              if (parsed.min_holding_seconds !== undefined) setMinHoldingSec(String(parsed.min_holding_seconds));
              if (parsed.confirm_volume_spike !== undefined) setConfirmVolume(Boolean(parsed.confirm_volume_spike));
              if (parsed.enforce_market_sentiment !== undefined) setEnforceSentiment(Boolean(parsed.enforce_market_sentiment));
              if (parsed.morning_scalper_budget_inr !== undefined) setMorningBudget(String(parsed.morning_scalper_budget_inr));
              if (parsed.hero_zero_budget_inr !== undefined) setHeroZeroBudget(String(parsed.hero_zero_budget_inr));
              if (parsed.full_day_equity_budget_inr !== undefined) setFullDayBudget(String(parsed.full_day_equity_budget_inr));
              if (parsed.risk_per_trade_inr !== undefined) setRiskPerTrade(String(parsed.risk_per_trade_inr));
            }
          } catch {}
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load strategy';
        setError(message);
        console.error('Failed to load strategy:', err);
      } finally {
        setLoading(false);
      }
    };

    loadStrategy();
  }, [id]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const trimmedName = name.trim();
    const trimmedConfig = configJson.trim();

    if (!trimmedName) {
      errors.name = 'Strategy name is required';
    }

    if (trimmedConfig) {
      try {
        JSON.parse(trimmedConfig);
      } catch {
        errors.configJson = 'Configuration must contain valid JSON';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !id) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: StrategyDefinitionUpdatePayload = {
        name: name.trim(),
        config_json: configJson.trim() || undefined,
      };

      await strategyApi.updateDefinition(id, payload);
      navigate(`/strategies/${id}`);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.details && typeof err.details === 'object') {
          setFieldErrors(err.details as Record<string, string>);
        }
      } else {
        setError('Failed to update strategy');
      }
      console.error('Error updating strategy:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleApplyToAllStrategies = async () => {
    const isConfirmed = window.confirm(
      `Apply these budget and risk settings to all 133 strategies simultaneously?\n\n` +
      `• Morning Scalper Budget: ₹${morningBudget}\n` +
      `• Hero-Zero Gamma Budget: ₹${heroZeroBudget}\n` +
      `• Full-Day Equity Budget: ₹${fullDayBudget}\n` +
      `• Risk Per Trade: ₹${riskPerTrade}\n` +
      `• Position Sizing Mode: ${sizingMode}\n\n` +
      `Press OK to update all 133 strategies now.`
    );
    if (!isConfirmed) return;

    setBulkApplying(true);
    setError(null);
    setBulkSuccessMsg(null);

    try {
      // First save this current strategy definition as well
      const payloadCurrent: StrategyDefinitionUpdatePayload = {
        name: name.trim(),
        config_json: configJson.trim() || undefined,
      };
      if (id) {
        await strategyApi.updateDefinition(id, payloadCurrent);
      }

      // Then bulk update all definitions
      const bulkPayload = {
        morning_scalper_budget_inr: parseFloat(morningBudget) || 5000.0,
        hero_zero_budget_inr: parseFloat(heroZeroBudget) || 500.0,
        full_day_equity_budget_inr: parseFloat(fullDayBudget) || 10000.0,
        risk_per_trade_inr: parseFloat(riskPerTrade) || 500.0,
        position_sizing_mode: sizingMode,
        auto_pilot: autoPilot,
        min_holding_seconds: parseInt(minHoldingSec, 10) || 60,
        confirm_volume_spike: confirmVolume,
        enforce_market_sentiment: enforceSentiment,
      };

      const res = await strategyApi.bulkUpdateConfig(bulkPayload);
      setBulkSuccessMsg(`🚀 ${res.message || `Successfully applied settings to all ${res.updated_count} strategies in 1 click!`}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err?.message || 'Failed to bulk apply configuration to all strategies.');
    } finally {
      setBulkApplying(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading strategy..." />;
  }

  if (error && !strategy) {
    return (
      <ErrorState
        message={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="strategy-edit-page">
      <div className="edit-header">
        <button className="btn btn-outline" onClick={() => navigate(`/strategies/${id}`)}>
          ← Back
        </button>
        <h1>Edit Strategy</h1>
      </div>

      {bulkSuccessMsg && (
        <div style={{
          padding: '1rem 1.25rem',
          marginBottom: '1.25rem',
          borderRadius: '0.5rem',
          background: 'rgba(34, 197, 94, 0.15)',
          border: '1px solid rgba(34, 197, 94, 0.4)',
          color: '#4ade80',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.95rem',
        }}>
          <span>{bulkSuccessMsg}</span>
        </div>
      )}

      <form className="strategy-edit-form" onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div className="form-group">
          <label htmlFor="name">Strategy Name *</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            className={fieldErrors.name ? 'error' : ''}
          />
          {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="strategyType">Strategy Type (Read-only)</label>
          <input
            id="strategyType"
            type="text"
            value={strategy?.strategy_type || ''}
            disabled
            title="Strategy type cannot be changed after creation"
          />
        </div>

        {/* Auto-Pilot & Execution Settings Card */}
        <div style={{ padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <strong style={{ fontSize: '1rem', color: '#0f172a' }}>⚡ Execution Mode: {autoPilot ? 'Full Auto-Pilot (Autonomous)' : 'Advisory (Manual Approval)'}</strong>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                {autoPilot
                  ? 'System automatically places BUY orders and manages Trailing Stop-Loss exits hands-free.'
                  : 'System sends notifications and requires manual confirmation before placing orders.'}
              </p>
            </div>
            <button
              type="button"
              className="btn"
              style={{
                background: autoPilot ? '#10b981' : '#64748b',
                color: '#fff',
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                fontWeight: 600,
              }}
              onClick={() => {
                const next = !autoPilot;
                setAutoPilot(next);
                syncConfig(next, budgetCapital, sizingMode, minHoldingSec, confirmVolume, enforceSentiment);
              }}
            >
              {autoPilot ? 'Auto-Pilot ON' : 'Manual Advisory'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
            <div>
              <label htmlFor="budget-capital" style={{ fontSize: '0.85rem', color: '#334155' }}>Budget / Capital (₹) *</label>
              <input
                id="budget-capital"
                type="number"
                value={budgetCapital}
                onChange={(e) => {
                  setBudgetCapital(e.target.value);
                  syncConfig(autoPilot, e.target.value, sizingMode, minHoldingSec, confirmVolume, enforceSentiment);
                }}
                placeholder="1000.00"
                style={{ marginTop: '0.25rem' }}
              />
            </div>

            <div>
              <label htmlFor="sizing-mode" style={{ fontSize: '0.85rem', color: '#334155' }}>Position Sizing Mode</label>
              <select
                id="sizing-mode"
                value={sizingMode}
                onChange={(e) => {
                  setSizingMode(e.target.value);
                  syncConfig(autoPilot, budgetCapital, e.target.value, minHoldingSec, confirmVolume, enforceSentiment);
                }}
                style={{ marginTop: '0.25rem' }}
              >
                <option value="BUDGET_BASED">Budget-Based (Affordable Shares)</option>
                <option value="DYNAMIC_RISK">Dynamic Risk-Based (1% Risk)</option>
              </select>
            </div>
          </div>

          {/* Safety Guards Toggles */}
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#334155', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={confirmVolume}
                onChange={(e) => {
                  setConfirmVolume(e.target.checked);
                  syncConfig(autoPilot, budgetCapital, sizingMode, minHoldingSec, e.target.checked, enforceSentiment);
                }}
              />
              <span><strong>Volume Spike Confirmation:</strong> Suppress low-volume fake breakout traps</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#334155', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enforceSentiment}
                onChange={(e) => {
                  setEnforceSentiment(e.target.checked);
                  syncConfig(autoPilot, budgetCapital, sizingMode, minHoldingSec, confirmVolume, e.target.checked);
                }}
              />
              <span><strong>Nifty / Index Sentiment Guard:</strong> Suppress BUY orders during market bloodbath</span>
            </label>
          </div>
        </div>

        {/* Multi-Bucket Dynamic Capital Allocation Card */}
        <div style={{ padding: '1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', marginBottom: '1rem' }}>
          <div style={{ marginBottom: '0.75rem' }}>
            <strong style={{ fontSize: '1rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🏦 Multi-Bucket Dynamic Capital & Risk Allocation
            </strong>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#15803d' }}>
              Configure independent capital pools for Morning Scalping, Afternoon Hero-Zero, and Full-Day Equity to prevent cross-contamination.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label htmlFor="morning-budget" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#14532d' }}>
                ☀️ Morning Scalper Budget (₹)
              </label>
              <input
                id="morning-budget"
                type="number"
                value={morningBudget}
                onChange={(e) => {
                  setMorningBudget(e.target.value);
                  syncConfig(autoPilot, budgetCapital, sizingMode, minHoldingSec, confirmVolume, enforceSentiment, e.target.value, heroZeroBudget, fullDayBudget, riskPerTrade);
                }}
                placeholder="5000.00"
                style={{ marginTop: '0.25rem', borderColor: '#86efac' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#166534' }}>09:20 AM ATM momentum option breakout</span>
            </div>

            <div>
              <label htmlFor="hero-zero-budget" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#14532d' }}>
                🔥 Afternoon Hero-Zero Budget (₹)
              </label>
              <input
                id="hero-zero-budget"
                type="number"
                value={heroZeroBudget}
                onChange={(e) => {
                  setHeroZeroBudget(e.target.value);
                  syncConfig(autoPilot, budgetCapital, sizingMode, minHoldingSec, confirmVolume, enforceSentiment, morningBudget, e.target.value, fullDayBudget, riskPerTrade);
                }}
                placeholder="500.00"
                style={{ marginTop: '0.25rem', borderColor: '#86efac' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#166534' }}>03:10 PM Expiry Gamma Blast (₹300 - ₹5,000)</span>
            </div>

            <div>
              <label htmlFor="full-day-budget" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#14532d' }}>
                🌐 Full-Day Equity Capital (₹)
              </label>
              <input
                id="full-day-budget"
                type="number"
                value={fullDayBudget}
                onChange={(e) => {
                  setFullDayBudget(e.target.value);
                  syncConfig(autoPilot, budgetCapital, sizingMode, minHoldingSec, confirmVolume, enforceSentiment, morningBudget, heroZeroBudget, e.target.value, riskPerTrade);
                }}
                placeholder="10000.00"
                style={{ marginTop: '0.25rem', borderColor: '#86efac' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#166534' }}>5x SEBI intraday margin on liquid equities</span>
            </div>

            <div>
              <label htmlFor="risk-per-trade" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#14532d' }}>
                🛡️ Full-Day Per-Trade Risk (₹)
              </label>
              <input
                id="risk-per-trade"
                type="number"
                value={riskPerTrade}
                onChange={(e) => {
                  setRiskPerTrade(e.target.value);
                  syncConfig(autoPilot, budgetCapital, sizingMode, minHoldingSec, confirmVolume, enforceSentiment, morningBudget, heroZeroBudget, fullDayBudget, e.target.value);
                }}
                placeholder="500.00"
                style={{ marginTop: '0.25rem', borderColor: '#86efac' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#166534' }}>Pillar 4 fixed risk per trade</span>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="configJson">Configuration (JSON)</label>
          <textarea
            id="configJson"
            value={configJson}
            onChange={(e) => setConfigJson(e.target.value)}
            disabled={saving}
            rows={6}
            className={fieldErrors.configJson ? 'error' : ''}
          />
          {fieldErrors.configJson && (
            <span className="field-error">{fieldErrors.configJson}</span>
          )}
        </div>

        <div className="form-actions" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="submit" className="btn btn-primary" disabled={saving || bulkApplying}>
            {saving ? 'Saving...' : 'Save for This Strategy'}
          </button>
          <button
            type="button"
            className="btn"
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              color: '#ffffff',
              fontWeight: 700,
              padding: '0.62rem 1.25rem',
              borderRadius: '0.45rem',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
            }}
            disabled={saving || bulkApplying}
            onClick={handleApplyToAllStrategies}
          >
            {bulkApplying ? '⏳ Applying to All 133 Strategies...' : '⚡ Apply Budget to ALL 133 Strategies'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={saving || bulkApplying}
            onClick={() => navigate(`/strategies/${id}`)}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
