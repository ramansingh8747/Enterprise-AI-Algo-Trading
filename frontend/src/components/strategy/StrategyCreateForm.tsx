import React, { useState } from 'react';
import { strategyApi } from '@/services/api/strategyApi';
import { StrategyDefinitionCreatePayload } from '@/types/strategy';
import { ApiError } from '@/services/api/ApiError';
import '../../styles/StrategyForm.css';

interface StrategyCreateFormProps {
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}

export const StrategyCreateForm: React.FC<StrategyCreateFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [strategyType, setStrategyType] = useState('DETERMINISTIC_MOMENTUM');
  const [autoPilot, setAutoPilot] = useState(true);
  const [budgetCapital, setBudgetCapital] = useState('1000.00');
  const [sizingMode, setSizingMode] = useState('BUDGET_BASED');
  const [minHoldingSec, setMinHoldingSec] = useState('60');
  const [confirmVolume, setConfirmVolume] = useState(true);
  const [enforceSentiment, setEnforceSentiment] = useState(true);
  const [configJson, setConfigJson] = useState(
    JSON.stringify(
      {
        auto_pilot: true,
        position_sizing_mode: 'BUDGET_BASED',
        capital: '1000.00',
        min_holding_seconds: 60,
        confirm_volume_spike: true,
        enforce_market_sentiment: true,
      },
      null,
      2
    )
  );
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const syncConfig = (
    ap: boolean,
    cap: string,
    mode: string,
    holdSec: string,
    vol: boolean,
    sent: boolean
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
      };
      setConfigJson(JSON.stringify(updated, null, 2));
    } catch {}
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const trimmedName = name.trim();
    const trimmedStrategyType = strategyType.trim();
    const trimmedConfig = configJson.trim();

    if (!trimmedName) {
      errors.name = 'Strategy name is required';
    }

    if (!trimmedStrategyType) {
      errors.strategyType = 'Strategy type is required';
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

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: StrategyDefinitionCreatePayload = {
        name: name.trim(),
        strategy_type: strategyType.trim(),
        config_json: configJson.trim() || undefined,
      };

      const result = await strategyApi.createDefinition(payload);

      setName('');
      setStrategyType('DETERMINISTIC_MOMENTUM');
      setConfigJson('');
      setFieldErrors({});

      onSuccess?.(result.id);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.details && typeof err.details === 'object') {
          setFieldErrors(err.details as Record<string, string>);
        }
      } else {
        setError('Failed to create strategy');
      }
      console.error('Error creating strategy:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="strategy-form" onSubmit={handleSubmit}>
      <h2>Create New Strategy</h2>
      {error && <div className="form-error">{error}</div>}

      <div className="form-group">
        <label htmlFor="name">Strategy Name *</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Auto-Pilot Momentum Strategy"
          disabled={loading}
          className={fieldErrors.name ? 'error' : ''}
        />
        {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="strategyType">Strategy Type *</label>
        <select
          id="strategyType"
          value={strategyType}
          onChange={(e) => setStrategyType(e.target.value)}
          disabled={loading}
          className={fieldErrors.strategyType ? 'error' : ''}
        >
          <option value="DETERMINISTIC_MOMENTUM">Deterministic Momentum</option>
          <option value="momentum">Momentum</option>
          <option value="mean_reversion">Mean Reversion</option>
          <option value="arbitrage">Arbitrage</option>
          <option value="trend_following">Trend Following</option>
          <option value="custom">Custom</option>
        </select>
        {fieldErrors.strategyType && (
          <span className="field-error">{fieldErrors.strategyType}</span>
        )}
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

      <div className="form-group">
        <label htmlFor="configJson">Configuration (JSON)</label>
        <textarea
          id="configJson"
          value={configJson}
          onChange={(e) => setConfigJson(e.target.value)}
          placeholder='{"param1": "value1"}'
          disabled={loading}
          rows={5}
          className={fieldErrors.configJson ? 'error' : ''}
        />
        {fieldErrors.configJson && (
          <span className="field-error">{fieldErrors.configJson}</span>
        )}
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Creating...' : 'Create Strategy'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" disabled={loading} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};
